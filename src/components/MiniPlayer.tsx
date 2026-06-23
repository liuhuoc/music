import { useState, useEffect, useRef } from 'react';
import { IconPlay, IconPause, IconList } from './Icons';
import type { Song } from '../data/songs';

interface MiniPlayerProps {
  song: Song;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlay: () => void;
  onExpand: () => void;
  onOpenQueue: () => void;
  onSeek: (time: number) => void;
  formatTime: (s: number) => string;
}

export function MiniPlayer({ song, isPlaying, progress, duration, onTogglePlay, onExpand, onOpenQueue, onSeek }: MiniPlayerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressPct = duration ? (progress / duration) * 100 : 0;
  const displayPct = isDragging ? (dragValue / duration) * 100 : progressPct;

  // Auto-expand when playing, keep expanded while song exists
  useEffect(() => {
    setIsExpanded(true);
  }, []);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek(pct * duration);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    startDrag(e.clientX);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(touch.clientX);
  };

  const startDrag = (clientX: number) => {
    setIsDragging(true);
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setDragValue(pct * duration);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => updateDrag(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      updateDrag(e.touches[0].clientX);
    };
    const handleEnd = () => {
      onSeek(dragValue);
      setIsDragging(false);
    };
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
  }, [isDragging, dragValue, duration, onSeek]);

  const updateDrag = (clientX: number) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setDragValue(pct * duration);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isPlaying) {
      expandTimerRef.current = setTimeout(() => setIsExpanded(false), 800);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(8px + var(--safe-area-bottom))',
        left: '16px',
        right: '16px',
        zIndex: 500,
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        inset: '-4px',
        borderRadius: '40px',
        background: isPlaying
          ? 'linear-gradient(135deg, rgba(93,190,157,0.25), rgba(93,190,157,0.08))'
          : 'rgba(93,190,157,0.06)',
        filter: 'blur(12px)',
        transition: 'all 0.5s ease',
        opacity: isPlaying ? 1 : 0.5,
        animation: isPlaying ? 'dynamicIslandGlow 3s ease-in-out infinite' : 'none',
      }} />

      {/* Main capsule */}
      <div
        onClick={onExpand}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: isExpanded ? '10px 14px' : '8px 14px',
          background: isHovered
            ? 'rgba(18,18,35,0.7)'
            : 'rgba(12,12,28,0.55)',
          backdropFilter: 'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          borderRadius: '40px',
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: isHovered
            ? '0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)'
            : '0 4px 24px rgba(0,0,0,0.2), 0 1px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar background (thin line at bottom) */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2.5px',
          background: 'rgba(93,190,157,0.1)',
          borderRadius: '0 0 40px 40px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${displayPct}%`,
            background: 'linear-gradient(90deg, var(--mint), var(--mint-dark))',
            borderRadius: '0 0 40px 40px',
            transition: isDragging ? 'none' : 'width 0.3s linear',
          }} />
        </div>

        {/* Cover */}
        <div style={{
          position: 'relative',
          flexShrink: 0,
          width: isExpanded ? '42px' : '38px',
          height: isExpanded ? '42px' : '38px',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <img
            src={song.cover}
            alt={song.title}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--mint)',
              animation: isPlaying ? 'spin 8s linear infinite' : 'none',
              boxShadow: '0 2px 8px rgba(93,190,157,0.2)',
            }}
          />
          {/* Animated ring */}
          {isPlaying && (
            <div style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '50%',
              border: '1.5px solid var(--mint)',
              opacity: 0.3,
              animation: 'pulseRing 2s ease-in-out infinite',
            }} />
          )}
        </div>

        {/* Info + Progress */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.3,
          }} className="line-clamp-1">
            {song.title}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.3,
          }} className="line-clamp-1">
            {song.artist}
          </div>
          {/* Expanded progress bar */}
          {isExpanded && (
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
              style={{
                marginTop: '5px',
                height: '3px',
                borderRadius: '2px',
                background: 'rgba(93,190,157,0.12)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{
                height: '100%',
                borderRadius: '2px',
                background: 'linear-gradient(90deg, var(--mint), var(--mint-dark))',
                width: `${displayPct}%`,
                transition: isDragging ? 'none' : 'width 0.3s linear',
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${displayPct}%`,
                transform: 'translate(-50%, -50%)',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                transition: isDragging ? 'none' : 'left 0.3s linear',
                opacity: isDragging ? 1 : 0,
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${displayPct}%`,
                transform: 'translate(-50%, -50%)',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--mint)',
                boxShadow: '0 0 6px rgba(93,190,157,0.4)',
                transition: isDragging ? 'none' : 'left 0.3s linear',
              }} />
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          flexShrink: 0,
        }}>
          {/* Play/Pause */}
          <button
            onClick={e => {
              e.stopPropagation();
              onTogglePlay();
            }}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: isPlaying
                ? 'linear-gradient(135deg, var(--mint), var(--mint-dark))'
                : 'rgba(255,255,255,0.12)',
              border: isPlaying ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isPlaying
                ? '0 2px 10px rgba(93,190,157,0.35)'
                : 'var(--shadow-sm)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: isPlaying ? 'scale(1)' : 'scale(0.95)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = isPlaying ? 'scale(1)' : 'scale(0.95)';
            }}
          >
            {isPlaying ? (
              <IconPause size={14} color="#fff" />
            ) : (
              <IconPlay size={14} color="#fff" />
            )}
          </button>

          {/* Queue */}
          <button
            onClick={e => {
              e.stopPropagation();
              onOpenQueue();
            }}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
          >
            <IconList size={16} color="rgba(255,255,255,0.6)" />
          </button>
        </div>
      </div>
    </div>
  );
}
