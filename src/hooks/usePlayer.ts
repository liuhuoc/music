import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capgo/capacitor-native-audio';
import type { PluginListenerHandle } from '@capacitor/core';
import type { Song } from '../data/songs';
import { getPlayUrlWithRetry, getLyric } from '../services/musicApi';
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
          handleNext();
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
            handleNext();
          } else if (event.reason === 'remotePrevious') {
            handlePrev();
          }
        }
      }).then(l => listenersRef.current.push(l));
    } else {
      // Web fallback: use HTMLAudioElement
      const audio = new Audio();
      audioRef.current = audio;

      const onTimeUpdate = () => setProgress(audio.currentTime);
      const onLoadedMetadata = () => setDuration(audio.duration || 0);
      const onEnded = () => handleNext();
      const onError = () => {
        setIsPlaying(false);
        console.warn('Audio playback error');
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
          pause();
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
        playUrl = await getPlayUrlWithRetry(Number(song.id), 2);
      } catch {
        playUrl = null;
      }
      url = playUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    }

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
        console.warn('Native audio error:', e);
        // Fallback: try network URL if local file failed
        if (downloadedItem?.filePath) {
          let fallbackUrl = url;
          try {
            const playUrl = await getPlayUrlWithRetry(Number(song.id), 1);
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
            getPlayUrlWithRetry(Number(song.id), 1)
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
        const lyric = await getLyric(Number(song.id));
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
    setDownloadList(prev => {
      const existing = prev.find(d => d.song.id === song.id);
      if (existing) {
        if (existing.status === 'paused') {
          // Trigger resume by updating status and restarting download
          const updatedList = prev.map(d =>
            d.song.id === song.id
              ? { ...d, status: 'downloading' as const }
              : d
          );

          // Restart download
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

          return updatedList;
        }
        return prev;
      }

      const newItem: DownloadItem = {
        song,
        progress: 0,
        status: 'downloading',
        addedAt: Date.now(),
        fileSize: '0 B',
      };

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

      return [...prev, newItem];
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
          console.warn('Failed to play downloaded file:', e);
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
    const totalSize = downloadList
      .filter(d => d.status === 'completed')
      .reduce((acc, d) => acc + parseFloat(d.fileSize), 0);
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
    setQueue(prev => {
      const idx = prev.findIndex(s => s.id === songId);
      if (idx < 0) return prev;
      const next = prev.filter(s => s.id !== songId);
      if (idx < queueIndex) {
        setQueueIndex(queueIndex - 1);
      } else if (idx === queueIndex && next.length > 0) {
        const nextIdx = idx % next.length;
        setQueueIndex(nextIdx);
        if (currentSong?.id === songId) {
          play(next[nextIdx]);
        }
      }
      return next;
    });
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
