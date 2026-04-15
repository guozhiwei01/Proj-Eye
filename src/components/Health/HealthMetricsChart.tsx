import React from 'react';
import { HealthMetrics } from '../../lib/backend-health';

interface HealthMetricsChartProps {
  metrics: HealthMetrics[];
}

export function HealthMetricsChart({ metrics }: HealthMetricsChartProps) {
  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm" style={{ color: 'var(--text1)' }}>
          No metrics available
        </div>
      </div>
    );
  }

  // Calculate aggregated stats
  const totalChecks = metrics.reduce((sum, m) => sum + m.total_checks, 0);
  const totalSuccesses = metrics.reduce((sum, m) => sum + m.total_successes, 0);
  const avgLatency =
    metrics.reduce((sum, m) => sum + m.avg_latency_ms, 0) / metrics.length;
  const successRate = totalChecks > 0 ? (totalSuccesses / totalChecks) * 100 : 0;

  // Status distribution
  const statusCounts = {
    healthy: metrics.filter((m) => m.status === 'healthy').length,
    degraded: metrics.filter((m) => m.status === 'degraded').length,
    unhealthy: metrics.filter((m) => m.status === 'unhealthy').length,
    unknown: metrics.filter((m) => m.status === 'unknown').length,
  };

  const total = metrics.length;

  return (
    <div className="space-y-4">
      {/* Aggregate Stats */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Avg Latency"
          value={`${avgLatency.toFixed(0)}ms`}
          color="var(--accent)"
        />
        <MetricCard
          label="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          color="#10b981"
        />
        <MetricCard
          label="Total Checks"
          value={totalChecks.toString()}
          color="var(--text0)"
        />
        <MetricCard
          label="Sessions"
          value={total.toString()}
          color="var(--text0)"
        />
      </div>

      {/* Status Distribution */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg1)',
          borderWidth: '1px',
          borderColor: 'var(--border)',
        }}
      >
        <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text0)' }}>
          Status Distribution
        </h4>

        <div className="space-y-2">
          <StatusBar
            label="Healthy"
            count={statusCounts.healthy}
            total={total}
            color="#10b981"
          />
          <StatusBar
            label="Degraded"
            count={statusCounts.degraded}
            total={total}
            color="#f59e0b"
          />
          <StatusBar
            label="Unhealthy"
            count={statusCounts.unhealthy}
            total={total}
            color="#ef4444"
          />
          <StatusBar
            label="Unknown"
            count={statusCounts.unknown}
            total={total}
            color="var(--text2)"
          />
        </div>
      </div>

      {/* Top Sessions by Latency */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--bg1)',
          borderWidth: '1px',
          borderColor: 'var(--border)',
        }}
      >
        <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text0)' }}>
          Highest Latency
        </h4>

        <div className="space-y-2">
          {metrics
            .sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)
            .slice(0, 5)
            .map((metric) => (
              <div
                key={metric.session_id}
                className="flex items-center justify-between text-xs"
              >
                <span style={{ color: 'var(--text1)' }}>
                  {metric.session_id.slice(0, 12)}...
                </span>
                <span style={{ color: 'var(--text0)' }}>
                  {metric.avg_latency_ms.toFixed(0)}ms
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  color: string;
}

function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: 'var(--bg1)',
        borderWidth: '1px',
        borderColor: 'var(--border)',
      }}
    >
      <div className="text-xs mb-1" style={{ color: 'var(--text1)' }}>
        {label}
      </div>
      <div className="text-lg font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

interface StatusBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function StatusBar({ label, count, total, color }: StatusBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: 'var(--text1)' }}>{label}</span>
        <span style={{ color: 'var(--text0)' }}>
          {count} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg2)' }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
