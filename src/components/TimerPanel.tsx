import { IconClose, IconTimer } from './Icons';

interface TimerPanelProps {
  timerActive: boolean;
  onSetTimer: (minutes: number) => void;
  onCancelTimer: () => void;
  onClose: () => void;
}

const timerOptions = [
  { label: '15分钟', value: 15 },
  { label: '30分钟', value: 30 },
  { label: '45分钟', value: 45 },
  { label: '60分钟', value: 60 },
  { label: '90分钟', value: 90 },
  { label: '2小时', value: 120 },
];

export function TimerPanel({ timerActive, onSetTimer, onCancelTimer, onClose }: TimerPanelProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease',
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
        background: 'var(--surface)',
        borderRadius: '24px 24px 0 0',
        padding: '16px 20px 32px',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '16px', fontWeight: 700 }}>定时暂停播放</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--mint-light)',
              border: 'none',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IconClose size={16} color="var(--mint)" />
          </button>
        </div>

        {/* Timer Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '12px',
        }}>
          {timerOptions.map(option => (
            <button
              key={option.value}
              onClick={() => {
                onSetTimer(option.value);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint)';
                (e.currentTarget as HTMLElement).style.background = 'var(--mint-light)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
              }}
            >
              <IconTimer size={18} color="var(--text-secondary)" />
              {option.label}
            </button>
          ))}
        </div>

        {/* Cancel Timer */}
        {timerActive && (
          <button
            onClick={() => {
              onCancelTimer();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'inherit',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              marginBottom: '16px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            取消定时
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            background: 'var(--mint)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--mint-dark)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--mint)';
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
