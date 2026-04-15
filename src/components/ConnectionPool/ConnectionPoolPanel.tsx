import { PoolStats } from './PoolStats';
import { ConnectionList } from './ConnectionList';
import { PoolActions } from './PoolActions';

export function ConnectionPoolPanel() {
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
          Connection Pool Monitor
        </h2>
        <PoolActions />
      </div>

      {/* Stats */}
      <PoolStats />

      {/* Connection List */}
      <div className="flex-1 overflow-y-auto">
        <ConnectionList />
      </div>
    </div>
  );
}
