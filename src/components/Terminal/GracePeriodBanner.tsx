import { useAutoReconnect } from '../../hooks/useReconnect';

interface GracePeriodBannerProps {
  sessionId: string;
}

export function GracePeriodBanner({ sessionId }: GracePeriodBannerProps) {
  const { isGracePeriod, gracePeriodProgress } = useAutoReconnect(sessionId);

  if (!isGracePeriod || !gracePeriodProgress) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--warning-bg, #fef3c7)',
        borderBottom: '1px solid var(--warning-border, #fbbf24)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1000,
        fontSize: '13px',
      }}
    >
      <div
        className="spinner"
        style={{
          width: '16px',
          height: '16px',
          border: '2px solid var(--warning, #f59e0b)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span style={{ color: 'var(--warning-text, #92400e)' }}>
        🔄 连接中断，正在尝试恢复旧连接...
      </span>
      <div
        style={{
          flex: 1,
          height: '4px',
          backgroundColor: 'var(--warning-bg-dark, #fde68a)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${gracePeriodProgress.percentage}%`,
            height: '100%',
            backgroundColor: 'var(--warning, #f59e0b)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ color: 'var(--warning-text, #92400e)', fontSize: '12px' }}>
        {gracePeriodProgress.elapsed}s / {gracePeriodProgress.total}s
      </span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
