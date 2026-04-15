import { SessionLifecycle } from '../../lib/backend-lifecycle';

interface SessionStateTimelineProps {
  session: SessionLifecycle;
}

export function SessionStateTimeline({ session }: SessionStateTimelineProps) {
  const states = ['created', 'active', 'idle', 'paused', 'hibernated', 'destroyed'];
  const currentIndex = states.indexOf(session.state);

  const getStateColor = (state: string, isCurrent: boolean, isPast: boolean) => {
    if (!isPast && !isCurrent) return 'var(--text2)';

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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
          State Timeline
        </h3>
        <span className="text-xs" style={{ color: 'var(--text1)' }}>
          Current: {session.state}
        </span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div
          className="absolute top-4 left-0 right-0 h-0.5"
          style={{ backgroundColor: 'var(--border)' }}
        />

        {/* States */}
        <div className="flex justify-between relative">
          {states.map((state, index) => {
            const isCurrent = index === currentIndex;
            const isPast = index < currentIndex;
            const color = getStateColor(state, isCurrent, isPast);

            return (
              <div key={state} className="flex flex-col items-center">
                {/* State dot */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-all"
                  style={{
                    backgroundColor: isCurrent ? color : 'var(--bg1)',
                    borderWidth: '2px',
                    borderColor: color,
                  }}
                >
                  {isCurrent && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: 'white' }}
                    />
                  )}
                  {isPast && (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* State label */}
                <div className="mt-2 text-center">
                  <div
                    className="text-xs font-medium capitalize"
                    style={{ color: isCurrent || isPast ? color : 'var(--text2)' }}
                  >
                    {state}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timestamps */}
      <div className="mt-6 space-y-2">
        <TimeRow label="Created" timestamp={session.created_at} />
        <TimeRow label="Last Active" timestamp={session.last_active_at} />
        {session.idle_since && <TimeRow label="Idle Since" timestamp={session.idle_since} />}
        {session.paused_at && <TimeRow label="Paused At" timestamp={session.paused_at} />}
        {session.hibernated_at && (
          <TimeRow label="Hibernated At" timestamp={session.hibernated_at} />
        )}
      </div>

      {/* Activity Stats */}
      <div
        className="mt-4 p-3 rounded-lg"
        style={{
          backgroundColor: 'var(--bg1)',
          borderWidth: '1px',
          borderColor: 'var(--border)',
        }}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div style={{ color: 'var(--text2)' }}>Activity Count</div>
            <div className="font-medium" style={{ color: 'var(--text0)' }}>
              {session.activity_count}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text2)' }}>Active Duration</div>
            <div className="font-medium" style={{ color: 'var(--text0)' }}>
              {formatDuration(session.total_active_duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TimeRowProps {
  label: string;
  timestamp: number;
}

function TimeRow({ label, timestamp }: TimeRowProps) {
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString();
  const dateStr = date.toLocaleDateString();

  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: 'var(--text1)' }}>{label}</span>
      <span style={{ color: 'var(--text0)' }}>
        {dateStr} {timeStr}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
