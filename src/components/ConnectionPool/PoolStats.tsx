import { useConnectionPoolStats } from '../../hooks/useConnectionPool';
import { useHealthCheckStats } from '../../hooks/useHealthCheck';

interface PoolStatsProps {
  refreshInterval?: number;
}

export function PoolStats({ refreshInterval = 5000 }: PoolStatsProps) {
  const { stats: poolStats, loading: poolLoading } = useConnectionPoolStats();
  const { stats: healthStats, loading: healthLoading } = useHealthCheckStats(refreshInterval);

  if (poolLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm" style={{ color: 'var(--text1)' }}>
          Loading statistics...
        </div>
      </div>
    );
  }

  const reuseRate = poolStats
    ? ((poolStats.active / Math.max(poolStats.total, 1)) * 100).toFixed(1)
    : '0.0';

  const healthRate = healthStats
    ? healthStats.avg_success_rate.toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {/* Connection Pool Stats */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg1)',
          borderWidth: '1px',
          borderColor: 'var(--border)',
        }}
      >
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text0)' }}>
          Connection Pool
        </h3>
        <div className="space-y-2">
          <StatRow label="Total" value={poolStats?.total || 0} />
          <StatRow label="Active" value={poolStats?.active || 0} color="var(--accent)" />
          <StatRow label="Idle" value={poolStats?.idle || 0} color="var(--text1)" />
          <StatRow label="Reuse Rate" value={`${reuseRate}%`} color="var(--accent)" />
        </div>
      </div>

      {/* Health Stats */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg1)',
          borderWidth: '1px',
          borderColor: 'var(--border)',
        }}
      >
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text0)' }}>
          Health Status
        </h3>
        <div className="space-y-2">
          <StatRow label="Healthy" value={healthStats?.healthy || 0} color="#10b981" />
          <StatRow label="Degraded" value={healthStats?.degraded || 0} color="#f59e0b" />
          <StatRow label="Unhealthy" value={healthStats?.unhealthy || 0} color="#ef4444" />
          <StatRow label="Success Rate" value={`${healthRate}%`} color="var(--accent)" />
        </div>
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: number | string;
  color?: string;
}

function StatRow({ label, value, color }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--text1)' }}>
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={{ color: color || 'var(--text0)' }}
      >
        {value}
      </span>
    </div>
  );
}
