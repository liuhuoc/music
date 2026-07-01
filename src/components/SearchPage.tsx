import { useState, useEffect } from 'react';
import { IconChevronLeft, IconSearch, IconClock, IconMore, IconTrend } from './Icons';
import { searchAndGetFullSongs, getHotSearch, PLATFORMS } from '../services/musicApi';
import type { Song } from '../data/songs';

// 平台显示名称和颜色
const PLATFORM_LABELS: Record<string, string> = {
  netease: '网易云',
  kuwo: '酷我',
  kugou: '酷狗',
  qq: 'QQ',
};
const PLATFORM_COLORS: Record<string, string> = {
  netease: '#E60026',
  kuwo: '#FF8C00',
  kugou: '#2CA2F9',
  qq: '#31C27C',
};

// 默认热门搜索（API 不可用时使用）
const defaultHotSearches = [
  '周杰伦', '林俊杰', '邓紫棋', '薛之谦', '陈奕迅',
  '毛不易', '周深', '华晨宇', 'Taylor Swift', 'Adele'
];

interface SearchPageProps {
  onNavigate: (page: string, data?: unknown) => void;
  onPlay: (song: Song, queue?: Song[]) => void;
}

export function SearchPage({ onNavigate, onPlay }: SearchPageProps) {
  const [activeTab, setActiveTab] = useState<'hot' | 'history'>('hot');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [hotSearchList, setHotSearchList] = useState<string[]>(defaultHotSearches);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  // 加载热门搜索
  useEffect(() => {
    const loadHotSearch = async () => {
      try {
        const hotWords = await getHotSearch();
        if (hotWords.length > 0) {
          setHotSearchList(hotWords);
        }
      } catch {
        // 使用默认列表
      }
    };
    loadHotSearch();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError('');
    setShowResults(true);
    setUsingFallback(false);

    try {
      const platform = selectedPlatform === 'all' ? undefined : selectedPlatform;
      const songs = await searchAndGetFullSongs(searchQuery, 20, platform);
      setResults(songs);
      if (songs.length === 0) {
        setError('未找到相关歌曲');
      }
      if (!searchHistory.includes(searchQuery)) {
        setSearchHistory(prev => [searchQuery, ...prev].slice(0, 20));
      }
    } catch (e) {
      setResults([]);
      setError('搜索失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showResults && searchQuery.trim()) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform]);

  const handleHotClick = async (title: string) => {
    setSearchQuery(title);
    setIsLoading(true);
    setError('');
    setShowResults(true);
    setUsingFallback(false);

    try {
      const platform = selectedPlatform === 'all' ? undefined : selectedPlatform;
      const songs = await searchAndGetFullSongs(title, 20, platform);
      setResults(songs);
      if (songs.length === 0) {
        setError('未找到相关歌曲');
      }
      if (!searchHistory.includes(title)) {
        setSearchHistory(prev => [title, ...prev].slice(0, 20));
      }
    } catch (e) {
      setResults([]);
      setError('搜索失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const removeHistory = (keyword: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => prev.filter(k => k !== keyword));
  };

  const clearHistory = () => {
    setSearchHistory([]);
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'linear-gradient(135deg, #EF4444, #F87171)';
    if (rank === 2) return 'linear-gradient(135deg, #F59E0B, #FBBF24)';
    if (rank === 3) return 'linear-gradient(135deg, #3B82F6, #60A5FA)';
    if (rank === 4) return 'linear-gradient(135deg, #8B5CF6, #A78BFA)';
    if (rank === 5) return 'linear-gradient(135deg, #14B8A6, #2DD4BF)';
    return 'linear-gradient(135deg, #9CA3AF, #D1D5DB)';
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => onNavigate('home')}
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
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-light)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <IconChevronLeft size={22} color="var(--mint)" />
        </button>

        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1.5px solid var(--border)',
        }}>
          <IconMusic size={16} color="var(--text-tertiary)" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (!e.target.value) {
                setShowResults(false);
                setError('');
                setUsingFallback(false);
              }
            }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索歌曲、歌手、专辑..."
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--mint)',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: isLoading ? 'wait' : 'pointer',
            padding: '8px 4px',
            whiteSpace: 'nowrap',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {/* Tabs */}
      {!showResults && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 20px 12px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveTab('hot')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'var(--transition)',
              background: activeTab === 'hot' ? 'var(--mint)' : 'transparent',
              color: activeTab === 'hot' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <IconTrend size={14} />
            热门搜索
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'var(--transition)',
              background: activeTab === 'history' ? 'var(--mint)' : 'transparent',
              color: activeTab === 'history' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <IconClock size={14} />
            历史记录
          </button>
        </div>
      )}

      {/* Platform Filter Tabs - shown when results are displayed */}
      {showResults && (
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '0 20px 10px',
          flexShrink: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <button
            onClick={() => setSelectedPlatform('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'var(--transition)',
              whiteSpace: 'nowrap',
              background: selectedPlatform === 'all' ? 'var(--mint)' : 'var(--surface)',
              color: selectedPlatform === 'all' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            全部
          </button>
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'var(--transition)',
                whiteSpace: 'nowrap',
                background: selectedPlatform === p.id ? PLATFORM_COLORS[p.id] || 'var(--mint)' : 'var(--surface)',
                color: selectedPlatform === p.id ? '#fff' : 'var(--text-secondary)',
                opacity: p.canPlay ? 1 : 0.7,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px 20px',
      }}>
        {showResults ? (
          /* Search Results */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {usingFallback && (
              <div style={{
                padding: '8px 12px',
                background: 'var(--mint-light)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--mint-dark)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                </svg>
                搜索 API 暂不可用，请稍后重试
              </div>
            )}
            {isLoading ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-tertiary)',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid var(--border)',
                  borderTopColor: 'var(--mint)',
                  borderRadius: '50%',
                  margin: '0 auto',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ marginTop: '16px', fontSize: '15px' }}>搜索中...</p>
              </div>
            ) : error ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-tertiary)',
              }}>
                <IconSearch size={48} color="var(--border)" />
                <p style={{ marginTop: '16px', fontSize: '15px' }}>{error}</p>
                <button
                  onClick={handleSearch}
                  style={{
                    marginTop: '12px',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--mint)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  重试
                </button>
              </div>
            ) : results.length > 0 ? (
              results.map((song, i) => (
                <div
                  key={song.id}
                  onClick={() => onPlay(song, results)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    animation: `slideUp 0.3s ease ${i * 0.05}s both`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                  }}
                >
                  <img
                    src={song.cover}
                    alt={song.title}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }} className="line-clamp-1">
                      {song.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }} className="line-clamp-1">
                      {song.artist}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#fff',
                    background: PLATFORM_COLORS[song.source] || 'var(--mint)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    flexShrink: 0,
                  }}>
                    {PLATFORM_LABELS[song.source] || song.source}
                  </span>
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
                    }}
                  >
                    <IconMore size={18} color="var(--text-tertiary)" />
                  </button>
                </div>
              ))
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-tertiary)',
              }}>
                <IconSearch size={48} color="var(--border)" />
                <p style={{ marginTop: '16px', fontSize: '15px' }}>未找到相关歌曲</p>
                <p style={{ marginTop: '4px', fontSize: '13px' }}>换个关键词试试</p>
              </div>
            )}
          </div>
        ) : activeTab === 'hot' ? (
          /* Hot Searches */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {hotSearchList.map((title, i) => (
              <div
                key={i}
                onClick={() => handleHotClick(title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  animation: `slideUp 0.3s ease ${i * 0.04}s both`,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: getRankColor(i + 1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: i < 3 ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    {title}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            ))}
          </div>
        ) : (
          /* Search History */
          <div>
            {searchHistory.length > 0 ? (
              <>
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '12px',
                }}>
                  <button
                    onClick={clearHistory}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    清空历史
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {searchHistory.map((keyword, i) => (
                    <div
                      key={i}
                      onClick={() => handleHotClick(keyword)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <IconClock size={16} color="var(--text-tertiary)" />
                      <span style={{ flex: 1, fontSize: '15px', color: 'var(--text-primary)' }}>
                        {keyword}
                      </span>
                      <button
                        onClick={e => removeHistory(keyword, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '6px',
                          cursor: 'pointer',
                          borderRadius: '50%',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-tertiary)',
              }}>
                <IconClock size={48} color="var(--border)" />
                <p style={{ marginTop: '16px', fontSize: '15px' }}>暂无搜索历史</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconMusic({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  );
}
