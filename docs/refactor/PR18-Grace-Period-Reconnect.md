# PR18: Grace Period Reconnect

**Status**: 📋 Planned  
**Priority**: ⭐⭐⭐⭐⭐ (Highest)  
**Inspired by**: OxideTerm's Grace Period technology  
**Estimated effort**: 2-3 days  

## 🎯 Goal

Enhance the existing auto-reconnect mechanism (PR11) with a grace period probing phase that attempts to recover the old connection before creating a new one. This provides seamless recovery for TUI applications (vim, htop, tmux) that would otherwise lose state during reconnection.

## 📋 Current State (PR11)

```rust
// Existing: Immediate exponential backoff
Connection lost → Wait 1s → Reconnect attempt 1
                → Wait 2s → Reconnect attempt 2
                → Wait 4s → Reconnect attempt 3
                ...
```

**Problem**: Every reconnect creates a NEW SSH connection, losing:
- vim unsaved buffers
- htop display state
- tmux session attachment
- Any TUI application state

## 🚀 New Behavior (PR18)

```rust
// Enhanced: Grace period probing first
Connection lost → Grace Period (30s)
                  ├─ Probe every 2s (15 attempts)
                  ├─ If old connection recovers → Reuse it (seamless!)
                  └─ If all probes fail → Exponential backoff (PR11)
```

**Benefit**: If the network hiccup is temporary (WiFi switch, VPN reconnect), the old connection may still be alive. Probing it first preserves all TUI state.

## 🏗️ Architecture

### Backend Changes

#### 1. Enhance `reconnect.rs`

```rust
// src-tauri/src/runtime/reconnect.rs

pub struct GracePeriodConfig {
    pub duration_secs: u64,      // Default: 30
    pub probe_interval_secs: u64, // Default: 2
    pub enabled: bool,            // Default: true
}

pub struct ReconnectManager {
    // Existing fields...
    grace_period_config: GracePeriodConfig,
    old_connections: DashMap<String, OldConnectionHandle>,
}

pub struct OldConnectionHandle {
    pub session_id: String,
    pub ssh_channel: SshChannel,
    pub last_seen: Instant,
}

impl ReconnectManager {
    /// Phase 1: Grace period probing
    pub async fn try_grace_period_recovery(
        &self,
        session_id: &str,
    ) -> Result<bool, String> {
        let config = &self.grace_period_config;
        if !config.enabled {
            return Ok(false);
        }

        let start = Instant::now();
        let max_duration = Duration::from_secs(config.duration_secs);
        let probe_interval = Duration::from_secs(config.probe_interval_secs);

        while start.elapsed() < max_duration {
            // Emit progress event
            self.emit_grace_period_progress(
                session_id,
                start.elapsed().as_secs(),
                config.duration_secs,
            );

            // Try to probe old connection
            if let Some(old_conn) = self.old_connections.get(session_id) {
                if self.probe_connection(&old_conn).await {
                    info!("Grace period success: old connection recovered");
                    return Ok(true);
                }
            }

            tokio::time::sleep(probe_interval).await;
        }

        warn!("Grace period exhausted, old connection is dead");
        Ok(false)
    }

    /// Send lightweight keepalive probe
    async fn probe_connection(&self, handle: &OldConnectionHandle) -> bool {
        // Try to send SSH keepalive packet
        match handle.ssh_channel.send_keepalive().await {
            Ok(_) => {
                // Wait for response with 1s timeout
                match tokio::time::timeout(
                    Duration::from_secs(1),
                    handle.ssh_channel.recv_keepalive_response(),
                )
                .await
                {
                    Ok(Ok(_)) => true,
                    _ => false,
                }
            }
            Err(_) => false,
        }
    }

    /// Phase 2: Fallback to exponential backoff (existing PR11 logic)
    pub async fn exponential_backoff_reconnect(
        &self,
        session_id: &str,
    ) -> Result<(), String> {
        // Existing PR11 implementation...
    }

    /// Main entry point
    pub async fn reconnect_with_grace_period(
        &mut self,
        session_id: &str,
    ) -> Result<(), String> {
        // Phase 1: Grace period
        if self.try_grace_period_recovery(session_id).await? {
            self.emit_reconnect_success(session_id, "grace_period");
            return Ok(());
        }

        // Phase 2: Exponential backoff
        self.exponential_backoff_reconnect(session_id).await?;
        self.emit_reconnect_success(session_id, "new_connection");
        Ok(())
    }

    fn emit_grace_period_progress(&self, session_id: &str, elapsed: u64, total: u64) {
        // Emit Tauri event
        self.app_handle.emit_all(
            "proj-eye://runtime/reconnect",
            json!({
                "type": "grace_period_progress",
                "session_id": session_id,
                "elapsed": elapsed,
                "total": total,
            }),
        );
    }
}
```

#### 2. New Tauri Commands

```rust
// src-tauri/src/commands/reconnect.rs

#[tauri::command]
pub async fn reconnect_set_grace_period_config(
    duration_secs: u64,
    probe_interval_secs: u64,
    enabled: bool,
) -> Result<(), String> {
    let manager = RECONNECT_MANAGER.get().unwrap();
    manager.set_grace_period_config(GracePeriodConfig {
        duration_secs,
        probe_interval_secs,
        enabled,
    });
    Ok(())
}

#[tauri::command]
pub async fn reconnect_get_grace_period_config() -> Result<GracePeriodConfig, String> {
    let manager = RECONNECT_MANAGER.get().unwrap();
    Ok(manager.get_grace_period_config())
}
```

### Frontend Changes

#### 1. Backend API

```typescript
// src/lib/backend-reconnect.ts

export interface GracePeriodConfig {
  durationSecs: number;
  probeIntervalSecs: number;
  enabled: boolean;
}

export async function reconnectSetGracePeriodConfig(
  config: GracePeriodConfig
): Promise<void> {
  return invoke('reconnect_set_grace_period_config', {
    durationSecs: config.durationSecs,
    probeIntervalSecs: config.probeIntervalSecs,
    enabled: config.enabled,
  });
}

export async function reconnectGetGracePeriodConfig(): Promise<GracePeriodConfig> {
  return invoke('reconnect_get_grace_period_config');
}
```

#### 2. Enhanced Hook

```typescript
// src/hooks/useReconnect.ts

export type ReconnectPhase = 
  | 'connected'
  | 'grace_period'
  | 'reconnecting'
  | 'failed';

export interface GracePeriodProgress {
  elapsed: number;
  total: number;
  percentage: number;
}

export function useReconnectWithGracePeriod(sessionId: string) {
  const [phase, setPhase] = useState<ReconnectPhase>('connected');
  const [graceProgress, setGraceProgress] = useState<GracePeriodProgress | null>(null);

  useEffect(() => {
    const unlisten = listen('proj-eye://runtime/reconnect', (event: any) => {
      if (event.payload.session_id !== sessionId) return;

      switch (event.payload.type) {
        case 'grace_period_progress':
          setPhase('grace_period');
          setGraceProgress({
            elapsed: event.payload.elapsed,
            total: event.payload.total,
            percentage: (event.payload.elapsed / event.payload.total) * 100,
          });
          break;
        case 'reconnect_success':
          setPhase('connected');
          setGraceProgress(null);
          break;
        case 'reconnect_failed':
          setPhase('failed');
          setGraceProgress(null);
          break;
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [sessionId]);

  return { phase, graceProgress };
}
```

#### 3. UI Component

```tsx
// src/components/Terminal/GracePeriodBanner.tsx

export function GracePeriodBanner({ sessionId }: { sessionId: string }) {
  const { phase, graceProgress } = useReconnectWithGracePeriod(sessionId);

  if (phase !== 'grace_period' || !graceProgress) {
    return null;
  }

  return (
    <div
      className="grace-period-banner"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--warning-bg)',
        borderBottom: '1px solid var(--warning-border)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1000,
      }}
    >
      <div className="spinner" />
      <span style={{ color: 'var(--warning-text)', fontSize: '13px' }}>
        🔄 连接中断，正在尝试恢复旧连接...
      </span>
      <div
        className="progress-bar"
        style={{
          flex: 1,
          height: '4px',
          backgroundColor: 'var(--warning-bg-dark)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${graceProgress.percentage}%`,
            height: '100%',
            backgroundColor: 'var(--warning)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ color: 'var(--warning-text)', fontSize: '12px' }}>
        {graceProgress.elapsed}s / {graceProgress.total}s
      </span>
    </div>
  );
}
```

#### 4. Integration

```tsx
// src/components/Terminal/TerminalPane.tsx

export function TerminalPane({ sessionId }: Props) {
  return (
    <div className="terminal-pane">
      <GracePeriodBanner sessionId={sessionId} />
      <XTerminal sessionId={sessionId} />
    </div>
  );
}
```

#### 5. Settings UI

```tsx
// src/components/Reconnect/ReconnectStrategyEditor.tsx

export function ReconnectStrategyEditor() {
  const [config, setConfig] = useState<GracePeriodConfig>({
    durationSecs: 30,
    probeIntervalSecs: 2,
    enabled: true,
  });

  useEffect(() => {
    reconnectGetGracePeriodConfig().then(setConfig);
  }, []);

  const handleSave = async () => {
    await reconnectSetGracePeriodConfig(config);
  };

  return (
    <div className="grace-period-config">
      <h3>宽限期重连配置</h3>
      
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />
        启用宽限期探测
      </label>

      <label>
        宽限期时长（秒）
        <input
          type="number"
          value={config.durationSecs}
          onChange={(e) => setConfig({ ...config, durationSecs: +e.target.value })}
          min={10}
          max={60}
        />
      </label>

      <label>
        探测间隔（秒）
        <input
          type="number"
          value={config.probeIntervalSecs}
          onChange={(e) => setConfig({ ...config, probeIntervalSecs: +e.target.value })}
          min={1}
          max={5}
        />
      </label>

      <button onClick={handleSave}>保存配置</button>
    </div>
  );
}
```

## 📊 Testing Plan

### Manual Testing

1. **WiFi Switch Test**
   - Open vim in terminal
   - Switch WiFi network
   - Verify: Grace period banner appears
   - Verify: Old connection recovers within 30s
   - Verify: vim state is preserved

2. **VPN Reconnect Test**
   - Open htop in terminal
   - Disconnect VPN
   - Reconnect VPN within 30s
   - Verify: Grace period succeeds
   - Verify: htop display is intact

3. **Dead Connection Test**
   - Open terminal
   - Kill SSH server
   - Verify: Grace period fails after 30s
   - Verify: Exponential backoff starts
   - Verify: New connection is created

### Edge Cases

- Grace period disabled → Should skip directly to exponential backoff
- Multiple sessions reconnecting → Should handle concurrently
- Grace period timeout → Should clean up old connection handle

## 📈 Success Metrics

- ✅ Grace period recovery rate > 70% for temporary network issues
- ✅ TUI application state preserved in 90%+ of grace period successes
- ✅ No performance degradation during probing
- ✅ Clear UI feedback during grace period

## 🔗 Dependencies

- Requires: PR11 (Auto Reconnect) ✅
- Blocks: None
- Related: PR19 (Dual-Plane Communication) - can be developed in parallel

## 📝 Implementation Checklist

### Backend
- [ ] Add `GracePeriodConfig` struct to `reconnect.rs`
- [ ] Implement `try_grace_period_recovery()` method
- [ ] Implement `probe_connection()` with SSH keepalive
- [ ] Add `old_connections` DashMap to store connection handles
- [ ] Emit grace period progress events
- [ ] Add `reconnect_set_grace_period_config` command
- [ ] Add `reconnect_get_grace_period_config` command
- [ ] Update `reconnect_start` to use grace period first

### Frontend
- [ ] Add `GracePeriodConfig` type to `backend-reconnect.ts`
- [ ] Add `reconnectSetGracePeriodConfig` API
- [ ] Add `reconnectGetGracePeriodConfig` API
- [ ] Enhance `useReconnect` hook with grace period phase
- [ ] Create `GracePeriodBanner` component
- [ ] Integrate banner into `TerminalPane`
- [ ] Add grace period config to `ReconnectStrategyEditor`
- [ ] Add grace period section to `ReconnectPanel`

### Testing
- [ ] Test WiFi switch scenario
- [ ] Test VPN reconnect scenario
- [ ] Test dead connection scenario
- [ ] Test grace period disabled
- [ ] Test concurrent reconnects
- [ ] Test grace period timeout

### Documentation
- [ ] Update CLAUDE.md with PR18 completion
- [ ] Add grace period explanation to user docs
- [ ] Document configuration options

## 🎯 Acceptance Criteria

1. ✅ Grace period probing works for temporary network issues
2. ✅ TUI applications (vim/htop/tmux) preserve state on recovery
3. ✅ Fallback to exponential backoff when old connection is dead
4. ✅ Clear UI feedback with countdown timer
5. ✅ Configurable grace period duration and probe interval
6. ✅ No performance impact on normal connections
7. ✅ All TypeScript types are correct
8. ✅ All Rust code passes `cargo clippy`
