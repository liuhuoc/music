import { useState, useEffect } from 'react';
import { IconChevronLeft, IconRefresh, IconSearch, IconThumbUp, IconThumbDown, IconSend } from './Icons';
import { getComments } from '../services/musicApi';
import type { Song } from '../data/songs';

interface CommentsPanelProps {
  song: Song | null;
  onClose: () => void;
}

interface CommentItem {
  id: string;
  user: string;
  avatar: string;
  content: string;
  date: string;
  location: string;
  likes: number;
}

export function CommentsPanel({ song, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [dislikedComments, setDislikedComments] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');

  const loadComments = async () => {
    if (!song) return;
    setIsLoading(true);
    try {
      const data = await getComments(song, 30);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (song) {
      loadComments();
      setLikedComments(new Set());
      setDislikedComments(new Set());
    }
  }, [song]);

  const toggleLike = (id: string) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setDislikedComments(d => {
          const nd = new Set(d);
          nd.delete(id);
          return nd;
        });
      }
      return next;
    });
  };

  const toggleDislike = (id: string) => {
    setDislikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setLikedComments(l => {
          const nl = new Set(l);
          nl.delete(id);
          return nl;
        });
      }
      return next;
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideUp 0.3s ease',
    }}>
      {/* Backdrop */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        position: 'relative',
        marginTop: 'auto',
        background: 'var(--surface)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '75%',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconChevronLeft size={20} color="var(--text-primary)" />
          </button>
          <span style={{ fontSize: '16px', fontWeight: 700 }}>评论</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={loadComments}
              disabled={isLoading}
              style={{ background: 'none', border: 'none', padding: '8px', cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.5 : 1 }}
            >
              <IconRefresh size={18} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 20px',
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              color: 'var(--text-tertiary)',
            }}>
              <div style={{
                width: '30px',
                height: '30px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--mint)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ marginTop: '12px', fontSize: '13px' }}>加载评论中...</p>
            </div>
          ) : comments.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-tertiary)',
            }}>
              <p style={{ fontSize: '14px' }}>暂无评论</p>
              <p style={{ marginTop: '4px', fontSize: '12px' }}>快来抢沙发吧~</p>
            </div>
          ) : (
            <>
          {comments.map((comment, i) => (
            <div
              key={comment.id}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '14px 0',
                borderBottom: i < comments.length - 1 ? '1px solid var(--border-light)' : 'none',
                animation: `slideUp 0.3s ease ${i * 0.05}s both`,
              }}
            >
              <img
                src={comment.avatar}
                alt={comment.user}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '6px',
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    {comment.user}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--mint)',
                    background: 'var(--mint-light)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}>
                    Lv.5
                  </span>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                  marginBottom: '8px',
                }}>
                  {comment.content}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {comment.date} · {comment.location}
                  </span>
                  <button style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                    回复
                  </button>
                </div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}>
                <button
                  onClick={() => toggleLike(comment.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <IconThumbUp
                    size={16}
                    color={likedComments.has(comment.id) ? 'var(--mint)' : 'var(--text-tertiary)'}
                    fill={likedComments.has(comment.id)}
                  />
                  <span style={{
                    fontSize: '11px',
                    color: likedComments.has(comment.id) ? 'var(--mint)' : 'var(--text-tertiary)',
                  }}>
                    {comment.likes + (likedComments.has(comment.id) ? 1 : 0)}
                  </span>
                </button>
                <button
                  onClick={() => toggleDislike(comment.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <IconThumbDown
                    size={16}
                    color={dislikedComments.has(comment.id) ? 'var(--accent-red)' : 'var(--text-tertiary)'}
                  />
                </button>
              </div>
            </div>
          ))}

          {/* End indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '20px 0',
            color: 'var(--text-tertiary)',
            fontSize: '13px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            <span>没有更多了</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
          </div>

          {/* Eye care warning */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '0 0 16px',
          }}>
            <span style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              background: 'var(--bg)',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
            }}>
              过度用眼，请注意用眼时间
            </span>
          </div>
            </>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 20px 24px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-xl)',
          }}>
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="善语结善缘，恶语伤人心"
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
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: commentText.trim() ? 'var(--mint)' : 'var(--border)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: commentText.trim() ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'var(--transition-fast)',
            }}
          >
            <IconSend size={18} color={commentText.trim() ? '#fff' : 'var(--text-tertiary)'} />
          </button>
        </div>
      </div>
    </div>
  );
}
