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

let assetIdCounter = 0;
const generateAssetId = () => `music_player_${Date.now()}_${++assetIdCounter}`;

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
  const isPlayLockedRef = useRef(false);
  const currentSongIdRef = useRef<string | null>(null);
  const isSeekingRef = useRef(false);
  const isRestoringRef = useRef(false);
  const currentAssetIdRef = useRef<string>('');
  const progressRef = useRef(0);
  const durationRef = useRef(0);

  // Initialize native audio
  useEffect(() => {
    if (isNative) {
      NativeAudio.configure({
        focus: true,
        background: true,
        showNotification: true,
        backgroundPlayback: true,
      }).catch(() => {});

      // Don't stop previous audio here - let it continue playing if app is restored from background
      // We'll sync state from localStorage and check if audio is actually playing

      // Listen for playback completion
      NativeAudio.addListener('complete', (event) => {
        if (event.assetId !== currentAssetIdRef.current) {
          debugLogger.log(`[Player] 忽略旧asset的complete事件: ${event.assetId}`);
          return;
        }
        if (isSeekingRef.current) {
          debugLogger.log('[Player] seek期间忽略complete事件');
          return;
        }
        const timeLeft = durationRef.current - progressRef.current;
        if (timeLeft > 5) {
          debugLogger.warn(`[Player] 异常complete事件: 剩余${timeLeft.toFixed(1)}s，忽略`);
          return;
        }
        debugLogger.log('[Player] 播放完成，切换下一首');
        handleNextRef.current();
      }).then(l => listenersRef.current.push(l));

      // Listen for current time updates (100ms)
      NativeAudio.addListener('currentTime', (event) => {
        if (event.assetId === currentAssetIdRef.current) {
          setProgress(event.currentTime);
          progressRef.current = event.currentTime;
        }
      }).then(l => listenersRef.current.push(l));

      // Listen for playback state changes (lock screen controls)
      NativeAudio.addListener('playbackState', (event) => {
        if (event.assetId === currentAssetIdRef.current) {
          setIsPlaying(event.isPlaying);
          if (event.currentTime !== undefined) {
            setProgress(event.currentTime);
            progressRef.current = event.currentTime;
          }
          if (event.duration !== undefined) {
            setDuration(event.duration);
            durationRef.current = event.duration;
          }
          // Handle remote controls
          if (event.reason === 'remoteNext') {
            debugLogger.log('[Player] 远程控制: 下一首');
            handleNextRef.current();
          } else if (event.reason === 'remotePrevious') {
            debugLogger.log('[Player] 远程控制: 上一首');
            handlePrevRef.current();
          }
        }
      }).then(l => listenersRef.current.push(l));
    } else {
      // Web fallback: use HTMLAudioElement
      const audio = new Audio();
      audioRef.current = audio;

      const onTimeUpdate = () => {
        setProgress(audio.currentTime);
        progressRef.current = audio.currentTime;
      };
      const onLoadedMetadata = () => {
        setDuration(audio.duration || 0);
        durationRef.current = audio.duration || 0;
      };
      const onEnded = () => {
        if (isSeekingRef.current) {
          debugLogger.log('[Player] seek期间忽略ended事件');
          return;
        }
        const timeLeft = durationRef.current - progressRef.current;
        if (timeLeft > 5) {
          debugLogger.warn(`[Player] 异常ended事件: 剩余${timeLeft.toFixed(1)}s，忽略`);
          return;
        }
        handleNextRef.current();
      };
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

  // Load download list from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('music_player_downloads');
      if (saved) {
        const parsed = JSON.parse(saved) as DownloadItem[];
        setDownloadList(parsed);
        const completedIds = parsed.filter(d => d.status === 'completed').map(d => d.song.id);
        setDownloads(new Set(completedIds));
        debugLogger.log(`[Player] 已加载下载列表: ${parsed.length} 项`);
      }
    } catch (e) {
      debugLogger.error(`[Player] 加载下载列表失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // Persist download list to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('music_player_downloads', JSON.stringify(downloadList));
    } catch (e) {
      debugLogger.error(`[Player] 保存下载列表失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [downloadList]);

  // Restore playback state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('music_player_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.currentSong) {
          setCurrentSong(state.currentSong);
          currentSongIdRef.current = state.currentSong.id;
        }
        if (state.queue) setQueue(state.queue);
        if (state.queueIndex !== undefined) setQueueIndex(state.queueIndex);
        if (state.playMode) setPlayMode(state.playMode);
        debugLogger.log('[Player] 已从本地存储恢复播放状态');

        // Check if native audio is actually playing
        if (isNative && state.currentSong) {
          isRestoringRef.current = true;
          // Try the old static ID first (for backward compatibility)
          const legacyAssetId = 'music_player_current';
          Promise.all([
            NativeAudio.isPlaying({ assetId: legacyAssetId }).catch(() => ({ isPlaying: false })),
            NativeAudio.getDuration({ assetId: legacyAssetId }).catch(() => ({ duration: 0 })),
            NativeAudio.getCurrentTime({ assetId: legacyAssetId }).catch(() => ({ currentTime: 0 })),
          ]).then(([playResult, durResult, timeResult]) => {
            if (playResult.isPlaying) {
              debugLogger.log('[Player] 检测到原生音频正在播放，使用旧assetId同步状态');
              currentAssetIdRef.current = legacyAssetId;
              setIsPlaying(true);
              if (durResult.duration > 0) {
                setDuration(durResult.duration);
                durationRef.current = durResult.duration;
              }
              if (timeResult.currentTime !== undefined) {
                setProgress(timeResult.currentTime);
                progressRef.current = timeResult.currentTime;
              }
            } else {
              debugLogger.log('[Player] 原生音频未播放，保持暂停状态');
            }
            isRestoringRef.current = false;
          }).catch(() => {
            isRestoringRef.current = false;
          });
        }
      }
    } catch (e) {
      debugLogger.error(`[Player] 恢复播放状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // Persist playback state to localStorage
  useEffect(() => {
    try {
      const state = {
        currentSong,
        queue,
        queueIndex,
        playMode,
      };
      localStorage.setItem('music_player_state', JSON.stringify(state));
    } catch (e) {
      debugLogger.error(`[Player] 保存播放状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [currentSong, queue, queueIndex, playMode]);

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

  const play = useCallback(async (song: Song, songQueue?: Song[], forceRestart = false) => {
    // Prevent reentrant play calls
    if (isPlayLockedRef.current) {
      debugLogger.log(`[Player] 播放被锁定，忽略: ${song.title}`);
      return;
    }

    // If same song is already loaded and not forcing restart, just resume
    if (currentSongIdRef.current === song.id && currentSong && !forceRestart && currentAssetIdRef.current) {
      debugLogger.log(`[Player] 同一首歌，恢复播放: ${song.title}`);
      if (isNative) {
        await NativeAudio.play({ assetId: currentAssetIdRef.current }).catch(() => {});
      } else {
        audioRef.current?.play().catch(() => {});
      }
      setIsPlaying(true);
      return;
    }

    isPlayLockedRef.current = true;
    currentSongIdRef.current = song.id;

    // Generate new asset ID for each new song to avoid stale state issues
    const newAssetId = generateAssetId();
    const oldAssetId = currentAssetIdRef.current;
    currentAssetIdRef.current = newAssetId;

    debugLogger.log(`[Player] 播放: ${song.title} - ${song.artist} (source: ${song.source}, id: ${song.id}, asset: ${newAssetId})`);

    // Set initial UI state immediately
    setCurrentSong(song);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    progressRef.current = 0;
    durationRef.current = 0;

    if (songQueue) {
      setQueue(songQueue);
      const idx = songQueue.findIndex(s => s.id === song.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    }

    try {
      let url: string | null = null;

      // Check if song is downloaded locally
      const downloadedItem = downloadList.find(d => d.song.id === song.id && d.status === 'completed');
      if (downloadedItem?.filePath) {
        if (isNative) {
          const blobUrl = await readDownloadedFile(song);
          url = blobUrl || null;
        } else {
          url = downloadedItem.filePath;
        }
      }

      // If no local file, get play URL from API
      if (!url) {
        url = await getPlayUrlWithRetry(song, 2);
      }

      if (!url) {
        debugLogger.error(`[Player] 无法获取播放URL: ${song.title}`);
        setIsPlaying(false);
        isPlayLockedRef.current = false;
        currentAssetIdRef.current = oldAssetId;
        return;
      }

      // Check if user already switched to another song during URL fetch
      if (currentSongIdRef.current !== song.id || currentAssetIdRef.current !== newAssetId) {
        debugLogger.log(`[Player] 用户已切换歌曲，取消播放: ${song.title}`);
        isPlayLockedRef.current = false;
        return;
      }

      debugLogger.log(`[Player] 播放URL: ${url.substring(0, 80)}...`);
      currentUrlRef.current = url;

      if (isNative) {
        // Stop and unload previous audio first (with old asset ID)
        if (oldAssetId) {
          NativeAudio.stop({ assetId: oldAssetId }).catch(() => {});
          NativeAudio.unload({ assetId: oldAssetId }).catch(() => {});
        }
        // Also try to clean up any leftover with the old static ID
        NativeAudio.stop({ assetId: 'music_player_current' }).catch(() => {});
        NativeAudio.unload({ assetId: 'music_player_current' }).catch(() => {});
        await new Promise(r => setTimeout(r, 100));

        // Preload new audio with new asset ID
        await NativeAudio.preload({
          assetId: newAssetId,
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
        const dur = await NativeAudio.getDuration({ assetId: newAssetId });
        setDuration(dur.duration);
        durationRef.current = dur.duration;

        // Double-check we're still playing this song
        if (currentSongIdRef.current !== song.id || currentAssetIdRef.current !== newAssetId) {
          debugLogger.log(`[Player] 歌曲已切换，取消播放: ${song.title}`);
          NativeAudio.unload({ assetId: newAssetId }).catch(() => {});
          isPlayLockedRef.current = false;
          return;
        }

        // Start playback
        await NativeAudio.play({ assetId: newAssetId });
        setIsPlaying(true);
      } else {
        // Web fallback
        const audio = audioRef.current;
        if (audio) {
          audio.src = url;
          audio.volume = isMuted ? 0 : volume;
          await audio.play();
          setIsPlaying(true);
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
    } catch (e) {
      debugLogger.error(`[Player] 播放错误: ${e instanceof Error ? e.message : String(e)}`);
      setIsPlaying(false);
    } finally {
      isPlayLockedRef.current = false;
    }
  }, [volume, isMuted, downloadList, currentSong]);

  const togglePlay = useCallback(async () => {
    if (!currentSong) return;

    if (isNative) {
      if (!currentAssetIdRef.current) return;
      try {
        if (isPlaying) {
          await NativeAudio.pause({ assetId: currentAssetIdRef.current });
          setIsPlaying(false);
        } else {
          await NativeAudio.resume({ assetId: currentAssetIdRef.current });
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
      if (currentAssetIdRef.current) {
        try {
          await NativeAudio.pause({ assetId: currentAssetIdRef.current });
        } catch {}
      }
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
      const forceRestart = playMode === 'single';
      play(nextSong, undefined, forceRestart);
      setQueueIndex(nextIndex);
    }
  }, [queue, queueIndex, playMode, currentSong, play]);

  const handlePrev = useCallback(async () => {
    if (queue.length === 0 || !currentSong) return;

    if (progress < 3) {
      if (isNative && currentAssetIdRef.current) {
        try {
          await NativeAudio.setCurrentTime({ assetId: currentAssetIdRef.current, time: 0 });
        } catch {}
      } else {
        const audio = audioRef.current;
        if (audio) audio.currentTime = 0;
      }
      setProgress(0);
      progressRef.current = 0;
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
    if (!durationRef.current || durationRef.current <= 0) {
      debugLogger.warn('[Player] seek失败: duration无效');
      return;
    }
    if (isNative && !currentAssetIdRef.current) return;

    const safeTime = Math.max(0, Math.min(time, Math.max(0, durationRef.current - 2)));
    debugLogger.log(`[Player] seekTo: ${time.toFixed(2)}s -> ${safeTime.toFixed(2)}s (duration: ${durationRef.current.toFixed(2)}s)`);

    isSeekingRef.current = true;

    try {
      if (isNative) {
        await NativeAudio.setCurrentTime({ assetId: currentAssetIdRef.current, time: safeTime });
        setProgress(safeTime);
        progressRef.current = safeTime;
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = safeTime;
          setProgress(safeTime);
          progressRef.current = safeTime;
        }
      }
    } catch (e) {
      debugLogger.error(`[Player] seek 失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTimeout(() => {
        isSeekingRef.current = false;
        debugLogger.log('[Player] seek完成，解除complete事件屏蔽');
      }, 1000);
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

  // 播放已下载的文件 - 委托给 play 函数
  const playDownloaded = useCallback(async (song: Song) => {
    // 直接调用 play 函数，它会检查下载缓存
    play(song);
  }, [play]);

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
