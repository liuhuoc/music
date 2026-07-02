import { useState, useEffect, useCallback } from 'react';
import { IconChevronLeft, IconRefresh, IconThumbUp, IconThumbDown, IconSend } from './Icons';
import type { Song } from '../data/songs';
import { getComments } from '../services/musicApi';
import type { CommentItem } from '../services/musicApi';

interface CommentsPanelProps {
  song: Song;
  onClose: () => void;
}

export function CommentsPanel({ song, onClose }: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [dislikedComments, setDislikedComments] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getComments(song, 30);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [song]);

  useEffect(() => {
    loadComments();
    setLikedComments(new Set());
    setDislikedComments(new Set());
  }, [song.id]);

  const toggleLike = (id: string) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        next.add(id);
        setDislikedComments(d => { const nd = new Set(d); nd.delete(id); return nd; });
      }
      return next;
    });
  };

  const toggleDislike = (id: string) => {
    setDislikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else {
        next.add(id);
        setLikedComments(l => { const nl = new Set(l); nl.delete(id); return nl; });
      }
      return next;
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.3s ease',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }} onClick={onClose} />

      <div style={{
        position: 'relative', marginTop: 'auto',
        background: 'var(--surface)', borderRadius: '24px 24px 0 0',
        maxHeight: '75%', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-light)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', padding: '8px', cursor: 'pointer',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconChevronLeft size={20} color="var(--text-primary)" />
          </button>
          <span style={{ fontSize: '16px', fontWeight: 700 }}>评论 {comments.length > 0 ? `(${comments.length})` : ''}</span>
          <button onClick={loadComments} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer' }}>
            <IconRefresh size={18} color={isLoading ? 'var(--mint)' : 'var(--text-secondary)'} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {isLoading && comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
              加载评论中...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
              暂无评论
            </div>
          ) : (
            comments.map((comment, i) => (
              <div key={comment.id} style={{
                display: 'flex', gap: '12px', padding: '14px 0',
                borderBottom: i < comments.length - 1 ? '1px solid var(--border-light)' : 'none',
                animation: `slideUp 0.3s ease ${i * 0.03}s both`,
              }}>
                <img src={comment.avatar} alt={comment.user} style={{
                  width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {comment.user}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '8px',
                    wordBreak: 'break-word',
                  }}>{comment.content}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {comment.date} · {comment.location}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => toggleLike(comment.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  }}>
                    <IconThumbUp
                      size={16}
                      color={likedComments.has(comment.id) ? 'var(--mint)' : 'var(--text-tertiary)'}
                      fill={likedComments.has(comment.id)}
                    />
                    <span style={{ fontSize: '11px', color: likedComments.has(comment.id) ? 'var(--mint)' : 'var(--text-tertiary)' }}>
                      {comment.likes + (likedComments.has(comment.id) ? 1 : 0)}
                    </span>
                  </button>
                  <button onClick={() => toggleDislike(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <IconThumbDown
                      size={16}
                      color={dislikedComments.has(comment.id) ? 'var(--accent-red)' : 'var(--text-tertiary)'}
                    />
                  </button>
                </div>
              </div>
            ))
          )}

          {comments.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 0',
              color: 'var(--text-tertiary)', fontSize: '13px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
              <span>没有更多了</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px 24px', borderTop: '1px solid var(--border-light)',
          display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-xl)',
          }}>
            <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="善语结善缘，恶语伤人心"
              style={{
                flex: 1, border: 'none', background: 'none', outline: 'none',
                fontSize: '14px', fontFamily: 'inherit', color: 'var(--text-primary)',
              }}
            />
          </div>
          <button style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: commentText.trim() ? 'var(--mint)' : 'var(--border)',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: commentText.trim() ? 'pointer' : 'default', flexShrink: 0,
            transition: 'var(--transition-fast)',
          }} onClick={() => { if (commentText.trim()) setCommentText(''); }}>
            <IconSend size={18} color={commentText.trim() ? '#fff' : 'var(--text-tertiary)'} />
          </button>
        </div>
      </div>
    </div>
  );
}
