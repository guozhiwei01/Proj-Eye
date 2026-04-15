import React from 'react';
import { ReconnectContext } from '../../lib/backend-reconnect';

interface ReconnectIndicatorProps {
  context: ReconnectContext | null;
  compact?: boolean;
}

export function ReconnectIndicator({ context, compact = false }: ReconnectIndicatorProps) {
  if (!context) return null;

  const getStateColor = (state: string) => {
    switch (state) {
      case 'attempting':
        return '#3b82f6';
      case 'backoff':
        return '#f59e0b';
      case 'success':
        return '#10b981';
      case 'failed':
        return '#ef4444';
      default:
        return 'var(--text2)';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'attempting':
        return 'Reconnecting...';
      case 'backoff':
        return 'Waiting to retry';
      case 'success':
        return 'Connected';
      case 'failed':
        return 'Failed';
      default:
        return 'Idle';
    }
  };

  const stateColor = getStateColor(context.state);
  const stateLabel = getStateLabel(context.state);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: stateColor }}
        />
        <span className="text-xs" style={{ color: stateColor }}>
          {stateLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: 'var(--bg1)',
        borderWidth: '1px',
        borderColor: stateColor,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: stateColor }}
        />
        <span className="text-sm font-medium" style={{ color: stateColor }}>
          {stateLabel}
        </span>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text1)' }}>Attempt</span>
          <span style={{ color: 'var(--text0)' }}>
            {context.attempt_count} / {context.strategy.max_attempts}
          </span>
        </div>

        {context.next_attempt_at && context.state === 'backoff' && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--text1)' }}>Next retry in</span>
            <span style={{ color: 'var(--text0)' }}>
              {Math.max(0, Math.ceil((context.next_attempt_at - Date.now()) / 1000))}s
            </span>
          </div>
        )}

        {context.error_history.length > 0 && (
          <div
            className="mt-2 p-2 rounded text-xs"
            style={{
              backgroundColor: '#ef444410',
              color: '#ef4444',
            }}
          >
            {context.error_history[context.error_history.length - 1]}
          </div>
        )}
      </div>
    </div>
  );
}
