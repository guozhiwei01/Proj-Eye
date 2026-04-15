import { useState, useEffect } from 'react';
import {
  reconnectSetStrategy,
  ReconnectStrategy,
  reconnectGetGracePeriodConfig,
  reconnectSetGracePeriodConfig,
  GracePeriodConfig,
} from '../../lib/backend-reconnect';

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

  const [gracePeriod, setGracePeriod] = useState<GracePeriodConfig>({
    enabled: true,
    duration_secs: 30,
    probe_interval_secs: 2,
  });

  const [saving, setSaving] = useState(false);

  // Load grace period config on mount
  useEffect(() => {
    reconnectGetGracePeriodConfig().then((config) => {
      setGracePeriod(config);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await reconnectSetStrategy(strategy);
      await reconnectSetGracePeriodConfig(gracePeriod);
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

      {/* Grace Period Configuration */}
      <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text0)' }}>
          Grace Period (宽限期重连)
        </h3>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="grace-enabled"
              checked={gracePeriod.enabled}
              onChange={(e) => setGracePeriod({ ...gracePeriod, enabled: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            <label htmlFor="grace-enabled" className="text-xs" style={{ color: 'var(--text1)' }}>
              启用宽限期探测（尝试恢复旧连接）
            </label>
          </div>

          {gracePeriod.enabled && (
            <>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
                  宽限期时长: {gracePeriod.duration_secs}s
                </label>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={gracePeriod.duration_secs}
                  onChange={(e) =>
                    setGracePeriod({ ...gracePeriod, duration_secs: Number(e.target.value) })
                  }
                  className="w-full"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                  在此时间内尝试恢复旧连接，保护 vim/htop 等 TUI 应用状态
                </p>
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
                  探测间隔: {gracePeriod.probe_interval_secs}s
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={gracePeriod.probe_interval_secs}
                  onChange={(e) =>
                    setGracePeriod({ ...gracePeriod, probe_interval_secs: Number(e.target.value) })
                  }
                  className="w-full"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
                  每隔此时间发送一次探测包检查旧连接是否存活
                </p>
              </div>
            </>
          )}
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
