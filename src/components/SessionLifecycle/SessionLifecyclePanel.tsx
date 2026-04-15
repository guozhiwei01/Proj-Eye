import React, { useState } from 'react';
import { useLifecycleStats } from '../../hooks/useSessionLifecycle';
import { SessionStateTimeline } from './SessionStateTimeline';
import { LifecyclePolicyEditor } from './LifecyclePolicyEditor';
import { SessionStateCard } from './SessionStateCard';
import { lifecycleGetSession, SessionLifecycle } from '../../lib/backend-lifecycle';

export function SessionLifecyclePanel() {
  const { stats, refresh } = useLifecycleStats(5000);
  const [selectedSession, setSelectedSession] = useState<SessionLifecycle | null>(null);
  const [showPolicyEditor, setShowPolicyEditor] = useState(false);

  const handleSelectSession = async (sessionId: string) => {
    try {
      const session = await lifecycleGetSession(sessionId);
      setSelectedSession(session);
    } catch (err) {
      console.error('Failed to load session:', err);
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
          Session Lifecycle
        </h2>
        <button
          onClick={() => setShowPolicyEditor(!showPolicyEditor)}
          className="px-3 py-1.5 text-xs rounded transition-colors"
          style={{
            backgroundColor: 'var(--bg1)',
            color: 'var(--text0)',
            borderWidth: '1px',
            borderColor: 'var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg1)';
          }}
        >
          {showPolicyEditor ? 'Hide Policy' : 'Edit Policy'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 p-4">
          <StatCard label="Total" value={stats.total_sessions} />
          <StatCard label="Active" value={stats.active_count} color="#10b981" />
          <StatCard label="Idle" value={stats.idle_count} color="#f59e0b" />
          <StatCard label="Paused" value={stats.paused_count} color="#3b82f6" />
          <StatCard label="Hibernated" value={stats.hibernated_count} color="#8b5cf6" />
          <StatCard label="Destroyed" value={stats.destroyed_count} color="#ef4444" />
        </div>
      )}

      {/* Policy Editor */}
      {showPolicyEditor && (
        <div
          style={{
            borderBottomWidth: '1px',
            borderColor: 'var(--border)',
          }}
        >
          <LifecyclePolicyEditor
            onSave={() => {
              setShowPolicyEditor(false);
              refresh();
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedSession ? (
          <div className="space-y-4">
            <SessionStateTimeline session={selectedSession} />
            <div className="px-4">
              <SessionStateCard
                session={selectedSession}
                onRefresh={() => handleSelectSession(selectedSession.session_id)}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-sm mb-2" style={{ color: 'var(--text1)' }}>
                No session selected
              </div>
              <div className="text-xs" style={{ color: 'var(--text2)' }}>
                Select a session from the connection pool to view its lifecycle
              </div>
            </div>
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
      <div
        className="text-lg font-semibold"
        style={{ color: color || 'var(--text0)' }}
      >
        {value}
      </div>
    </div>
  );
}
