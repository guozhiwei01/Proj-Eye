import { useState } from 'react';
import {
  SessionLifecycle,
  lifecyclePauseSession,
  lifecycleResumeSession,
  lifecycleHibernateSession,
  lifecycleWakeSession,
  lifecycleDestroySession,
} from '../../lib/backend-lifecycle';

interface SessionStateCardProps {
  session: SessionLifecycle;
  onRefresh?: () => void;
}

export function SessionStateCard({ session, onRefresh }: SessionStateCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
      onRefresh?.();
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'created':
      case 'active':
        return '#10b981';
      case 'idle':
        return '#f59e0b';
      case 'paused':
        return '#3b82f6';
      case 'hibernated':
        return '#8b5cf6';
      case 'destroyed':
        return '#ef4444';
      default:
        return 'var(--text2)';
    }
  };

  const stateColor = getStateColor(session.state);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--bg1)',
        borderWidth: '1px',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stateColor }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
            {session.session_id.slice(0, 16)}...
          </span>
        </div>
        <span
          className="text-xs px-2 py-1 rounded capitalize"
          style={{
            backgroundColor: `${stateColor}20`,
            color: stateColor,
          }}
        >
          {session.state}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {session.state === 'active' && (
          <ActionButton
            label="Pause"
            onClick={() => handleAction(() => lifecyclePauseSession(session.session_id))}
            disabled={loading}
          />
        )}

        {session.state === 'paused' && (
          <ActionButton
            label="Resume"
            onClick={() => handleAction(() => lifecycleResumeSession(session.session_id))}
            disabled={loading}
          />
        )}

        {(session.state === 'idle' || session.state === 'paused') && (
          <ActionButton
            label="Hibernate"
            onClick={() => handleAction(() => lifecycleHibernateSession(session.session_id))}
            disabled={loading}
          />
        )}

        {session.state === 'hibernated' && (
          <ActionButton
            label="Wake"
            onClick={() => handleAction(() => lifecycleWakeSession(session.session_id))}
            disabled={loading}
          />
        )}

        {session.state !== 'destroyed' && (
          <ActionButton
            label="Destroy"
            onClick={() => handleAction(() => lifecycleDestroySession(session.session_id))}
            disabled={loading}
            danger
          />
        )}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function ActionButton({ label, onClick, disabled, danger }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1 text-xs rounded transition-colors"
      style={{
        backgroundColor: danger ? '#ef444420' : 'var(--bg2)',
        color: danger ? '#ef4444' : 'var(--text0)',
        borderWidth: '1px',
        borderColor: danger ? '#ef4444' : 'var(--border)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.opacity = '0.8';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {label}
    </button>
  );
}
