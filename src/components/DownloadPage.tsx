import { useState } from 'react';
import { IconChevronLeft, IconPlay, IconPause, IconTrash2 } from './Icons';
import type { DownloadItem } from '../hooks/usePlayer';
import type { Song } from '../data/songs';

interface DownloadPageProps {
  downloadList: DownloadItem[];
  downloadStats: { downloading: number; completed: number; paused: number; totalSize: number; total: number };
  currentSong: Song | null;
  isPlaying: boolean;
  onBack: () => void;
  onPlay: (song: Song) => void;
  onTogglePlay: () => void;
  onPauseDownload: (songId: string) => void;
  onResumeDownload: (songId: string) => void;
  onCancelDownload: (songId: string) => void;
  onDeleteDownload: (songId: string) => void;
  onRetryDownload: (songId: string) => void;
  onPlayAll: () => void;
}

export function DownloadPage({
  downloadList,
  downloadStats,
  currentSong,
  isPlaying,
  onBack,
  onPlay,
  onTogglePlay,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onDeleteDownload,
  onPlayAll,
}: DownloadPageProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'downloading' | 'completed'>('all');

  const filteredList = downloadList.filter(d => {
    if (activeTab === 'all') return true;
    if (activeTab === 'downloading') return d.status === 'downloading' || d.status === 'paused';
    return d.status === 'completed';
  });

  const completedSongs = downloadList.filter(d => d.status === 'completed').map(d => d.song);

  const tabs = [
    { id: 'all' as const, label: '全部', count: downloadStats.total },
    { id: 'downloading' as const, label: '下载中', count: downloadStats.downloading + downloadStats.paused },
    { id: 'completed' as const, label: '已完成', count: downloadStats.completed },
  ];

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideInRight 0.25s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border-light)',
      }}>
        <button
          onClick={onBack}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        >
          <IconChevronLeft size={20} color="var(--text-primary)" />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            下载管理
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
            {downloadStats.total > 0
              ? `${downloadStats.completed} 首已完成 · ${downloadStats.totalSize.toFixed(1)} MB`
              : '暂无下载'
            }
          </div>
        </div>

        {completedSongs.length > 0 && (
          <button
            onClick={() => onPlayAll()}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--mint)',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(93,190,157,0.3)',
              transition: 'var(--transition-fast)',
              flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <IconPlay size={12} color="#fff" />
            播放全部
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 20px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border-light)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'var(--transition)',
              background: activeTab === tab.id ? 'var(--mint)' : 'var(--bg)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(93,190,157,0.25)' : 'none',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                marginLeft: '4px',
                fontSize: '11px',
                opacity: 0.8,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Download List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 16px 20px',
      }}>
        {filteredList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredList.map((item, i) => {
              const isCurrent = currentSong?.id === item.song.id;
              return (
                <div
                  key={`${item.song.id}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '14px',
                    background: isCurrent ? 'var(--mint-light)' : 'transparent',
                    border: isCurrent ? '1.5px solid var(--mint)' : '1.5px solid transparent',
                    transition: 'var(--transition)',
                    animation: `slideUp 0.3s ease ${i * 0.02}s both`,
                  }}
                >
                  {/* Cover */}
                  <div
                    onClick={() => {
                      if (item.status !== 'completed') return;
                      if (currentSong?.id === item.song.id) {
                        onTogglePlay();
                      } else {
                        onPlay(item.song);
                      }
                    }}
                    style={{
                      position: 'relative',
                      width: '48px',
                      height: '48px',
                      borderRadius: '10px',
                      flexShrink: 0,
                      overflow: 'hidden',
                      cursor: item.status === 'completed' ? 'pointer' : 'default',
                    }}
                  >
                    <img
                      src={item.song.cover}
                      alt={item.song.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    {item.status === 'completed' && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: currentSong?.id === item.song.id ? 1 : 0,
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={e => {
                        if (currentSong?.id !== item.song.id) {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }
                      }}
                      onMouseLeave={e => {
                        if (currentSong?.id !== item.song.id) {
                          (e.currentTarget as HTMLElement).style.opacity = '0';
                        }
                      }}
                      >
                        {currentSong?.id === item.song.id && isPlaying ? (
                          <IconPause size={18} color="#fff" />
                        ) : (
                          <IconPlay size={18} color="#fff" />
                        )}
                      </div>
                    )}
                    {item.status === 'downloading' && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'rgba(0,0,0,0.3)',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${item.progress}%`,
                          background: 'var(--mint)',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: isCurrent ? 'var(--mint)' : 'var(--text-primary)',
                      lineHeight: 1.4,
                    }} className="line-clamp-1">
                      {item.song.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                      lineHeight: 1.3,
                    }} className="line-clamp-1">
                      {item.song.artist}
                    </div>
                    {(item.status === 'downloading' || item.status === 'paused') && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '3px',
                        }}>
                          <span style={{
                            fontSize: '11px',
                            color: item.status === 'downloading' ? 'var(--mint)' : 'var(--text-tertiary)',
                            fontWeight: 500,
                          }}>
                            {item.status === 'downloading' ? '下载中' : '已暂停'}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                          }}>
                            {Math.round(item.progress)}% · {item.fileSize}
                          </span>
                        </div>
                        <div style={{
                          height: '3px',
                          borderRadius: '2px',
                          background: 'var(--border-light)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            borderRadius: '2px',
                            width: `${item.progress}%`,
                            background: item.status === 'downloading'
                              ? 'linear-gradient(90deg, var(--mint), var(--mint-dark))'
                              : 'var(--text-tertiary)',
                            transition: item.status === 'downloading' ? 'width 0.3s ease' : 'none',
                          }} />
                        </div>
                      </div>
                    )}
                    {item.status === 'completed' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '4px',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--mint)',
                          fontWeight: 500,
                        }}>
                          已下载 · {item.fileSize}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    flexShrink: 0,
                  }}>
                    {item.status === 'downloading' && (
                      <button
                        onClick={() => onPauseDownload(item.song.id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'none',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        <IconPause size={16} color="var(--text-tertiary)" />
                      </button>
                    )}
                    {item.status === 'paused' && (
                      <button
                        onClick={() => onResumeDownload(item.song.id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--mint-light)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                      >
                        <IconPlay size={14} color="var(--mint)" />
                      </button>
                    )}
                    {(item.status === 'completed' || item.status === 'paused') && (
                      <button
                        onClick={() => item.status === 'completed' ? onDeleteDownload(item.song.id) : onCancelDownload(item.song.id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'none',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        <IconTrash2 size={15} color="var(--text-tertiary)" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--text-tertiary)',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 500 }}>
              {activeTab === 'all' ? '暂无下载' : activeTab === 'downloading' ? '没有进行中的下载' : '暂无已完成的下载'}
            </p>
            <p style={{ marginTop: '4px', fontSize: '13px' }}>
              去歌曲列表下载喜欢的音乐吧
            </p>
          </div>
        )}
      </div>

      {/* Storage Info Bar */}
      {downloadStats.total > 0 && (
        <div style={{
          padding: '10px 20px 16px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              已用 {downloadStats.totalSize.toFixed(1)} MB
            </span>
          </div>
          <div style={{
            width: '120px',
            height: '4px',
            borderRadius: '2px',
            background: 'var(--border-light)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (downloadStats.totalSize / 500) * 100)}%`,
              background: 'linear-gradient(90deg, var(--mint), var(--mint-dark))',
              borderRadius: '2px',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
