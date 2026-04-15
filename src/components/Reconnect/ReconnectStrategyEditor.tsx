import React, { useState } from 'react';
import { reconnectSetStrategy, ReconnectStrategy } from '../../lib/backend-reconnect';

interface ReconnectStrategyEditorProps {
  onSave?: () => void;
}

export function ReconnectStrategyEditor({ onSave }: ReconnectStrategyEditorProps) {
  const [strategy, setStrategy] = useState<ReconnectStrategy>({
    max_attempts: 5,
    initial_delay_ms: 1000,
    max_delay_ms: 30000,
    backoff_multiplier: 2.0,
    jitter: true,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await reconnectSetStrategy(strategy);
      onSave?.();
    } catch (err) {
      console.error('Failed to save strategy:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
        Reconnect Strategy
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Max Attempts: {strategy.max_attempts}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={strategy.max_attempts}
            onChange={(e) =>
              setStrategy({ ...strategy, max_attempts: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Initial Delay: {(strategy.initial_delay_ms / 1000).toFixed(1)}s
          </label>
          <input
            type="range"
            min={500}
            max={5000}
            step={500}
            value={strategy.initial_delay_ms}
            onChange={(e) =>
              setStrategy({ ...strategy, initial_delay_ms: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Max Delay: {(strategy.max_delay_ms / 1000).toFixed(0)}s
          </label>
          <input
            type="range"
            min={10000}
            max={60000}
            step={5000}
            value={strategy.max_delay_ms}
            onChange={(e) =>
              setStrategy({ ...strategy, max_delay_ms: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Backoff Multiplier: {strategy.backoff_multiplier.toFixed(1)}x
          </label>
          <input
            type="range"
            min={1.5}
            max={3.0}
            step={0.1}
            value={strategy.backoff_multiplier}
            onChange={(e) =>
              setStrategy({ ...strategy, backoff_multiplier: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="jitter"
            checked={strategy.jitter}
            onChange={(e) => setStrategy({ ...strategy, jitter: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          <label htmlFor="jitter" className="text-xs" style={{ color: 'var(--text1)' }}>
            Enable jitter (±25% random delay)
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 text-sm rounded transition-colors"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'white',
        }}
      >
        {saving ? 'Saving...' : 'Save Strategy'}
      </button>
    </div>
  );
}
