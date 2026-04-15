import React, { useState } from 'react';
import { useAllHealthMetrics, useHealthCheckStats } from '../../hooks/useHealthCheck';
import { HealthMetricsChart } from './HealthMetricsChart';
import { HealthStatusBadge } from './HealthStatusBadge';
import { HealthConfigEditor } from './HealthConfigEditor';
import { healthCheckPerform } from '../../lib/backend-health';

export function HealthDashboard() {
  const { metrics, refresh } = useAllHealthMetrics(5000);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleManualCheck = async (sessionId: string) => {
    setChecking(true);
    try {
      await healthCheckPerform(sessionId);
      refresh();
    } catch (err) {
      console.error('Manual check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--bg0)',
        borderWidth: '1px',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottomWidth: '1px',
          borderColor: 'var(--border)',
        }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--text0)' }}>
          Health Dashboard
        </h2>
        <button
          onClick={() => setShowConfigEditor(!showConfigEditor)}
          className="px-3 py-1.5 text-xs rounded transition-colors"
          style={{
            backgroundColor: 'var(--bg1)',
            color: 'var(--text0)',
            borderWidth: '1px',
            borderColor: 'var(--border)',
          }}
        >
          {showConfigEditor ? 'Hide Config' : 'Configure'}
        </button>
      </div>

      {/* Config Editor */}
      {showConfigEditor && (
        <div
          style={{
            borderBottomWidth: '1px',
            borderColor: 'var(--border)',
          }}
        >
          <HealthConfigEditor
            onSave={() => {
              setShowConfigEditor(false);
              refresh();
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Metrics Chart */}
          <HealthMetricsChart metrics={metrics} />

          {/* Session List */}
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'var(--bg1)',
              borderWidth: '1px',
              borderColor: 'var(--border)',
            }}
          >
            <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text0)' }}>
              All Sessions
            </h4>

            {metrics.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-sm" style={{ color: 'var(--text1)' }}>
                  No sessions being monitored
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.map((metric) => (
                  <div
                    key={metric.session_id}
                    className="flex items-center justify-between p-2 rounded cursor-pointer transition-colors"
                    style={{
                      backgroundColor:
                        selectedSession === metric.session_id
                          ? 'var(--bg2)'
                          : 'transparent',
                    }}
                    onClick={() => setSelectedSession(metric.session_id)}
                    onMouseEnter={(e) => {
                      if (selectedSession !== metric.session_id) {
                        e.currentTarget.style.backgroundColor = 'var(--bg2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSession !== metric.session_id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <HealthStatusBadge status={metric.status} size="sm" showLabel={false} />
                      <span className="text-sm" style={{ color: 'var(--text0)' }}>
                        {metric.session_id.slice(0, 16)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span style={{ color: 'var(--text2)' }}>Latency: </span>
                        <span style={{ color: 'var(--text0)' }}>
                          {metric.avg_latency_ms.toFixed(0)}ms
                        </span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text2)' }}>Success: </span>
                        <span style={{ color: 'var(--text0)' }}>
                          {metric.total_checks > 0
                            ? ((metric.total_successes / metric.total_checks) * 100).toFixed(0)
                            : 0}
                          %
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleManualCheck(metric.session_id);
                        }}
                        disabled={checking}
                        className="px-2 py-1 rounded text-xs transition-colors"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                        }}
                      >
                        Check
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
