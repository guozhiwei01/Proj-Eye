import { useState } from 'react';
import { healthCheckSetConfig, HealthCheckConfig } from '../../lib/backend-health';

interface HealthConfigEditorProps {
  onSave?: () => void;
}

export function HealthConfigEditor({ onSave }: HealthConfigEditorProps) {
  const [config, setConfig] = useState<HealthCheckConfig>({
    interval_ms: 30000,
    timeout_ms: 5000,
    failure_threshold: 3,
    success_threshold: 2,
    enabled: true,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await healthCheckSetConfig(config);
      onSave?.();
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
        Health Check Configuration
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Check Interval: {(config.interval_ms / 1000).toFixed(0)}s
          </label>
          <input
            type="range"
            min={5000}
            max={300000}
            step={5000}
            value={config.interval_ms}
            onChange={(e) =>
              setConfig({ ...config, interval_ms: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Timeout: {(config.timeout_ms / 1000).toFixed(1)}s
          </label>
          <input
            type="range"
            min={1000}
            max={30000}
            step={1000}
            value={config.timeout_ms}
            onChange={(e) =>
              setConfig({ ...config, timeout_ms: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Failure Threshold: {config.failure_threshold}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={config.failure_threshold}
            onChange={(e) =>
              setConfig({ ...config, failure_threshold: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text1)' }}>
            Success Threshold: {config.success_threshold}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={config.success_threshold}
            onChange={(e) =>
              setConfig({ ...config, success_threshold: Number(e.target.value) })
            }
            className="w-full"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          <label htmlFor="enabled" className="text-xs" style={{ color: 'var(--text1)' }}>
            Enable automatic health checks
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
        {saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}
