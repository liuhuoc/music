import { useState, useRef, useEffect, useCallback } from 'react';
import { IconChevronDown, IconShare, IconSkipBack, IconPlay, IconPause, IconSkipForward, IconRepeat, IconRepeat1, IconShuffle, IconHeart, IconComment, IconTimer, IconList } from './Icons';
import { CommentsPanel } from './CommentsPanel';
import { TimerPanel } from './TimerPanel';
import type { Song } from '../data/songs';

interface FullPlayerProps {
  song: Song;
  isPlaying: boolean;
  progress: number;
  duration: number;
  playMode: string;
  isFavorite: boolean;
  timerActive: boolean;
  timerRemaining: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onToggleFavorite: () => void;
  onCycleMode: () => void;
  onClose: () => void;
  onOpenQueue: () => void;
  onSetTimer: (minutes: number) => void;
  onCancelTimer: () => void;
  onNavigate?: (page: string, data?: unknown) => void;
  formatTime: (s: number) => string;
}

export function FullPlayer({
  song,
  isPlaying,
  progress,
  duration,
  playMode,
  isFavorite,
  timerActive,
  timerRemaining,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onToggleFavorite,
  onCycleMode,
  onClose,
  onOpenQueue,
  onSetTimer,
  onCancelTimer,
  onNavigate,
  formatTime,
}: FullPlayerProps) {
  const [showComments, setShowComments] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);

  // Parse lyrics
  const parsedLyrics = parseLyrics(song.lyrics);
  const currentLineIndex = getCurrentLineIndex(parsedLyrics, progress);

  // Scroll lyrics to current line
  useEffect(() => {
    if (lyricsRef.current && !isDragging) {
      const lines = lyricsRef.current.querySelectorAll('.lyric-line');
      const currentLine = lines[currentLineIndex] as HTMLElement;
      if (currentLine) {
        const container = lyricsRef.current;
        const containerHeight = container.clientHeight;
        const lineTop = currentLine.offsetTop;
        const lineHeight = currentLine.clientHeight;
        container.scrollTo({
          top: lineTop - containerHeight / 2 + lineHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [currentLineIndex, isDragging]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek(pct * duration);
  }, [duration, onSeek]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    startDrag(e.clientX);
  }, [duration]);

  const handleProgressTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    startDrag(e.touches[0].clientX);
  }, [duration]);

  const startDrag = useCallback((clientX: number) => {
    setIsDragging(true);
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setDragValue(pct * duration);
  }, [duration]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    updateDrag(e.clientX);
  }, [isDragging, duration]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    updateDrag(e.touches[0].clientX);
  }, [isDragging, duration]);

  const updateDrag = useCallback((clientX: number) => {
    if (!isDragging || !progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setDragValue(pct * duration);
  }, [isDragging, duration]);

  const handleEnd = useCallback(() => {
    if (isDragging) {
      onSeek(dragValue);
      setIsDragging(false);
    }
  }, [isDragging, dragValue, onSeek]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleTouchMove, handleEnd]);

  const displayProgress = isDragging ? dragValue : progress;
  const progressPct = duration ? (displayProgress / duration) * 100 : 0;

  const ModeIcon = playMode === 'loop' ? IconRepeat : playMode === 'single' ? IconRepeat1 : IconShuffle;
  const modeLabel = playMode === 'loop' ? '列表循环' : playMode === 'single' ? '单曲循环' : '随机播放';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 900,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden',
    }}>
      {/* Blurred Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${song.cover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(60px) brightness(0.4)',
        transform: 'scale(1.2)',
      }} />

      {/* Dark Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '0 24px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            <IconChevronDown size={22} color="#fff" />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              {song.artist}
            </div>
          </div>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: song.title, text: `${song.title} - ${song.artist}` });
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            <IconShare size={20} color="#fff" />
          </button>
        </div>

        {/* Lyrics */}
        <div
          ref={lyricsRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 0',
            maskImage: 'linear-gradient(180deg, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            padding: '40% 0',
          }}>
            {parsedLyrics.map((line, i) => {
              const isCurrent = i === currentLineIndex;
              const isPast = i < currentLineIndex;
              return (
                <div
                  key={i}
                  className="lyric-line"
                  onClick={() => onSeek(line.time)}
                  style={{
                    fontSize: isCurrent ? '18px' : '15px',
                    fontWeight: isCurrent ? 700 : 400,
                    color: isCurrent ? 'var(--mint)' : isPast ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    lineHeight: 1.6,
                    padding: '4px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    textShadow: isCurrent ? '0 0 20px rgba(93,190,157,0.3)' : 'none',
                    transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {line.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div style={{
          padding: '20px 0 32px',
          flexShrink: 0,
        }}>
          {/* Progress */}
          <div style={{ marginBottom: '24px' }}>
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
              style={{
                height: '4px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{
                height: '100%',
                borderRadius: '2px',
                background: 'var(--mint)',
                width: `${progressPct}%`,
                transition: isDragging ? 'none' : 'width 0.1s linear',
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${progressPct}%`,
                transform: 'translate(-50%, -50%)',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: isDragging ? 'none' : 'left 0.1s linear',
              }} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {formatTime(displayProgress)}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Main Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}>
            <button
              onClick={onCycleMode}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ModeIcon size={20} color="rgba(255,255,255,0.7)" />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{modeLabel}</span>
            </button>

            <button
              onClick={onPrev}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              <IconSkipBack size={28} color="#fff" />
            </button>

            <button
              onClick={onTogglePlay}
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'var(--mint)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(93,190,157,0.4)',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 32px rgba(93,190,157,0.5)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(93,190,157,0.4)';
              }}
            >
              {isPlaying ? (
                <IconPause size={28} color="#fff" />
              ) : (
                <IconPlay size={28} color="#fff" />
              )}
            </button>

            <button
              onClick={onNext}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              <IconSkipForward size={28} color="#fff" />
            </button>

            <button
              onClick={onOpenQueue}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <IconList size={20} color="rgba(255,255,255,0.7)" />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>队列</span>
            </button>
          </div>

          {/* Secondary Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}>
            <button
              onClick={onToggleFavorite}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <IconHeart size={22} color={isFavorite ? 'var(--mint)' : 'rgba(255,255,255,0.6)'} fill={isFavorite} />
              <span style={{ fontSize: '10px', color: isFavorite ? 'var(--mint)' : 'rgba(255,255,255,0.4)' }}>
                {isFavorite ? '已喜欢' : '喜欢'}
              </span>
            </button>

            <button
              onClick={() => setShowComments(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <IconComment size={22} color="rgba(255,255,255,0.6)" />
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>评论</span>
            </button>

            <button
              onClick={() => setShowTimer(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                position: 'relative',
              }}
            >
              <IconTimer size={22} color={timerActive ? 'var(--mint)' : 'rgba(255,255,255,0.6)'} />
              <span style={{ fontSize: '10px', color: timerActive ? 'var(--mint)' : 'rgba(255,255,255,0.4)' }}>
                {timerActive ? formatTime(timerRemaining / 1000) : '定时'}
              </span>
              {timerActive && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--mint)',
                }} />
              )}
            </button>

            <button
              onClick={() => onNavigate?.('actionSheet', { song })}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>更多</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comments Panel */}
      {showComments && (
        <CommentsPanel onClose={() => setShowComments(false)} />
      )}

      {/* Timer Panel */}
      {showTimer && (
        <TimerPanel
          timerActive={timerActive}
          onSetTimer={onSetTimer}
          onCancelTimer={onCancelTimer}
          onClose={() => setShowTimer(false)}
        />
      )}
    </div>
  );
}

function parseLyrics(lrc: string): { time: number; text: string }[] {
  const lines = lrc.split('\n');
  const result: { time: number; text: string }[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result;
}

function getCurrentLineIndex(lyrics: { time: number }[], progress: number): number {
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (progress >= lyrics[i].time) {
      return i;
    }
  }
  return 0;
}
