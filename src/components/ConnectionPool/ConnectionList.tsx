import { useAllHealthMetrics } from '../../hooks/useHealthCheck';
import { HealthMetrics } from '../../lib/backend-health';

interface ConnectionListProps {
  onSelectConnection?: (sessionId: string) => void;
}

export function ConnectionList({ onSelectConnection }: ConnectionListProps) {
  const { metrics, loading, error } = useAllHealthMetrics(5000);

  if (loading && metrics.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm" style={{ color: 'var(--text1)' }}>
          Loading connections...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm" style={{ color: '#ef4444' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm" style={{ color: 'var(--text1)' }}>
          No active connections
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {metrics.map((metric) => (
        <ConnectionCard
          key={metric.session_id}
          metric={metric}
          onClick={() => onSelectConnection?.(metric.session_id)}
        />
      ))}
    </div>
  );
}

interface ConnectionCardProps {
  metric: HealthMetrics;
  onClick?: () => void;
}

function ConnectionCard({ metric, onClick }: ConnectionCardProps) {
  const statusColor = getStatusColor(metric.status);
  const statusLabel = metric.status.charAt(0).toUpperCase() + metric.status.slice(1);

  const successRate =
    metric.total_checks > 0
      ? ((metric.total_successes / metric.total_checks) * 100).toFixed(1)
      : '0.0';

  return (
    <div
      className="rounded-lg p-3 cursor-pointer transition-colors"
      style={{
        backgroundColor: 'var(--bg1)',
        borderWidth: '1px',
        borderColor: 'var(--border)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg1)';
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
            {metric.session_id.slice(0, 12)}...
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div style={{ color: 'var(--text2)' }}>Latency</div>
          <div style={{ color: 'var(--text0)' }}>
            {metric.avg_latency_ms.toFixed(0)}ms
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text2)' }}>Success</div>
          <div style={{ color: 'var(--text0)' }}>{successRate}%</div>
        </div>
        <div>
          <div style={{ color: 'var(--text2)' }}>Checks</div>
          <div style={{ color: 'var(--text0)' }}>{metric.total_checks}</div>
        </div>
      </div>

      {metric.last_error && (
        <div
          className="mt-2 text-xs truncate"
          style={{ color: '#ef4444' }}
          title={metric.last_error}
        >
          {metric.last_error}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return '#10b981';
    case 'degraded':
      return '#f59e0b';
    case 'unhealthy':
      return '#ef4444';
    default:
      return 'var(--text2)';
  }
}
