import { IconClose, IconRemove, IconPlus, IconHeart, IconShare, IconComment, IconDownload, IconTimer, IconFolderOpen } from './Icons';
import type { Song } from '../data/songs';

interface ActionSheetProps {
  song: Song;
  isFavorite: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  onClose: () => void;
  onRemove: () => void;
  onPlayNext: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
  onComment: () => void;
  onDownload: () => void;
  onViewDownloads: () => void;
  onTimer: () => void;
}

export function ActionSheet({
  song,
  isFavorite,
  isDownloaded,
  isDownloading,
  onClose,
  onRemove,
  onPlayNext,
  onToggleFavorite,
  onShare,
  onComment,
  onDownload,
  onViewDownloads,
  onTimer,
}: ActionSheetProps) {
  const actions = [
    { icon: IconRemove, label: '从列表移除', onClick: onRemove },
    { icon: IconPlus, label: '下一首播放', onClick: onPlayNext },
    { icon: IconHeart, label: isFavorite ? '已喜欢' : '喜欢', onClick: onToggleFavorite, active: isFavorite },
    { icon: IconShare, label: '分享', onClick: onShare },
    { icon: IconComment, label: '评论', onClick: onComment },
    {
      icon: isDownloaded ? IconDownload : IconDownload,
      label: isDownloaded ? '已下载' : isDownloading ? '下载中...' : '下载',
      onClick: onDownload,
      active: isDownloaded,
      disabled: isDownloading,
    },
    { icon: IconFolderOpen, label: '下载管理', onClick: onViewDownloads },
    { icon: IconTimer, label: '定时暂停', onClick: onTimer },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }} />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: '24px 24px 0 0',
          padding: '16px 20px 32px',
          animation: 'slideUp 0.3s ease',
          maxHeight: '70%',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div style={{
          width: '40px',
          height: '4px',
          borderRadius: '2px',
          background: 'var(--border)',
          margin: '0 auto 16px',
        }} />

        {/* Song Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '0 0 20px',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '20px',
        }}>
          <img
            src={song.cover}
            alt={song.title}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-md)',
              objectFit: 'cover',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              border: '2px solid var(--mint)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }} className="line-clamp-1">
                {song.title}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--mint)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                flexShrink: 0,
              }}>
                {song.source}
              </span>
            </div>
            <span style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }} className="line-clamp-1">
              {song.artist}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--border-light)',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <IconClose size={16} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Action Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px 8px',
        }}>
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                onClose();
              }}
              disabled={action.disabled}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                padding: '12px 4px',
                cursor: action.disabled ? 'not-allowed' : 'pointer',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-fast)',
                opacity: action.disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (!action.disabled) (e.currentTarget as HTMLElement).style.background = 'var(--mint-light)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: action.active ? 'var(--mint)' : 'var(--bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-fast)',
              }}>
                <action.icon
                  size={22}
                  color={action.active ? '#fff' : 'var(--text-secondary)'}
                  fill={action.active}
                />
              </div>
              <span style={{
                fontSize: '12px',
                color: action.active ? 'var(--mint)' : 'var(--text-secondary)',
                fontWeight: 500,
              }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
