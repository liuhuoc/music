import { useState, useRef, useEffect } from 'react';
import { IconMore, Equalizer, IconLocate, IconTrash2, IconX } from './Icons';
import type { Song } from '../data/songs';

interface QueuePageProps {
  queue: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  queueIndex: number;
  onClose: () => void;
  onPlay: (song: Song) => void;
  onRemoveFromQueue: (songId: string) => void;
  onNavigate: (page: string, data?: unknown) => void;
}

export function QueuePage({ queue, currentSong, isPlaying, queueIndex, onClose, onPlay, onRemoveFromQueue, onNavigate }: QueuePageProps) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const startYRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Scroll to current song on mount
  useEffect(() => {
    if (listRef.current && queue.length > 0) {
      const items = listRef.current.querySelectorAll('[data-song-id]');
      let target: Element | null = null;
      if (currentSong) {
        target = Array.from(items).find(el => el.getAttribute('data-song-id') === currentSong.id) || null;
      }
      if (!target && queueIndex >= 0 && queueIndex < items.length) {
        target = items[queueIndex];
      }
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = clientY - startYRef.current;
    if (delta > 0) {
      setDragY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 120) {
      handleClose();
    } else {
      setDragY(0);
    }
    setIsDragging(false);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 950,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Backdrop */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }} />

      {/* Floating Panel */}
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(18,18,32,0.92)',
          backdropFilter: 'blur(40px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          transform: isVisible ? `translateY(${dragY}px)` : 'translateY(100%)',
          opacity: isVisible ? 1 : 0,
          transition: isDragging
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
        }}
      >
        {/* Drag Handle */}
        <div
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 0 6px',
            cursor: 'grab',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: '40px',
            height: '5px',
            borderRadius: '3px',
            background: 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 20px 14px',
          flexShrink: 0,
        }}>
          {/* Playlist icon */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(93,190,157,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              播放列表
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>
              共 {queue.length} 首
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => {
                if (currentSong && listRef.current) {
                  const items = listRef.current.querySelectorAll('[data-song-id]');
                  const target = Array.from(items).find(el => el.getAttribute('data-song-id') === currentSong.id);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <IconLocate size={18} color="rgba(255,255,255,0.5)" />
            </button>
            <button
              onClick={() => {
                if (currentSong) {
                  onRemoveFromQueue(currentSong.id);
                }
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <IconTrash2 size={18} color="rgba(255,255,255,0.5)" />
            </button>
            <button
              onClick={handleClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              <IconX size={18} color="rgba(255,255,255,0.5)" />
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div ref={listRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 20px',
        }}>
          {queue.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {queue.map((song, i) => {
                const isCurrent = currentSong?.id === song.id;
                // Stack effect: cards near current song overlap with depth
                const distFromCurrent = currentSong
                  ? Math.abs(queue.findIndex(s => s.id === currentSong.id) - i)
                  : 99;
                const stackScale = isCurrent ? 1 : Math.max(0.96, 1 - distFromCurrent * 0.005);
                const stackZIndex = isCurrent ? 10 : Math.max(1, 10 - distFromCurrent);
                const stackTranslateY = isCurrent ? 0 : Math.min(8, distFromCurrent * 2);

                return (
                  <div
                    key={`${song.id}-${i}`}
                    data-song-id={song.id}
                    onClick={() => onPlay(song)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: isCurrent ? '12px 14px' : '8px 14px',
                      borderRadius: '14px',
                      background: isCurrent
                        ? 'rgba(93,190,157,0.15)'
                        : 'transparent',
                      border: isCurrent
                        ? '1.5px solid rgba(93,190,157,0.4)'
                        : '1.5px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      transform: `scale(${stackScale}) translateY(${stackTranslateY}px)`,
                      zIndex: stackZIndex,
                      position: 'relative',
                      boxShadow: isCurrent
                        ? '0 4px 20px rgba(93,190,157,0.2), 0 0 0 1px rgba(93,190,157,0.1)'
                        : 'none',
                      animation: `slideUp 0.3s ease ${i * 0.02}s both`,
                    }}
                    onMouseEnter={e => {
                      if (!isCurrent) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1) translateY(0px)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isCurrent) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.transform = `scale(${stackScale}) translateY(${stackTranslateY}px)`;
                      }
                    }}
                  >
                    {/* Rank or Equalizer */}
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: isCurrent ? 'var(--mint)' : 'rgba(255,255,255,0.3)',
                      width: '28px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}>
                      {isCurrent ? (
                        <Equalizer active={isPlaying} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <img
                      src={song.cover}
                      alt={song.title}
                      style={{
                        width: isCurrent ? '48px' : '44px',
                        height: isCurrent ? '48px' : '44px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        flexShrink: 0,
                        boxShadow: isCurrent
                          ? '0 4px 12px rgba(93,190,157,0.3)'
                          : '0 2px 8px rgba(0,0,0,0.3)',
                        transition: 'var(--transition)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: isCurrent ? 700 : 600,
                        color: isCurrent ? 'var(--mint)' : '#fff',
                        lineHeight: 1.4,
                      }} className="line-clamp-1">
                        {song.title}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: isCurrent ? 'rgba(93,190,157,0.7)' : 'rgba(255,255,255,0.45)',
                        marginTop: '2px',
                        lineHeight: 1.3,
                      }} className="line-clamp-1">
                        {song.artist}
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onNavigate('actionSheet', { song });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'none';
                      }}
                    >
                      <IconMore size={16} color="rgba(255,255,255,0.4)" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'rgba(255,255,255,0.4)',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
              <p style={{ marginTop: '16px', fontSize: '15px' }}>播放队列为空</p>
              <p style={{ marginTop: '4px', fontSize: '13px' }}>去搜索喜欢的歌曲吧</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
