import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
}

export function Toast({ message, visible, onClose }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '48px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      animation: show ? 'toastIn 0.3s ease' : 'toastOut 0.3s ease',
    }}>
      <div style={{
        background: 'var(--mint)',
        color: '#fff',
        padding: '10px 24px',
        borderRadius: 'var(--radius-full)',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 4px 20px rgba(93,190,157,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {message}
      </div>
    </div>
  );
}
