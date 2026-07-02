import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { PluginListenerHandle } from '@capacitor/core';
import { usePlayer } from './hooks/usePlayer';
import { useTheme } from './hooks/useTheme';
import { HomePage } from './components/HomePage';
import { SearchPage } from './components/SearchPage';
import { FullPlayer } from './components/FullPlayer';
import { MiniPlayer } from './components/MiniPlayer';
import { QueuePage } from './components/QueuePage';
import { ActionSheet } from './components/ActionSheet';
import { DownloadPage } from './components/DownloadPage';
import { CommentsPanel } from './components/CommentsPanel';
import { TimerPanel } from './components/TimerPanel';
import { Toast } from './components/Toast';
import { debugLogger } from './utils/debugLogger';
import type { Song } from './data/songs';

type Page = 'home' | 'search' | 'queue' | 'downloads';

export default function App() {
  const { effectiveTheme, setTheme } = useTheme();
  const [page, setPage] = useState<Page>('home');
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [actionSong, setActionSong] = useState<Song | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [_pageHistory, setPageHistory] = useState<Page[]>(['home']);
  const [queueFromFullPlayer, setQueueFromFullPlayer] = useState(false);

  const player = usePlayer();
  const isNative = Capacitor.isNativePlatform();

  // 调试日志系统
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  // 订阅全局日志
  useEffect(() => {
    const removeListener = debugLogger.addListener((msg) => {
      setDebugLogs(prev => [...prev.slice(-99), msg]);
    });
    return removeListener;
  }, []);

  // 在组件 mount 时输出初始信息
  useEffect(() => {
    if (isNative) {
      debugLogger.log(`平台: Native (Capacitor)`);
      debugLogger.log(`主题: ${effectiveTheme}`);
      debugLogger.log(`WebView URL: ${window.location.href}`);
      debugLogger.log(`UserAgent: ${navigator.userAgent.substring(0, 80)}...`);
    } else {
      debugLogger.log(`平台: Web`);
    }
  }, []);

  // Native platform initialization - sync status bar with theme
  useEffect(() => {
    if (isNative) {
      const isDark = effectiveTheme === 'dark';
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: isDark ? '#0a0a1a' : '#F7F8FA' }).catch(() => {});
    }
  }, [isNative, effectiveTheme]);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const navigateTo = useCallback((targetPage: Page) => {
    setPageHistory(prev => [...prev, targetPage]);
    setPage(targetPage);
  }, []);

  const goBack = useCallback(() => {
    setPageHistory(prev => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      setPage(newHistory[newHistory.length - 1]);
      return newHistory;
    });
  }, []);

  // Android back button handler (must be after goBack declaration)
  useEffect(() => {
    if (!isNative) return;

    const handleBackButton = (_event: { canGoBack: boolean }) => {
      // Priority 1: Close overlays (innermost first)
      if (showComments) {
        setShowComments(false);
        return;
      }
      if (showTimer) {
        setShowTimer(false);
        return;
      }
      if (showActionSheet) {
        setShowActionSheet(false);
        return;
      }
      if (showQueue) {
        setShowQueue(false);
        if (queueFromFullPlayer) {
          setQueueFromFullPlayer(false);
          setShowFullPlayer(true);
        }
        return;
      }
      if (showFullPlayer) {
        setShowFullPlayer(false);
        return;
      }
      // Priority 2: Navigate back
      if (page !== 'home') {
        goBack();
        return;
      }
      // Priority 3: On home page, exit app
      CapApp.exitApp();
    };

    const listenerPromise = CapApp.addListener('backButton', handleBackButton);
    return () => {
      listenerPromise.then((l: PluginListenerHandle) => l.remove());
    };
  }, [isNative, showFullPlayer, showActionSheet, showComments, showTimer, showQueue, queueFromFullPlayer, page, goBack]);

  const handleNavigate = useCallback((target: string, data?: unknown) => {
    if (target === 'home') {
      setPage('home');
      setPageHistory(['home']);
    } else if (target === 'search') {
      navigateTo('search');
    } else if (target === 'downloads') {
      navigateTo('downloads');
    } else if (target === 'actionSheet' && data && (data as { song: Song }).song) {
      setActionSong((data as { song: Song }).song);
      setShowActionSheet(true);
    }
  }, [navigateTo]);

  const handleFullPlayerNavigate = useCallback((target: string, data?: unknown) => {
    if (target === 'actionSheet' && data && (data as { song: Song }).song) {
      setActionSong((data as { song: Song }).song);
      setShowActionSheet(true);
    }
  }, []);

  const handlePlay = useCallback((song: Song, queue?: Song[]) => {
    player.play(song, queue);
  }, [player]);

  const handleTogglePlay = useCallback(() => {
    player.togglePlay();
  }, [player]);

  const handleToggleFavorite = useCallback(() => {
    if (!actionSong) return;
    const wasFavorite = player.isFavorite(actionSong.id);
    player.toggleFavorite(actionSong.id);
    showToast(wasFavorite ? '取消收藏成功' : '收藏成功');
  }, [actionSong, player, showToast]);

  // Download: check if currently downloading
  const isSongDownloading = useCallback((songId: string) => {
    return player.downloadList.some(d => d.song.id === songId && d.status === 'downloading');
  }, [player.downloadList]);

  const handleDownload = useCallback(() => {
    if (!actionSong) return;
    const wasDownloaded = player.isDownloaded(actionSong.id);
    if (wasDownloaded) {
      player.deleteDownload(actionSong.id);
      showToast('已删除下载');
    } else if (isSongDownloading(actionSong.id)) {
      // Already downloading, ignore
      return;
    } else {
      player.startDownload(actionSong);
      showToast('开始下载...');
    }
  }, [actionSong, player, isSongDownloading, showToast]);

  const handleViewDownloads = useCallback(() => {
    setShowActionSheet(false);
    setShowFullPlayer(false);
    navigateTo('downloads');
  }, [navigateTo]);

  const handleRemove = useCallback(() => {
    if (!actionSong) return;
    player.removeFromQueue(actionSong.id);
    showToast('已从列表移除');
  }, [actionSong, player, showToast]);

  const handlePlayNext = useCallback(() => {
    if (!actionSong) return;
    player.playNext(actionSong);
    showToast('将在当前歌曲后播放');
  }, [actionSong, player, showToast]);

  const handleShare = useCallback(() => {
    if (!actionSong) return;
    if (navigator.share) {
      navigator.share({
        title: actionSong.title,
        text: `${actionSong.title} - ${actionSong.artist}`,
      });
    }
    showToast('已调起分享');
  }, [actionSong, showToast]);

  const handleComment = useCallback(() => {
    setShowActionSheet(false);
    setShowComments(true);
  }, []);

  const handleTimer = useCallback(() => {
    setShowActionSheet(false);
    setShowTimer(true);
  }, []);

  const handleFullPlayerToggleFavorite = useCallback(() => {
    if (!player.currentSong) return;
    const wasFavorite = player.isFavorite(player.currentSong.id);
    player.toggleFavorite(player.currentSong.id);
    showToast(wasFavorite ? '取消收藏成功' : '收藏成功');
  }, [player, showToast]);

  const handleQueueClose = useCallback(() => {
    setShowQueue(false);
    if (queueFromFullPlayer) {
      setQueueFromFullPlayer(false);
      setShowFullPlayer(true);
    }
    // Just close the queue overlay, stay on current page
  }, [queueFromFullPlayer]);

  const handleOpenQueueFromFullPlayer = useCallback(() => {
    setQueueFromFullPlayer(true);
    setShowQueue(true);
  }, []);

  // Play all downloaded songs
  const handlePlayAllDownloaded = useCallback(() => {
    const completedSongs = player.downloadList
      .filter(d => d.status === 'completed')
      .map(d => d.song);
    if (completedSongs.length > 0) {
      player.play(completedSongs[0], completedSongs);
      showToast(`播放全部 ${completedSongs.length} 首本地歌曲`);
    }
  }, [player, showToast]);

  const hasMiniPlayer = !!player.currentSong;

  return (
    <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '0',
        position: 'relative',
      }}>
      {/* Theme Toggle - outside phone frame */}
      {!isNative && (
        <button
          onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            transition: 'var(--transition-fast)',
          }}
          title={effectiveTheme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {effectiveTheme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      )}

      <div style={{
        width: isNative ? '100%' : '100%',
        maxWidth: isNative ? '100%' : '420px',
        height: isNative ? '100%' : '100%',
        maxHeight: isNative ? '100%' : '900px',
        background: 'var(--bg)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isNative ? 'none' : '0 0 0 12px #1a1a2e, 0 0 0 14px #333, 0 20px 60px rgba(0,0,0,0.3)',
        borderRadius: '0',
      }}>
        {/* Main Content */}
        <div style={{
          height: '100%',
          overflow: 'hidden',
          paddingBottom: hasMiniPlayer && !showFullPlayer ? '80px' : '0',
        }}>
          {page === 'home' && (
            <HomePage
              onNavigate={handleNavigate}
              currentSong={player.currentSong}
              isPlaying={player.isPlaying}
              onPlay={handlePlay}
              onTogglePlay={handleTogglePlay}
              downloadCount={player.downloadList.filter(d => d.status === 'completed').length}
            />
          )}
          {page === 'search' && (
            <SearchPage
              onNavigate={handleNavigate}
              onPlay={handlePlay}
              onTogglePlay={handleTogglePlay}
              currentSong={player.currentSong}
              isPlaying={player.isPlaying}
            />
          )}
        </div>

        {/* Mini Player */}
        {hasMiniPlayer && !showFullPlayer && page !== 'queue' && (
          <MiniPlayer
            song={player.currentSong!}
            isPlaying={player.isPlaying}
            progress={player.progress}
            duration={player.duration}
            onTogglePlay={player.togglePlay}
            onExpand={() => setShowFullPlayer(true)}
            onOpenQueue={() => {
              setQueueFromFullPlayer(false);
              setShowQueue(true);
            }}
            onSeek={player.seekTo}
            formatTime={player.formatTime}
          />
        )}

        {/* Full Player */}
        {showFullPlayer && player.currentSong && (
          <FullPlayer
            song={player.currentSong}
            isPlaying={player.isPlaying}
            progress={player.progress}
            duration={player.duration}
            playMode={player.playMode}
            isFavorite={player.currentSong ? player.isFavorite(player.currentSong.id) : false}
            timerActive={player.timerActive}
            timerRemaining={player.timerRemaining}
            onTogglePlay={player.togglePlay}
            onNext={player.handleNext}
            onPrev={player.handlePrev}
            onSeek={player.seekTo}
            onToggleFavorite={handleFullPlayerToggleFavorite}
            onCycleMode={player.cyclePlayMode}
            onClose={() => setShowFullPlayer(false)}
            onOpenQueue={handleOpenQueueFromFullPlayer}
            onSetTimer={player.setSleepTimer}
            onCancelTimer={player.cancelTimer}
            onNavigate={handleFullPlayerNavigate}
            formatTime={player.formatTime}
          />
        )}

        {/* Queue Page Overlay */}
        {showQueue && (
          <QueuePage
            queue={player.queue}
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            queueIndex={player.queueIndex}
            onClose={handleQueueClose}
            onPlay={(song) => {
              handlePlay(song, player.queue);
            }}
            onTogglePlay={handleTogglePlay}
            onRemoveFromQueue={player.removeFromQueue}
            onNavigate={handleNavigate}
          />
        )}

        {/* Action Sheet */}
        {showActionSheet && actionSong && (
          <ActionSheet
            song={actionSong}
            isFavorite={player.isFavorite(actionSong.id)}
            isDownloaded={player.isDownloaded(actionSong.id)}
            isDownloading={isSongDownloading(actionSong.id)}
            onClose={() => setShowActionSheet(false)}
            onRemove={handleRemove}
            onPlayNext={handlePlayNext}
            onToggleFavorite={handleToggleFavorite}
            onShare={handleShare}
            onComment={handleComment}
            onDownload={handleDownload}
            onViewDownloads={handleViewDownloads}
            onTimer={handleTimer}
          />
        )}

        {/* Download Page */}
        {page === 'downloads' && (
          <DownloadPage
            downloadList={player.downloadList}
            downloadStats={player.getDownloadStats()}
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            onBack={goBack}
            onPlay={(song) => handlePlay(song)}
            onTogglePlay={player.togglePlay}
            onPauseDownload={player.pauseDownload}
            onResumeDownload={player.resumeDownload}
            onCancelDownload={player.cancelDownload}
            onDeleteDownload={player.deleteDownload}
            onRetryDownload={player.retryDownload}
            onPlayAll={handlePlayAllDownloaded}
          />
        )}

        {/* Comments Panel */}
        {showComments && player.currentSong && (
          <CommentsPanel song={player.currentSong} onClose={() => setShowComments(false)} />
        )}

        {/* Timer Panel */}
        {showTimer && (
          <TimerPanel
            timerActive={player.timerActive}
            onSetTimer={player.setSleepTimer}
            onCancelTimer={player.cancelTimer}
            onClose={() => setShowTimer(false)}
          />
        )}

        {/* Toast */}
        <Toast
          message={toast.message}
          visible={toast.visible}
          onClose={hideToast}
        />

        {/* Debug Panel */}
        {isNative && (
          <>
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                zIndex: 10000,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(93, 190, 157, 0.8)',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              D
            </button>
            {showDebug && (
              <div style={{
                position: 'absolute',
                bottom: '60px',
                right: '16px',
                left: '16px',
                maxHeight: '40vh',
                background: 'rgba(0,0,0,0.9)',
                borderRadius: '12px',
                padding: '12px',
                zIndex: 10000,
                overflow: 'auto',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#0f0',
                border: '1px solid rgba(93, 190, 157, 0.3)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                  <span style={{ color: '#5DBE9D', fontWeight: 700 }}>Debug Log</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        const logText = debugLogs.join('\n');
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(logText);
                        } else {
                          const textarea = document.createElement('textarea');
                          textarea.value = logText;
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                        }
                        showToast('日志已复制到剪贴板');
                      }}
                      style={{ background: 'none', border: 'none', color: '#5DBE9D', fontSize: '10px', cursor: 'pointer' }}
                    >
                      复制
                    </button>
                    <button
                      onClick={() => {
                        debugLogger.clear();
                        setDebugLogs([]);
                      }}
                      style={{ background: 'none', border: 'none', color: '#888', fontSize: '10px', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {debugLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '2px', wordBreak: 'break-all' }}>{log}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
