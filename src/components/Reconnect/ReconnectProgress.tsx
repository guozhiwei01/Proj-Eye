import { ReconnectContext } from '../../lib/backend-reconnect';

interface ReconnectProgressProps {
  context: ReconnectContext;
}

export function ReconnectProgress({ context }: ReconnectProgressProps) {
  const progress = (context.attempt_count / context.strategy.max_attempts) * 100;

  const getDelayForAttempt = (attempt: number): number => {
    const base = context.strategy.initial_delay_ms * Math.pow(context.strategy.backoff_multiplier, attempt);
    return Math.min(base, context.strategy.max_delay_ms);
  };

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: 'var(--text1)' }}>Reconnect Progress</span>
          <span style={{ color: 'var(--text0)' }}>
            {context.attempt_count} / {context.strategy.max_attempts}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg2)' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: context.state === 'failed' ? '#ef4444' : 'var(--accent)',
            }}
          />
        </div>
      </div>

      {/* Attempt history */}
      <div className="space-y-1">
        {Array.from({ length: context.strategy.max_attempts }, (_, i) => {
          const attemptNum = i + 1;
          const isCompleted = attemptNum <= context.attempt_count;
          const isCurrent = attemptNum === context.attempt_count;
          const delay = getDelayForAttempt(i);

          return (
            <div
              key={i}
              className="flex items-center gap-2 text-xs"
              style={{
                opacity: isCompleted ? 1 : 0.4,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: isCompleted
                    ? isCurrent && context.state === 'failed'
                      ? '#ef4444'
                      : 'var(--accent)'
                    : 'var(--bg2)',
                  color: isCompleted ? 'white' : 'var(--text2)',
                }}
              >
                {attemptNum}
              </div>
              <span style={{ color: 'var(--text1)' }}>
                Attempt {attemptNum}
              </span>
              <span style={{ color: 'var(--text2)' }}>
                ({(delay / 1000).toFixed(1)}s delay)
              </span>
              {isCompleted && context.error_history[i] && (
                <span
                  className="ml-auto truncate max-w-xs"
                  style={{ color: '#ef4444' }}
                  title={context.error_history[i]}
                >
                  {context.error_history[i]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
