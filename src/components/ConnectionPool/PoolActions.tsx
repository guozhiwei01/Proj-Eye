import { useState } from 'react';
import { poolCleanupIdle, poolStats } from '../../lib/backend-pool';

export function PoolActions() {
  const [loading, setLoading] = useState(false);

  const handleCleanup = async () => {
    setLoading(true);
    try {
      const removed = await poolCleanupIdle(300000); // 5 minutes
      console.log(`Cleaned up ${removed} idle connections`);
    } catch (err) {
      console.error('Failed to cleanup:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await poolStats();
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCleanup}
        disabled={loading}
        className="px-3 py-1.5 text-xs rounded transition-colors"
        style={{
          backgroundColor: 'var(--bg1)',
          color: 'var(--text0)',
          borderWidth: '1px',
          borderColor: 'var(--border)',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = 'var(--bg2)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg1)';
        }}
      >
        {loading ? 'Cleaning...' : 'Cleanup Idle'}
      </button>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className="px-3 py-1.5 text-xs rounded transition-colors"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'white',
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}
