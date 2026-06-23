import { useState, useEffect } from 'react';
import { mockSongs, chartTabs } from '../data/songs';
import { IconSearch, IconMenu, IconFlame, IconTrend, IconMore, Equalizer } from './Icons';
import { getToplistDetail, convertToAppSong } from '../services/musicApi';
import type { Song } from '../data/songs';

interface HomePageProps {
  onNavigate: (page: string, data?: unknown) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  onPlay: (song: Song, queue?: Song[]) => void;
  downloadCount: number;
}

export function HomePage({ onNavigate, currentSong, isPlaying, onPlay, downloadCount }: HomePageProps) {
  const [activeTab, setActiveTab] = useState('hot');
  const [toplistSongs, setToplistSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Load real toplist data on mount and tab change
  useEffect(() => {
    const loadToplist = async () => {
      setIsLoading(true);
      setUsingFallback(false);
      try {
        // Map tab IDs to Netease toplist IDs
        const toplistMap: Record<string, number> = {
          hot: 3778678,    // 热歌榜
          rising: 19723756, // 飙升榜
          new: 3779629,    // 新歌榜
        };
        const toplistId = toplistMap[activeTab];
        if (!toplistId) {
          setToplistSongs(mockSongs);
          setUsingFallback(true);
          return;
        }

        const neteaseSongs = await getToplistDetail(toplistId);
        const songs = neteaseSongs.slice(0, 10).map(convertToAppSong);
        setToplistSongs(songs);
      } catch {
        // Fallback to mock data on error
        setToplistSongs(mockSongs);
        setUsingFallback(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadToplist();
  }, [activeTab]);

  const handlePlay = (song: Song) => {
    onPlay(song, toplistSongs.length > 0 ? toplistSongs : mockSongs);
  };

  const displaySongs = toplistSongs.length > 0 ? toplistSongs : mockSongs;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeIn 0.4s ease',
    }}>
      {/* Search Bar + Download Entry */}
      <div style={{
        padding: '16px 20px 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            onClick={() => onNavigate('search')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1.5px solid var(--border)',
              cursor: 'pointer',
              transition: 'var(--transition)',
              flex: 1,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px var(--mint-glow)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <IconSearch size={18} color="var(--text-tertiary)" />
            <span style={{ color: 'var(--text-tertiary)', fontSize: '14px', flex: 1 }}>
              输入想要搜索的音乐
            </span>
          </div>
          {/* Download Entry */}
          <button
            onClick={() => onNavigate('downloads')}
            style={{
              position: 'relative',
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'var(--transition)',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px var(--mint-glow)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {downloadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                background: 'var(--mint)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 1px 4px rgba(93,190,157,0.4)',
              }}>
                {downloadCount > 99 ? '99+' : downloadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Chart Section */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconMenu size={18} color="var(--mint)" />
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Rankings
            </span>
          </div>
        </div>

        {/* Chart Tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
        }}>
          {chartTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'var(--transition)',
                background: activeTab === tab.id ? 'var(--mint)' : 'var(--surface)',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                boxShadow: activeTab === tab.id ? '0 2px 12px rgba(93,190,157,0.3)' : 'var(--shadow-sm)',
              }}
            >
              {tab.icon === 'flame' && <IconFlame size={14} color={activeTab === tab.id ? '#fff' : 'var(--text-secondary)'} />}
              {tab.icon === 'trend' && <IconTrend size={14} color={activeTab === tab.id ? '#fff' : 'var(--text-secondary)'} />}
              {tab.icon === 'new' && (
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : 'var(--mint-light)',
                  color: activeTab === tab.id ? '#fff' : 'var(--mint)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                }}>NEW</span>
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Song List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px 20px',
      }}>
        {usingFallback && (
          <div style={{
            padding: '6px 10px',
            background: 'var(--mint-light)',
            borderRadius: 'var(--radius-md)',
            fontSize: '11px',
            color: 'var(--mint-dark)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            网易云 API 暂不可用，显示本地数据
          </div>
        )}
        {isLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            gap: '16px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--mint)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>加载中...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displaySongs.map((song, index) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => handlePlay(song)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isCurrent ? 'var(--mint-light)' : 'var(--surface)',
                    border: isCurrent ? '1.5px solid var(--mint)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    animation: `slideUp 0.3s ease ${index * 0.04}s both`,
                  }}
                  onMouseEnter={e => {
                    if (!isCurrent) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isCurrent) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                    }
                  }}
                >
                  {/* Rank or Equalizer */}
                  <div style={{ width: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                    {isCurrent && isPlaying ? (
                      <Equalizer active={true} />
                    ) : (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: index < 3 ? 'var(--mint)' : 'var(--text-tertiary)',
                      }}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Cover */}
                  <img
                    src={song.cover}
                    alt={song.title}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: isCurrent ? 'var(--mint)' : 'var(--text-primary)',
                      lineHeight: 1.4,
                    }} className="line-clamp-1">
                      {song.title}
                      {song.isLive && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--mint)',
                          background: 'var(--mint-light)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          marginLeft: '6px',
                          verticalAlign: 'middle',
                        }}>LIVE</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: isCurrent ? 'var(--mint-dark)' : 'var(--text-secondary)',
                      marginTop: '2px',
                    }} className="line-clamp-1">
                      {song.artist}
                    </div>
                  </div>

                  {/* Source Tag */}
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--mint)',
                    background: 'var(--mint-light)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    flexShrink: 0,
                  }}>
                    {song.source}
                  </span>

                  {/* More */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onNavigate('actionSheet', { song });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px',
                      cursor: 'pointer',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'var(--transition-fast)',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--border-light)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <IconMore size={18} color="var(--text-tertiary)" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
