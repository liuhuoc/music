import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capgo/capacitor-native-audio';
import type { PluginListenerHandle } from '@capacitor/core';
import type { Song } from '../data/songs';
import { getPlayUrlWithRetry, getLyric } from '../services/musicApi';
import { debugLogger } from '../utils/debugLogger';
import {
  downloadSong,
  deleteDownloadedFile,
  readDownloadedFile,
} from '../services/downloadService';
import type { DownloadProgress } from '../services/downloadService';

type PlayMode = 'loop' | 'single' | 'shuffle';

const AUDIO_ASSET_ID = 'music_player_current';
const isNative = Capacitor.isNativePlatform();

export interface DownloadItem {
  song: Song;
  progress: number;
  status: 'downloading' | 'completed' | 'paused' | 'failed';
  addedAt: number;
  fileSize: string;
  filePath?: string;
  sizeBytes: number;
}

export function usePlayer() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>('loop');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<Set<string>>(new Set());
  const [downloadList, setDownloadList] = useState<DownloadItem[]>([]);
  const [timerActive, setTimerActive] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [volume, _setVolume] = useState(1);
  const [isMuted, _setIsMuted] = useState(false);

  // Web fallback audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const downloadTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const currentUrlRef = useRef<string>('');
  const listenersRef = useRef<PluginListenerHandle[]>([]);
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void | Promise<void>>(() => {});
  const pauseRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Initialize native audio
  useEffect(() => {
    if (isNative) {
      NativeAudio.configure({
        focus: true,
        background: true,
        showNotification: true,
        backgroundPlayback: true,
      }).catch(() => {});

      // Listen for playback completion
      NativeAudio.addListener('complete', (event) => {
        if (event.assetId === AUDIO_ASSET_ID) {
          handleNextRef.current();
        }
      }).then(l => listenersRef.current.push(l));

      // Listen for current time updates (100ms)
      NativeAudio.addListener('currentTime', (event) => {
        if (event.assetId === AUDIO_ASSET_ID) {
          setProgress(event.currentTime);
        }
      }).then(l => listenersRef.current.push(l));

      // Listen for playback state changes (lock screen controls)
      NativeAudio.addListener('playbackState', (event) => {
        if (event.assetId === AUDIO_ASSET_ID) {
          setIsPlaying(event.isPlaying);
          if (event.currentTime !== undefined) {
            setProgress(event.currentTime);
          }
          if (event.duration !== undefined) {
            setDuration(event.duration);
          }
          // Handle remote controls
          if (event.reason === 'remoteNext') {
            handleNextRef.current();
          } else if (event.reason === 'remotePrevious') {
            handlePrevRef.current();
          }
        }
      }).then(l => listenersRef.current.push(l));
    } else {
      // Web fallback: use HTMLAudioElement
      const audio = new Audio();
      audioRef.current = audio;

      const onTimeUpdate = () => setProgress(audio.currentTime);
      const onLoadedMetadata = () => setDuration(audio.duration || 0);
      const onEnded = () => handleNextRef.current();
      const onError = () => {
        setIsPlaying(false);
        debugLogger.error('[Player] Audio playback error');
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        audio.pause();
      };
    }

    return () => {
      // Clean up native listeners
      listenersRef.current.forEach(l => l.remove());
      listenersRef.current = [];
      // Clean up download timers
      downloadTimersRef.current.forEach(timer => clearInterval(timer));
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timerActive && timerEndTime) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, timerEndTime - Date.now());
        setTimerRemaining(remaining);
        if (remaining <= 0) {
          pauseRef.current();
          setTimerActive(false);
          setTimerEndTime(null);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timerEndTime]);

  const play = useCallback(async (song: Song, songQueue?: Song[]) => {
    debugLogger.log(`[Player] 播放: ${song.title} - ${song.artist} (source: ${song.source}, id: ${song.id})`);
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);

    let url: string;

    // Check if song is downloaded locally
    const downloadedItem = downloadList.find(d => d.song.id === song.id && d.status === 'completed');
    if (downloadedItem?.filePath) {
      // Play local file - on Android, read the actual file into a blob URL
      if (isNative) {
        const blobUrl = await readDownloadedFile(song);
        url = blobUrl || downloadedItem.filePath;
      } else {
        url = downloadedItem.filePath;
      }
    } else {
      // Try to get real play URL from Netease API
      let playUrl: string | null = null;
      try {
        playUrl = await getPlayUrlWithRetry(song, 2);
      } catch {
        playUrl = null;
      }
      url = playUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    }

    debugLogger.log(`[Player] 播放URL: ${url.substring(0, 80)}...`);
    currentUrlRef.current = url;

    if (isNative) {
      try {
        // Stop and unload previous
        await NativeAudio.stop({ assetId: AUDIO_ASSET_ID }).catch(() => {});
        await NativeAudio.unload({ assetId: AUDIO_ASSET_ID }).catch(() => {});

        // Preload with metadata for notification center
        await NativeAudio.preload({
          assetId: AUDIO_ASSET_ID,
          assetPath: url,
          isUrl: true,
          volume: isMuted ? 0 : volume,
          notificationMetadata: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            artworkUrl: song.cover,
          },
        });

        // Get duration
        const dur = await NativeAudio.getDuration({ assetId: AUDIO_ASSET_ID });
        setDuration(dur.duration);

        // Play
        await NativeAudio.play({ assetId: AUDIO_ASSET_ID });
      } catch (e) {
        debugLogger.error(`[Player] Native audio error: ${e instanceof Error ? e.message : String(e)}`);
        // Fallback: try network URL if local file failed
        if (downloadedItem?.filePath) {
          let fallbackUrl = url;
          try {
            const playUrl = await getPlayUrlWithRetry(song, 1);
            fallbackUrl = playUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
          } catch {
            fallbackUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
          }
          try {
            await NativeAudio.preload({
              assetId: AUDIO_ASSET_ID,
              assetPath: fallbackUrl,
              isUrl: true,
              volume: isMuted ? 0 : volume,
              notificationMetadata: {
                title: song.title,
                artist: song.artist,
                album: song.album,
                artworkUrl: song.cover,
              },
            });
            const dur = await NativeAudio.getDuration({ assetId: AUDIO_ASSET_ID });
            setDuration(dur.duration);
            await NativeAudio.play({ assetId: AUDIO_ASSET_ID });
          } catch {
            setIsPlaying(false);
          }
        } else {
          setIsPlaying(false);
        }
      }
    } else {
      // Web fallback
      const audio = audioRef.current;
      if (audio) {
        audio.src = url;
        audio.volume = isMuted ? 0 : volume;
        audio.play().catch(() => {
          // Fallback: try network URL if local file failed
          if (downloadedItem?.filePath) {
            getPlayUrlWithRetry(song, 1)
              .then(playUrl => {
                const fallbackUrl = playUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                audio.src = fallbackUrl;
                audio.play().catch(() => setIsPlaying(false));
              })
              .catch(() => {
                audio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
                audio.play().catch(() => setIsPlaying(false));
              });
          } else {
            setIsPlaying(false);
          }
        });
      }
    }

    // Fetch lyrics if not loaded yet
    if (song.lyrics === '[00:00.00]歌词加载中...') {
      try {
        const lyric = await getLyric(song);
        setCurrentSong(prev => prev && prev.id === song.id ? { ...prev, lyrics: lyric } : prev);
      } catch {
        // Keep default lyrics
      }
    }

    if (songQueue) {
      setQueue(songQueue);
      const idx = songQueue.findIndex(s => s.id === song.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    }
  }, [volume, isMuted, downloadList]);

  const togglePlay = useCallback(async () => {
    if (!currentSong) return;

    if (isNative) {
      try {
        if (isPlaying) {
          await NativeAudio.pause({ assetId: AUDIO_ASSET_ID });
          setIsPlaying(false);
        } else {
          await NativeAudio.resume({ assetId: AUDIO_ASSET_ID });
          setIsPlaying(true);
        }
      } catch {
        setIsPlaying(false);
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(() => setIsPlaying(false));
        setIsPlaying(true);
      }
    }
  }, [isPlaying, currentSong]);

  const pause = useCallback(async () => {
    if (isNative) {
      try {
        await NativeAudio.pause({ assetId: AUDIO_ASSET_ID });
      } catch {}
    } else {
      const audio = audioRef.current;
      if (audio) audio.pause();
    }
    setIsPlaying(false);
  }, []);

  const handleNext = useCallback(() => {
    if (queue.length === 0 || !currentSong) return;

    let nextIndex: number;
    if (playMode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (playMode === 'single') {
      nextIndex = queueIndex;
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      play(nextSong);
      setQueueIndex(nextIndex);
    }
  }, [queue, queueIndex, playMode, currentSong, play]);

  const handlePrev = useCallback(async () => {
    if (queue.length === 0 || !currentSong) return;

    if (progress < 3) {
      if (isNative) {
        try {
          await NativeAudio.setCurrentTime({ assetId: AUDIO_ASSET_ID, time: 0 });
        } catch {}
      } else {
        const audio = audioRef.current;
        if (audio) audio.currentTime = 0;
      }
      setProgress(0);
      return;
    }

    let prevIndex: number;
    if (playMode === 'shuffle') {
      prevIndex = Math.floor(Math.random() * queue.length);
    } else {
      prevIndex = (queueIndex - 1 + queue.length) % queue.length;
    }

    const prevSong = queue[prevIndex];
    if (prevSong) {
      play(prevSong);
      setQueueIndex(prevIndex);
    }
  }, [queue, queueIndex, playMode, currentSong, progress, play]);

  // Sync callback refs to avoid stale closures in event listeners
  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
    pauseRef.current = pause;
  }, [handleNext, handlePrev, pause]);

  const seekTo = useCallback(async (time: number) => {
    if (isNative) {
      try {
        await NativeAudio.setCurrentTime({ assetId: AUDIO_ASSET_ID, time });
        setProgress(time);
      } catch {}
    } else {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
        setProgress(time);
      }
    }
  }, []);

  const toggleFavorite = useCallback((songId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((songId: string) => favorites.has(songId), [favorites]);

  // ===== Download Management (Real Downloads) =====
  const startDownload = useCallback((song: Song) => {
    let shouldStart = false;
    let isResume = false;

    setDownloadList(prev => {
      const existing = prev.find(d => d.song.id === song.id);
      if (existing) {
        if (existing.status === 'paused') {
          shouldStart = true;
          isResume = true;
          return prev.map(d =>
            d.song.id === song.id
              ? { ...d, status: 'downloading' as const }
              : d
          );
        }
        return prev;
      }

      shouldStart = true;
      const newItem: DownloadItem = {
        song,
        progress: 0,
        status: 'downloading',
        addedAt: Date.now(),
        fileSize: '0 B',
        sizeBytes: 0,
      };
      return [...prev, newItem];
    });

    if (!shouldStart) return;

    // For resume, reset progress to 0 since we can't truly resume
    if (isResume) {
      setDownloadList(prev => prev.map(d =>
        d.song.id === song.id
          ? { ...d, progress: 0, sizeBytes: 0, fileSize: '0 B' }
          : d
      ));
    }

    // Start real download
    const controller = new AbortController();
    abortControllersRef.current.set(song.id, controller);

    downloadSong(song, (p: DownloadProgress) => {
      setDownloadList(current => {
        return current.map(d => {
          if (d.song.id === p.songId) {
            const updated: DownloadItem = {
              ...d,
              progress: p.progress,
              status: p.status,
              fileSize: p.fileSize,
              filePath: p.filePath || d.filePath,
              sizeBytes: p.sizeBytes ?? d.sizeBytes,
            };
            if (p.status === 'completed') {
              abortControllersRef.current.delete(song.id);
              setDownloads(prevD => {
                const next = new Set(prevD);
                next.add(song.id);
                return next;
              });
            } else if (p.status === 'failed') {
              abortControllersRef.current.delete(song.id);
            }
            return updated;
          }
          return d;
        });
      });
    });
  }, []);

  const pauseDownload = useCallback((songId: string) => {
    // Abort the active download
    const controller = abortControllersRef.current.get(songId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(songId);
    }
    setDownloadList(prev => prev.map(d =>
      d.song.id === songId && d.status === 'downloading'
        ? { ...d, status: 'paused' as const }
        : d
    ));
  }, []);

  const resumeDownload = useCallback((songId: string) => {
    setDownloadList(prev => {
      const item = prev.find(d => d.song.id === songId);
      if (!item || item.status !== 'paused') return prev;

      // Update status first
      const updatedList = prev.map(d =>
        d.song.id === songId && d.status === 'paused'
          ? { ...d, status: 'downloading' as const }
          : d
      );

      // Restart download
      const song = item.song;
      const controller = new AbortController();
      abortControllersRef.current.set(songId, controller);

      downloadSong(song, (p: DownloadProgress) => {
        setDownloadList(current => {
          return current.map(d => {
            if (d.song.id === p.songId) {
              const updated: DownloadItem = {
                ...d,
                progress: p.progress,
                status: p.status,
                fileSize: p.fileSize,
                filePath: p.filePath || d.filePath,
              };
              if (p.status === 'completed') {
                abortControllersRef.current.delete(songId);
                setDownloads(prevD => {
                  const next = new Set(prevD);
                  next.add(songId);
                  return next;
                });
              } else if (p.status === 'failed') {
                abortControllersRef.current.delete(songId);
              }
              return updated;
            }
            return d;
          });
        });
      });

      return updatedList;
    });
  }, []);

  const cancelDownload = useCallback((songId: string) => {
    const controller = abortControllersRef.current.get(songId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(songId);
    }
    setDownloadList(prev => prev.filter(d => d.song.id !== songId));
    setDownloads(prev => {
      const next = new Set(prev);
      next.delete(songId);
      return next;
    });
  }, []);

  const deleteDownload = useCallback(async (songId: string) => {
    const item = downloadList.find(d => d.song.id === songId);
    if (item) {
      await deleteDownloadedFile(item.song).catch(() => {});
    }
    setDownloadList(prev => prev.filter(d => d.song.id !== songId));
    setDownloads(prev => {
      const next = new Set(prev);
      next.delete(songId);
      return next;
    });
  }, [downloadList]);

  const retryDownload = useCallback((songId: string) => {
    setDownloadList(prev => prev.map(d =>
      d.song.id === songId && d.status === 'failed'
        ? { ...d, status: 'downloading' as const, progress: 0 }
        : d
    ));

    const item = downloadList.find(d => d.song.id === songId);
    if (!item) return;

    const song = item.song;
    const controller = new AbortController();
    abortControllersRef.current.set(songId, controller);

    downloadSong(song, (p: DownloadProgress) => {
      setDownloadList(current => {
        return current.map(d => {
          if (d.song.id === p.songId) {
            const updated: DownloadItem = {
              ...d,
              progress: p.progress,
              status: p.status,
              fileSize: p.fileSize,
              filePath: p.filePath || d.filePath,
            };
            if (p.status === 'completed') {
              abortControllersRef.current.delete(songId);
              setDownloads(prevD => {
                const next = new Set(prevD);
                next.add(songId);
                return next;
              });
            } else if (p.status === 'failed') {
              abortControllersRef.current.delete(songId);
            }
            return updated;
          }
          return d;
        });
      });
    });
  }, [downloadList]);

  // 播放已下载的文件
  const playDownloaded = useCallback(async (song: Song) => {
    const localUrl = await readDownloadedFile(song);
    if (localUrl) {
      setCurrentSong(song);
      setIsPlaying(true);
      setProgress(0);

      if (isNative) {
        try {
          await NativeAudio.stop({ assetId: AUDIO_ASSET_ID }).catch(() => {});
          await NativeAudio.unload({ assetId: AUDIO_ASSET_ID }).catch(() => {});
          await NativeAudio.preload({
            assetId: AUDIO_ASSET_ID,
            assetPath: localUrl,
            isUrl: true,
            volume: isMuted ? 0 : volume,
            notificationMetadata: {
              title: song.title,
              artist: song.artist,
              album: song.album,
              artworkUrl: song.cover,
            },
          });
          const dur = await NativeAudio.getDuration({ assetId: AUDIO_ASSET_ID });
          setDuration(dur.duration);
          await NativeAudio.play({ assetId: AUDIO_ASSET_ID });
        } catch (e) {
          debugLogger.error(`[Player] Failed to play downloaded file: ${e instanceof Error ? e.message : String(e)}`);
          setIsPlaying(false);
        }
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.src = localUrl;
          audio.volume = isMuted ? 0 : volume;
          audio.play().catch(() => setIsPlaying(false));
        }
      }
    }
  }, [volume, isMuted]);

  const isDownloaded = useCallback((songId: string) => downloads.has(songId), [downloads]);

  const getDownloadStats = useCallback(() => {
    const downloading = downloadList.filter(d => d.status === 'downloading').length;
    const completed = downloadList.filter(d => d.status === 'completed').length;
    const paused = downloadList.filter(d => d.status === 'paused').length;
    const totalBytes = downloadList
      .filter(d => d.status === 'completed')
      .reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
    const totalSize = totalBytes / (1024 * 1024);
    return { downloading, completed, paused, totalSize, total: downloadList.length };
  }, [downloadList]);

  const toggleDownload = useCallback((song: Song) => {
    const wasDownloaded = downloads.has(song.id);
    if (wasDownloaded) {
      deleteDownload(song.id);
    } else {
      startDownload(song);
    }
  }, [downloads, startDownload, deleteDownload]);

  const cyclePlayMode = useCallback(() => {
    setPlayMode(prev => {
      const modes: PlayMode[] = ['loop', 'single', 'shuffle'];
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  const setSleepTimer = useCallback((minutes: number) => {
    const endTime = Date.now() + minutes * 60 * 1000;
    setTimerEndTime(endTime);
    setTimerActive(true);
    setTimerRemaining(minutes * 60 * 1000);
  }, []);

  const cancelTimer = useCallback(() => {
    setTimerActive(false);
    setTimerEndTime(null);
    setTimerRemaining(0);
  }, []);

  const removeFromQueue = useCallback((songId: string) => {
    let newQueueIndex = queueIndex;
    let shouldPlayNext = false;
    let nextSong: Song | null = null;

    setQueue(prev => {
      const idx = prev.findIndex(s => s.id === songId);
      if (idx < 0) return prev;
      const next = prev.filter(s => s.id !== songId);
      if (idx < queueIndex) {
        newQueueIndex = queueIndex - 1;
      } else if (idx === queueIndex && next.length > 0) {
        newQueueIndex = idx % next.length;
        if (currentSong?.id === songId) {
          shouldPlayNext = true;
          nextSong = next[newQueueIndex];
        }
      }
      return next;
    });

    if (newQueueIndex !== queueIndex) {
      setQueueIndex(newQueueIndex);
    }
    if (shouldPlayNext && nextSong) {
      play(nextSong);
    }
  }, [queueIndex, currentSong, play]);

  const playNext = useCallback((song: Song) => {
    setQueue(prev => {
      const idx = prev.findIndex(s => s.id === song.id);
      let next = [...prev];
      if (idx >= 0) {
        next.splice(idx, 1);
      }
      const insertIdx = queueIndex + 1;
      next.splice(insertIdx, 0, song);
      return next;
    });
  }, [queueIndex]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    currentSong,
    isPlaying,
    progress,
    duration,
    queue,
    queueIndex,
    playMode,
    timerActive,
    timerRemaining,
    volume,
    isMuted,
    favorites,
    downloads,
    downloadList,
    play,
    togglePlay,
    pause,
    handleNext,
    handlePrev,
    seekTo,
    toggleFavorite,
    isFavorite,
    toggleDownload,
    isDownloaded,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    retryDownload,
    playDownloaded,
    getDownloadStats,
    cyclePlayMode,
    setSleepTimer,
    cancelTimer,
    removeFromQueue,
    playNext,
    formatTime,
    setQueue,
    setQueueIndex,
  };
}
