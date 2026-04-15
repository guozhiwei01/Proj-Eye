import React, { useState } from 'react';
import { useActiveReconnects, useReconnectStats } from '../../hooks/useReconnect';
import { ReconnectIndicator } from './ReconnectIndicator';
import { ReconnectProgress } from './ReconnectProgress';
import { ReconnectStrategyEditor } from './ReconnectStrategyEditor';

export function ReconnectPanel() {
  const { reconnects, refresh } = useActiveReconnects(5000);
  const { stats } = useReconnectStats(5000);
  const [showStrategyEditor, setShowStrategyEditor] = useState(false);
  const [selectedReconnect, setSelectedReconnect] = useState<string | null>(null);

  const selectedContext = reconnects.find((r) => r.session_id === selectedReconnect);

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
          Reconnect Status
        </h2>
        <button
          onClick={() => setShowStrategyEditor(!showStrategyEditor)}
          className="px-3 py-1.5 text-xs rounded transition-colors"
          style={{
            backgroundColor: 'var(--bg1)',
            color: 'var(--text0)',
            borderWidth: '1px',
            borderColor: 'var(--border)',
          }}
        >
          {showStrategyEditor ? 'Hide Strategy' : 'Edit Strategy'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2 p-4">
          <StatCard label="Total" value={stats.total_contexts} />
          <StatCard label="Attempting" value={stats.attempting} color="#3b82f6" />
          <StatCard label="Backoff" value={stats.backoff} color="#f59e0b" />
          <StatCard label="Success" value={stats.success} color="#10b981" />
          <StatCard label="Failed" value={stats.failed} color="#ef4444" />
        </div>
      )}

      {/* Strategy Editor */}
      {showStrategyEditor && (
        <div
          style={{
            borderBottomWidth: '1px',
            borderColor: 'var(--border)',
          }}
        >
          <ReconnectStrategyEditor
            onSave={() => {
              setShowStrategyEditor(false);
              refresh();
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {reconnects.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm" style={{ color: 'var(--text1)' }}>
              No active reconnects
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {reconnects.map((context) => (
              <div
                key={context.session_id}
                className="cursor-pointer"
                onClick={() => setSelectedReconnect(context.session_id)}
              >
                <ReconnectIndicator context={context} />
                {selectedReconnect === context.session_id && (
                  <div className="mt-3">
                    <ReconnectProgress context={context} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-2 text-center"
      style={{
        backgroundColor: 'var(--bg1)',
        borderWidth: '1px',
        borderColor: 'var(--border)',
      }}
    >
      <div className="text-xs mb-1" style={{ color: 'var(--text1)' }}>
        {label}
      </div>
      <div
        className="text-lg font-semibold"
        style={{ color: color || 'var(--text0)' }}
      >
        {value}
      </div>
    </div>
  );
}
