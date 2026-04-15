import { useState } from 'react';
import { lifecycleSetPolicy } from '../../lib/backend-lifecycle';

interface LifecyclePolicyEditorProps {
  onSave?: () => void;
}

export function LifecyclePolicyEditor({ onSave }: LifecyclePolicyEditorProps) {
  const [policy, setPolicy] = useState({
    idleTimeoutSecs: 300, // 5 minutes
    hibernateTimeoutSecs: 1800, // 30 minutes
    destroyTimeoutSecs: 86400, // 24 hours
    maxSessionAgeSecs: 604800, // 7 days
    keepAliveIntervalSecs: 30, // 30 seconds
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await lifecycleSetPolicy(policy);
      onSave?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const formatSeconds = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
        Lifecycle Policy
      </h3>

      <div className="space-y-3">
        <PolicyField
          label="Idle Timeout"
          value={policy.idleTimeoutSecs}
          onChange={(v) => setPolicy({ ...policy, idleTimeoutSecs: v })}
          min={60}
          max={3600}
          step={60}
          formatValue={formatSeconds}
        />

        <PolicyField
          label="Hibernate Timeout"
          value={policy.hibernateTimeoutSecs}
          onChange={(v) => setPolicy({ ...policy, hibernateTimeoutSecs: v })}
          min={300}
          max={7200}
          step={300}
          formatValue={formatSeconds}
        />

        <PolicyField
          label="Destroy Timeout"
          value={policy.destroyTimeoutSecs}
          onChange={(v) => setPolicy({ ...policy, destroyTimeoutSecs: v })}
          min={3600}
          max={604800}
          step={3600}
          formatValue={formatSeconds}
        />

        <PolicyField
          label="Max Session Age"
          value={policy.maxSessionAgeSecs}
          onChange={(v) => setPolicy({ ...policy, maxSessionAgeSecs: v })}
          min={86400}
          max={2592000}
          step={86400}
          formatValue={formatSeconds}
        />

        <PolicyField
          label="Keep-Alive Interval"
          value={policy.keepAliveIntervalSecs}
          onChange={(v) => setPolicy({ ...policy, keepAliveIntervalSecs: v })}
          min={10}
          max={300}
          step={10}
          formatValue={formatSeconds}
        />
      </div>

      {error && (
        <div
          className="text-xs p-2 rounded"
          style={{
            backgroundColor: '#ef444420',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 text-sm rounded transition-colors"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'white',
        }}
        onMouseEnter={(e) => {
          if (!saving) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        {saving ? 'Saving...' : 'Save Policy'}
      </button>
    </div>
  );
}

interface PolicyFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
}

function PolicyField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
}: PolicyFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs" style={{ color: 'var(--text1)' }}>
          {label}
        </label>
        <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
          {formatValue(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{
          accentColor: 'var(--accent)',
        }}
      />
    </div>
  );
}
