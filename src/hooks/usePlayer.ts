import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capgo/capacitor-native-audio';
import type { PluginListenerHandle } from '@capacitor/core';
import type { Song } from '../data/songs';
import { getPlayUrlWithRetry, getLyric, getComments as fetchComments } from '../services/musicApi';
import type { CommentItem } from '../services/musicApi';
import { debugLogger } from '../utils/debugLogger';
import {
  downloadSong,
  deleteDownloadedFile,
  readDownloadedFile,
} from '../services/downloadService';
import type { DownloadProgress } from '../services/downloadService';

type PlayMode = 'loop' | 'single' | 'shuffle';

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

let assetIdCounter = 0;
const generateAssetId = () => `music_${Date.now()}_${++assetIdCounter}`;

const ALL_ASSET_IDS = new Set<string>();

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
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setMutedState] = useState(false);

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
  const currentAssetIdRef = useRef<string>('');
  const isSeekingRef = useRef(false);
  const progressRef = useRef(0);
  const durationRef = useRef(0);
  const volumeRef = useRef(1);
  const isMutedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const durationReadyPromiseRef = useRef<Promise<void> | null>(null);
  const durationReadyResolveRef = useRef<(() => void) | null>(null);

  const cleanupAsset = useCallback(async (id: string) => {
    if (!id) return;
    debugLogger.log(`[Player] 清理asset: ${id}`);
    try { await NativeAudio.stop({ assetId: id }); } catch (e) { debugLogger.log(`[Player] stop ${id} 失败(可忽略)`); }
    try { await NativeAudio.unload({ assetId: id }); } catch (e) { debugLogger.log(`[Player] unload ${id} 失败(可忽略)`); }
    ALL_ASSET_IDS.delete(id);
  }, []);

  const cleanupAllAssets = useCallback(async () => {
    debugLogger.log(`[Player] 清理所有assets, 当前数量: ${ALL_ASSET_IDS.size}`);
    const ids = Array.from(ALL_ASSET_IDS);
    for (const id of ids) {
      await cleanupAsset(id);
    }
  }, [cleanupAsset]);

  const resetDurationReady = useCallback(() => {
    durationReadyPromiseRef.current = new Promise<void>((resolve) => {
      durationReadyResolveRef.current = resolve;
    });
  }, []);

  const signalDurationReady = useCallback((d: number) => {
    if (d > 0 && durationReadyResolveRef.current) {
      debugLogger.log(`[Player] duration就绪: ${d.toFixed(1)}s`);
      durationReadyResolveRef.current();
      durationReadyResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    resetDurationReady();

    if (isNative) {
      NativeAudio.configure({
        focus: true,
        background: true,
        showNotification: true,
        backgroundPlayback: true,
      }).catch(() => {});

      NativeAudio.addListener('complete', (event) => {
        debugLogger.log(`[Player] 收到complete事件: assetId=${event.assetId}, current=${currentAssetIdRef.current}`);
        if (event.assetId !== currentAssetIdRef.current) {
          debugLogger.log(`[Player] 忽略旧asset的complete事件: ${event.assetId}`);
          return;
        }
        if (isSeekingRef.current) {
          debugLogger.log(`[Player] seek中，忽略complete事件`);
          return;
        }
        const timeLeft = durationRef.current - progressRef.current;
        if (timeLeft > 2) {
          debugLogger.warn(`[Player] 异常complete事件: 剩余${timeLeft.toFixed(1)}s，忽略`);
          return;
        }
        debugLogger.log('[Player] 播放完成');
        handleNextRef.current();
      }).then(l => listenersRef.current.push(l));

      NativeAudio.addListener('currentTime', (event) => {
        if (event.assetId === currentAssetIdRef.current) {
          if (!isSeekingRef.current) {
            setProgress(event.currentTime);
            progressRef.current = event.currentTime;
          }
        }
      }).then(l => listenersRef.current.push(l));

      NativeAudio.addListener('playbackState', (event) => {
        debugLogger.log(`[Player] playbackState: assetId=${event.assetId}, isPlaying=${event.isPlaying}, duration=${event.duration}, current=${currentAssetIdRef.current}`);
        if (event.assetId === currentAssetIdRef.current) {
          setIsPlaying(event.isPlaying);
          isPlayingRef.current = event.isPlaying;
          if (event.currentTime !== undefined && !isSeekingRef.current) {
            setProgress(event.currentTime);
            progressRef.current = event.currentTime;
          }
          if (event.duration !== undefined && event.duration > 0) {
            setDuration(event.duration);
            durationRef.current = event.duration;
            signalDurationReady(event.duration);
          }
          if (event.reason === 'remoteNext') {
            handleNextRef.current();
          } else if (event.reason === 'remotePrevious') {
            handlePrevRef.current();
          }
        }
      }).then(l => listenersRef.current.push(l));

      cleanupAllAssets().catch(() => {});
    } else {
      const audio = new Audio();
      audioRef.current = audio;

      const onTimeUpdate = () => {
        if (!isSeekingRef.current) {
          setProgress(audio.currentTime);
          progressRef.current = audio.currentTime;
        }
      };
      const onLoadedMetadata = () => {
        const d = audio.duration || 0;
        setDuration(d);
        durationRef.current = d;
        signalDurationReady(d);
      };
      const onEnded = () => {
        if (isSeekingRef.current) return;
        handleNextRef.current();
      };
      const onError = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
        debugLogger.error('[Player] 播放错误');
      };
      const onPlay = () => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      };
      const onPause = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);

      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.pause();
        audio.src = '';
      };
    }

    return () => {
      listenersRef.current.forEach(l => l.remove());
      listenersRef.current = [];
      downloadTimersRef.current.forEach(timer => clearInterval(timer));
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = () => {
      if (document.visibilityState === 'visible' && isNative && currentAssetIdRef.current) {
        debugLogger.log('[Player] App回到前台，同步播放状态');
        setTimeout(async () => {
          try {
            const result = await NativeAudio.isPlaying({ assetId: currentAssetIdRef.current });
            debugLogger.log(`[Player] 当前原生播放状态: isPlaying=${result.isPlaying}`);
            setIsPlaying(result.isPlaying);
            isPlayingRef.current = result.isPlaying;

            try {
              const d = await NativeAudio.getDuration({ assetId: currentAssetIdRef.current });
              if (d.duration > 0) {
                setDuration(d.duration);
                durationRef.current = d.duration;
                signalDurationReady(d.duration);
              }
            } catch {}
            try {
              const t = await NativeAudio.getCurrentTime({ assetId: currentAssetIdRef.current });
              setProgress(t.currentTime);
              progressRef.current = t.currentTime;
            } catch {}
          } catch (e) {
            debugLogger.error(`[Player] 同步状态失败: ${e instanceof Error ? e.message : String(e)}`);
          }
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleAppStateChange);
    return () => document.removeEventListener('visibilitychange', handleAppStateChange);
  }, []);

  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem('music_player_favorites');
      if (savedFavs) {
        setFavorites(new Set(JSON.parse(savedFavs)));
      }
      const savedMode = localStorage.getItem('music_player_playMode');
      if (savedMode && ['loop', 'single', 'shuffle'].includes(savedMode)) {
        setPlayMode(savedMode as PlayMode);
      }
      const savedVol = localStorage.getItem('music_player_volume');
      if (savedVol) {
        const v = parseFloat(savedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          setVolumeState(v);
          volumeRef.current = v;
        }
      }
      const savedMute = localStorage.getItem('music_player_muted');
      if (savedMute === '1') {
        setMutedState(true);
        isMutedRef.current = true;
      }

      const saved = localStorage.getItem('music_player_downloads');
      if (saved) {
        const parsed = JSON.parse(saved) as DownloadItem[];
        setDownloadList(parsed);
        const completedIds = parsed.filter(d => d.status === 'completed').map(d => d.song.id);
        setDownloads(new Set(completedIds));
      }

      const savedState = localStorage.getItem('music_player_state');
      if (savedState) {
        const state = JSON.parse(savedState);
        debugLogger.log(`[Player] 恢复状态: song=${state.currentSong?.title || 'none'}`);
        if (state.currentSong) {
          setCurrentSong(state.currentSong);
          currentSongIdRef.current = state.currentSong.id;
        }
        if (state.queue) setQueue(state.queue);
        if (state.queueIndex !== undefined) setQueueIndex(state.queueIndex);
        if (state.playMode) setPlayMode(state.playMode);

        setIsPlaying(false);
        isPlayingRef.current = false;
        setProgress(0);
        progressRef.current = 0;
        setDuration(0);
        durationRef.current = 0;

        if (isNative && state.currentSong) {
          setTimeout(async () => {
            debugLogger.log('[Player] 启动时清理原生音频...');
            try {
              if (state.assetId) {
                debugLogger.log(`[Player] 尝试恢复并清理之前的asset: ${state.assetId}`);
                try { await NativeAudio.stop({ assetId: state.assetId }); } catch {}
                try { await NativeAudio.unload({ assetId: state.assetId }); } catch {}
              }
              await cleanupAllAssets();
              debugLogger.log('[Player] 启动清理完毕');
            } catch (e) {
              debugLogger.log(`[Player] 启动清理异常(可忽略): ${e instanceof Error ? e.message : String(e)}`);
            }
          }, 1000);
        }
      }
    } catch (e) {
      debugLogger.error(`[Player] 加载状态失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('music_player_favorites', JSON.stringify([...favorites]));
    } catch {}
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem('music_player_playMode', playMode);
    } catch {}
  }, [playMode]);

  useEffect(() => {
    try {
      localStorage.setItem('music_player_volume', String(volume));
      volumeRef.current = volume;
    } catch {}
  }, [volume]);

  useEffect(() => {
    try {
      localStorage.setItem('music_player_muted', isMuted ? '1' : '0');
      isMutedRef.current = isMuted;
    } catch {}
  }, [isMuted]);

  useEffect(() => {
    try {
      localStorage.setItem('music_player_downloads', JSON.stringify(downloadList));
    } catch {}
  }, [downloadList]);

  useEffect(() => {
    try {
      if (currentSong) {
        localStorage.setItem('music_player_state', JSON.stringify({
          currentSong,
          queue,
          queueIndex,
          playMode,
          assetId: currentAssetIdRef.current,
        }));
      }
    } catch {}
  }, [currentSong, queue, queueIndex, playMode]);

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

  const setVolume = useCallback((v: number) => {
    const safe = Math.max(0, Math.min(1, v));
    setVolumeState(safe);
    if (isNative && currentAssetIdRef.current) {
      NativeAudio.setVolume({ assetId: currentAssetIdRef.current, volume: isMutedRef.current ? 0 : safe }).catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.volume = isMutedRef.current ? 0 : safe;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState(prev => {
      const next = !prev;
      if (isNative && currentAssetIdRef.current) {
        NativeAudio.setVolume({ assetId: currentAssetIdRef.current, volume: next ? 0 : volumeRef.current }).catch(() => {});
      } else if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volumeRef.current;
      }
      return next;
    });
  }, []);

  const play = useCallback(async (song: Song, songQueue?: Song[], forceRestart = false) => {
    debugLogger.log(`[Player] play()调用: ${song.title}, forceRestart=${forceRestart}, locked=${isPlayLockedRef.current}`);

    if (isPlayLockedRef.current) {
      debugLogger.log(`[Player] 播放被锁定，忽略: ${song.title}`);
      return;
    }

    if (currentSongIdRef.current === song.id && !forceRestart) {
      if (isPlayingRef.current) {
        debugLogger.log(`[Player] 同一首歌正在播放，暂停: ${song.title}`);
        try {
          if (isNative) {
            if (currentAssetIdRef.current) {
              await NativeAudio.pause({ assetId: currentAssetIdRef.current });
            }
          } else {
            audioRef.current?.pause();
          }
          setIsPlaying(false);
          isPlayingRef.current = false;
        } catch (e) {
          debugLogger.error(`[Player] 暂停失败: ${e instanceof Error ? e.message : String(e)}`);
        }
        return;
      } else {
        debugLogger.log(`[Player] 同一首歌，恢复播放: ${song.title}`);
        try {
          if (isNative) {
            if (currentAssetIdRef.current) {
              await NativeAudio.play({ assetId: currentAssetIdRef.current });
              setIsPlaying(true);
              isPlayingRef.current = true;
              return;
            } else {
              debugLogger.warn('[Player] 无assetId，无法恢复，需要重新加载');
            }
          } else {
            if (audioRef.current && audioRef.current.src) {
              await audioRef.current.play();
              setIsPlaying(true);
              isPlayingRef.current = true;
              return;
            } else {
              debugLogger.warn('[Player] web audio无src，需要重新加载');
            }
          }
        } catch (e) {
          debugLogger.error(`[Player] 恢复播放失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    isPlayLockedRef.current = true;

    const oldAssetId = currentAssetIdRef.current;
    debugLogger.log(`[Player] 准备播放新歌曲: ${song.title} - ${song.artist} (id: ${song.id}, oldAsset: ${oldAssetId || 'none'})`);

    resetDurationReady();

    setCurrentSong(song);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setProgress(0);
    setDuration(0);
    progressRef.current = 0;
    durationRef.current = 0;
    currentSongIdRef.current = song.id;
    currentAssetIdRef.current = '';

    if (songQueue) {
      setQueue(songQueue);
      const idx = songQueue.findIndex(s => s.id === song.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    }

    try {
      await cleanupAllAssets();
      debugLogger.log(`[Player] 旧assets已清理`);

      const newAssetId = generateAssetId();
      currentAssetIdRef.current = newAssetId;
      ALL_ASSET_IDS.add(newAssetId);
      debugLogger.log(`[Player] 新assetId: ${newAssetId}`);

      let url: string | null = null;

      const downloadedItem = downloadList.find(d => d.song.id === song.id && d.status === 'completed');
      if (downloadedItem?.filePath) {
        if (isNative) {
          const blobUrl = await readDownloadedFile(song);
          url = blobUrl || null;
        } else {
          url = downloadedItem.filePath;
        }
        if (url) {
          debugLogger.log(`[Player] 使用本地下载文件: ${song.title}`);
        }
      }

      if (!url) {
        debugLogger.log(`[Player] 获取在线URL: ${song.title}`);
        url = await getPlayUrlWithRetry(song, 2);
      }

      if (!url) {
        debugLogger.error(`[Player] 无法获取播放URL: ${song.title}`);
        setIsPlaying(false);
        isPlayingRef.current = false;
        isPlayLockedRef.current = false;
        currentSongIdRef.current = null;
        currentAssetIdRef.current = '';
        ALL_ASSET_IDS.delete(newAssetId);
        return;
      }

      if (currentSongIdRef.current !== song.id || currentAssetIdRef.current !== newAssetId) {
        debugLogger.log(`[Player] 歌曲已切换，取消当前播放: ${song.title}`);
        await cleanupAsset(newAssetId);
        isPlayLockedRef.current = false;
        return;
      }

      currentUrlRef.current = url;
      debugLogger.log(`[Player] 播放URL: ${url.substring(0, 80)}...`);

      if (isNative) {
        debugLogger.log(`[Player] preload asset: ${newAssetId}`);
        await NativeAudio.preload({
          assetId: newAssetId,
          assetPath: url,
          isUrl: true,
          volume: isMutedRef.current ? 0 : volumeRef.current,
          notificationMetadata: {
            title: song.title,
            artist: song.artist,
            album: song.album,
            artworkUrl: song.cover,
          },
        });

        let gotDuration = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            await new Promise(r => setTimeout(r, 300));
            const dur = await NativeAudio.getDuration({ assetId: newAssetId });
            if (dur.duration > 0) {
              setDuration(dur.duration);
              durationRef.current = dur.duration;
              signalDurationReady(dur.duration);
              gotDuration = true;
              debugLogger.log(`[Player] 歌曲时长(第${attempt+1}次): ${dur.duration.toFixed(1)}s`);
              break;
            }
          } catch (e) {
            debugLogger.log(`[Player] 获取duration失败(第${attempt+1}次): ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        if (!gotDuration) {
          debugLogger.warn(`[Player] preload后无法立即获取duration，等待playbackState事件`);
        }

        if (currentSongIdRef.current !== song.id || currentAssetIdRef.current !== newAssetId) {
          await cleanupAsset(newAssetId);
          isPlayLockedRef.current = false;
          return;
        }

        debugLogger.log(`[Player] 开始播放: ${newAssetId}`);
        await NativeAudio.play({ assetId: newAssetId });
        setIsPlaying(true);
        isPlayingRef.current = true;
        debugLogger.log(`[Player] 播放命令已发送: ${song.title}`);

        if (!gotDuration) {
          for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise(r => setTimeout(r, 500));
            try {
              const dur = await NativeAudio.getDuration({ assetId: newAssetId });
              if (dur.duration > 0) {
                setDuration(dur.duration);
                durationRef.current = dur.duration;
                signalDurationReady(dur.duration);
                debugLogger.log(`[Player] play后获取duration: ${dur.duration.toFixed(1)}s`);
                break;
              }
            } catch {}
          }
        }
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.pause();
          audio.src = url;
          audio.volume = isMutedRef.current ? 0 : volumeRef.current;
          audio.currentTime = 0;
          await audio.play();
        }
      }

      if (song.lyrics === '[00:00.00]歌词加载中...') {
        getLyric(song).then(lyric => {
          setCurrentSong(prev => prev && prev.id === song.id ? { ...prev, lyrics: lyric } : prev);
        }).catch(() => {});
      }
    } catch (e) {
      debugLogger.error(`[Player] 播放错误: ${e instanceof Error ? e.message : String(e)}`);
      setIsPlaying(false);
      isPlayingRef.current = false;
    } finally {
      isPlayLockedRef.current = false;
    }
  }, [downloadList, cleanupAsset, cleanupAllAssets, resetDurationReady, signalDurationReady]);

  const togglePlay = useCallback(async () => {
    if (!currentSong) return;
    debugLogger.log(`[Player] togglePlay: isPlaying=${isPlayingRef.current}, hasAsset=${!!currentAssetIdRef.current}`);

    try {
      if (isPlayingRef.current) {
        if (isNative) {
          if (currentAssetIdRef.current) {
            await NativeAudio.pause({ assetId: currentAssetIdRef.current });
          }
        } else {
          audioRef.current?.pause();
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else {
        if (isNative) {
          if (currentAssetIdRef.current) {
            await NativeAudio.play({ assetId: currentAssetIdRef.current });
            setIsPlaying(true);
            isPlayingRef.current = true;
          } else {
            debugLogger.warn('[Player] togglePlay: 无assetId，无法播放');
          }
        } else {
          if (audioRef.current && audioRef.current.src) {
            await audioRef.current.play();
          } else if (currentSong) {
            play(currentSong, queue);
            return;
          }
        }
      }
    } catch (e) {
      debugLogger.error(`[Player] togglePlay错误: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [currentSong, queue, play]);

  const pause = useCallback(async () => {
    debugLogger.log(`[Player] pause called`);
    if (isNative) {
      if (currentAssetIdRef.current) {
        try { await NativeAudio.pause({ assetId: currentAssetIdRef.current }); } catch {}
      }
    } else {
      audioRef.current?.pause();
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
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
      debugLogger.log(`[Player] 下一首: ${nextSong.title} (index=${nextIndex})`);
      setQueueIndex(nextIndex);
      play(nextSong, undefined, playMode === 'single');
    }
  }, [queue, queueIndex, playMode, currentSong, play]);

  const handlePrev = useCallback(async () => {
    if (queue.length === 0 || !currentSong) return;

    if (progressRef.current < 3) {
      debugLogger.log(`[Player] 回到开头`);
      if (isNative && currentAssetIdRef.current) {
        try { await NativeAudio.setCurrentTime({ assetId: currentAssetIdRef.current, time: 0 }); } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
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
      debugLogger.log(`[Player] 上一首: ${prevSong.title} (index=${prevIndex})`);
      setQueueIndex(prevIndex);
      play(prevSong);
    }
  }, [queue, queueIndex, playMode, currentSong, play]);

  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
    pauseRef.current = pause;
  }, [handleNext, handlePrev, pause]);

  const seekTo = useCallback(async (time: number) => {
    debugLogger.log(`[Player] seekTo: time=${time.toFixed(2)}, duration=${durationRef.current}, assetId=${currentAssetIdRef.current}`);

    if (isNative && !currentAssetIdRef.current) {
      debugLogger.warn('[Player] seek失败: 无assetId');
      return;
    }

    if (durationRef.current <= 0) {
      debugLogger.log(`[Player] seek: duration无效(${durationRef.current})，尝试获取...`);

      if (durationReadyPromiseRef.current) {
        debugLogger.log('[Player] seek: 等待duration就绪...');
        try {
          await Promise.race([
            durationReadyPromiseRef.current,
            new Promise(resolve => setTimeout(resolve, 2000))
          ]);
        } catch {}
      }

      if (durationRef.current <= 0 && isNative && currentAssetIdRef.current) {
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const d = await NativeAudio.getDuration({ assetId: currentAssetIdRef.current });
            if (d.duration > 0) {
              durationRef.current = d.duration;
              setDuration(d.duration);
              signalDurationReady(d.duration);
              debugLogger.log(`[Player] seek: 获取到duration=${d.duration.toFixed(1)}`);
              break;
            }
          } catch (e) {
            debugLogger.log(`[Player] seek: 获取duration失败(第${attempt+1}次)`);
          }
          await new Promise(r => setTimeout(r, 200));
        }
      } else if (!isNative && audioRef.current) {
        const d = audioRef.current.duration;
        if (d > 0) {
          durationRef.current = d;
          setDuration(d);
        }
      }
    }

    if (durationRef.current <= 0) {
      debugLogger.warn(`[Player] seek失败: 仍无法获取duration，使用time=${time}直接seek`);
    }

    let safeTime: number;
    if (durationRef.current > 0) {
      safeTime = Math.max(0, Math.min(time, durationRef.current - 1));
    } else {
      safeTime = Math.max(0, time);
    }

    debugLogger.log(`[Player] seek: safeTime=${safeTime.toFixed(2)}`);
    isSeekingRef.current = true;
    setProgress(safeTime);
    progressRef.current = safeTime;

    try {
      if (isNative) {
        if (currentAssetIdRef.current) {
          await NativeAudio.setCurrentTime({ assetId: currentAssetIdRef.current, time: safeTime });
          debugLogger.log(`[Player] seek成功: ${safeTime.toFixed(1)}s`);
        }
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = safeTime;
          debugLogger.log(`[Player] seek成功(web): ${safeTime.toFixed(1)}s`);
        }
      }
    } catch (e) {
      debugLogger.error(`[Player] seek失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTimeout(() => { isSeekingRef.current = false; }, 2000);
    }
  }, [signalDurationReady]);

  const toggleFavorite = useCallback((songId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(songId)) { next.delete(songId); } else { next.add(songId); }
      return next;
    });
  }, []);

  const isFavorite = useCallback((songId: string) => favorites.has(songId), [favorites]);

  const startDownload = useCallback((song: Song) => {
    let shouldStart = false;

    setDownloadList(prev => {
      const existing = prev.find(d => d.song.id === song.id);
      if (existing) {
        if (existing.status === 'paused' || existing.status === 'failed') {
          shouldStart = true;
          return prev.map(d =>
            d.song.id === song.id
              ? { ...d, status: 'downloading' as const, progress: 0, sizeBytes: 0, fileSize: '0 B' }
              : d
          );
        }
        return prev;
      }
      shouldStart = true;
      return [...prev, {
        song, progress: 0, status: 'downloading', addedAt: Date.now(),
        fileSize: '0 B', sizeBytes: 0,
      }];
    });

    if (!shouldStart) return;

    const controller = new AbortController();
    abortControllersRef.current.set(song.id, controller);

    downloadSong(song, (p: DownloadProgress) => {
      setDownloadList(current => current.map(d => {
        if (d.song.id !== p.songId) return d;
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
          setDownloads(prevD => new Set(prevD).add(song.id));
        } else if (p.status === 'failed') {
          abortControllersRef.current.delete(song.id);
        }
        return updated;
      }));
    });
  }, []);

  const pauseDownload = useCallback((songId: string) => {
    const controller = abortControllersRef.current.get(songId);
    if (controller) { controller.abort(); abortControllersRef.current.delete(songId); }
    setDownloadList(prev => prev.map(d =>
      d.song.id === songId && d.status === 'downloading' ? { ...d, status: 'paused' as const } : d
    ));
  }, []);

  const resumeDownload = useCallback((songId: string) => {
    const item = downloadList.find(d => d.song.id === songId);
    if (item) startDownload(item.song);
  }, [downloadList, startDownload]);

  const cancelDownload = useCallback((songId: string) => {
    const controller = abortControllersRef.current.get(songId);
    if (controller) { controller.abort(); abortControllersRef.current.delete(songId); }
    setDownloadList(prev => prev.filter(d => d.song.id !== songId));
    setDownloads(prev => { const n = new Set(prev); n.delete(songId); return n; });
  }, []);

  const deleteDownload = useCallback(async (songId: string) => {
    const item = downloadList.find(d => d.song.id === songId);
    if (item) await deleteDownloadedFile(item.song).catch(() => {});
    setDownloadList(prev => prev.filter(d => d.song.id !== songId));
    setDownloads(prev => { const n = new Set(prev); n.delete(songId); return n; });
  }, [downloadList]);

  const retryDownload = useCallback((songId: string) => {
    const item = downloadList.find(d => d.song.id === songId);
    if (item) startDownload(item.song);
  }, [downloadList, startDownload]);

  const playDownloaded = useCallback(async (song: Song) => {
    play(song);
  }, [play]);

  const isDownloaded = useCallback((songId: string) => downloads.has(songId), [downloads]);

  const getDownloadStats = useCallback(() => {
    const downloading = downloadList.filter(d => d.status === 'downloading').length;
    const completed = downloadList.filter(d => d.status === 'completed').length;
    const paused = downloadList.filter(d => d.status === 'paused').length;
    const totalBytes = downloadList.filter(d => d.status === 'completed').reduce((a, d) => a + (d.sizeBytes || 0), 0);
    return { downloading, completed, paused, totalSize: totalBytes / (1024 * 1024), total: downloadList.length };
  }, [downloadList]);

  const toggleDownload = useCallback((song: Song) => {
    if (downloads.has(song.id)) { deleteDownload(song.id); } else { startDownload(song); }
  }, [downloads, startDownload, deleteDownload]);

  const cyclePlayMode = useCallback(() => {
    setPlayMode(prev => {
      const modes: PlayMode[] = ['loop', 'single', 'shuffle'];
      return modes[(modes.indexOf(prev) + 1) % modes.length];
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
      if (idx < queueIndex) { newQueueIndex = queueIndex - 1; }
      else if (idx === queueIndex && next.length > 0) {
        newQueueIndex = idx % next.length;
        if (currentSong?.id === songId) { shouldPlayNext = true; nextSong = next[newQueueIndex]; }
      }
      return next;
    });

    if (newQueueIndex !== queueIndex) setQueueIndex(newQueueIndex);
    if (shouldPlayNext && nextSong) play(nextSong);
  }, [queueIndex, currentSong, play]);

  const playNext = useCallback((song: Song) => {
    setQueue(prev => {
      const idx = prev.findIndex(s => s.id === song.id);
      let next = [...prev];
      if (idx >= 0) next.splice(idx, 1);
      next.splice(queueIndex + 1, 0, song);
      return next;
    });
  }, [queueIndex]);

  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const loadComments = useCallback(async (song: Song, limit: number = 30): Promise<CommentItem[]> => {
    try { return await fetchComments(song, limit); } catch { return []; }
  }, []);

  return {
    currentSong, isPlaying, progress, duration, queue, queueIndex, playMode,
    timerActive, timerRemaining, volume, isMuted,
    favorites, downloads, downloadList,
    play, togglePlay, pause, handleNext, handlePrev, seekTo,
    toggleFavorite, isFavorite, setVolume, toggleMute,
    toggleDownload, isDownloaded,
    startDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload, retryDownload,
    playDownloaded, getDownloadStats, loadComments,
    cyclePlayMode, setSleepTimer, cancelTimer,
    removeFromQueue, playNext, formatTime,
    setQueue, setQueueIndex,
  };
}
