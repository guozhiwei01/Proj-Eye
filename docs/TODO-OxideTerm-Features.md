# TODO List - OxideTerm-Inspired Features

## 🎯 Overview

This TODO list tracks the implementation of features inspired by the OxideTerm project, focusing on enhancing connection reliability, performance, and user experience.

---

## 📋 PR18: Grace Period Reconnect ⭐⭐⭐⭐⭐

**Priority**: HIGHEST  
**Estimated Time**: 2-3 days  
**Status**: 📋 Not Started  

### Backend Tasks

- [ ] **Setup** (30 min)
  - [ ] Read existing `src-tauri/src/runtime/reconnect.rs`
  - [ ] Understand current reconnect flow from PR11
  - [ ] Plan integration points

- [ ] **Core Implementation** (4-6 hours)
  - [ ] Add `GracePeriodConfig` struct
    ```rust
    pub struct GracePeriodConfig {
        pub duration_secs: u64,      // Default: 30
        pub probe_interval_secs: u64, // Default: 2
        pub enabled: bool,            // Default: true
    }
    ```
  - [ ] Add `OldConnectionHandle` struct to store SSH channel references
  - [ ] Add `old_connections: DashMap<String, OldConnectionHandle>` to `ReconnectManager`
  - [ ] Implement `try_grace_period_recovery()` method
  - [ ] Implement `probe_connection()` with SSH keepalive packets
  - [ ] Implement `emit_grace_period_progress()` for UI updates

- [ ] **Integration** (2-3 hours)
  - [ ] Modify `reconnect_start` to call grace period first
  - [ ] Store old connection handle when connection is lost
  - [ ] Clean up old connection handle after grace period
  - [ ] Ensure fallback to exponential backoff works

- [ ] **Tauri Commands** (1 hour)
  - [ ] Add `reconnect_set_grace_period_config` command
  - [ ] Add `reconnect_get_grace_period_config` command
  - [ ] Register commands in `src-tauri/src/lib.rs`

- [ ] **Testing** (2 hours)
  - [ ] Test with `cargo check`
  - [ ] Test with `cargo clippy`
  - [ ] Manual test: WiFi switch scenario
  - [ ] Manual test: VPN reconnect scenario
  - [ ] Manual test: dead connection scenario

### Frontend Tasks

- [ ] **Backend API** (1 hour)
  - [ ] Add `GracePeriodConfig` interface to `src/lib/backend-reconnect.ts`
  - [ ] Add `reconnectSetGracePeriodConfig()` function
  - [ ] Add `reconnectGetGracePeriodConfig()` function

- [ ] **Hook Enhancement** (2 hours)
  - [ ] Add `ReconnectPhase` type: `'connected' | 'grace_period' | 'reconnecting' | 'failed'`
  - [ ] Add `GracePeriodProgress` interface
  - [ ] Enhance `useReconnect` hook to handle grace period events
  - [ ] Add event listener for `grace_period_progress` events

- [ ] **UI Components** (3-4 hours)
  - [ ] Create `GracePeriodBanner.tsx` component
    - [ ] Show countdown timer
    - [ ] Show progress bar
    - [ ] Show "Recovering old connection..." message
  - [ ] Integrate banner into `TerminalPane.tsx`
  - [ ] Add grace period config section to `ReconnectStrategyEditor.tsx`
    - [ ] Enable/disable toggle
    - [ ] Duration slider (10-60s)
    - [ ] Probe interval slider (1-5s)
  - [ ] Update `ReconnectPanel.tsx` to show grace period stats

- [ ] **Testing** (1 hour)
  - [ ] Test with `npm run build` (TypeScript check)
  - [ ] Manual test: UI updates during grace period
  - [ ] Manual test: Configuration changes persist
  - [ ] Manual test: Banner appears/disappears correctly

### Documentation

- [ ] **Code Documentation** (30 min)
  - [ ] Add Rust doc comments to new structs/methods
  - [ ] Add JSDoc comments to new TypeScript functions

- [ ] **User Documentation** (1 hour)
  - [ ] Update CLAUDE.md with PR18 completion
  - [ ] Document grace period feature in user guide
  - [ ] Add configuration examples

### Commit & Push

- [ ] **Git Workflow**
  - [ ] Commit backend changes: `feat(PR18): implement grace period reconnect backend`
  - [ ] Commit frontend changes: `feat(PR18): add grace period UI and configuration`
  - [ ] Commit documentation: `docs(PR18): document grace period reconnect feature`
  - [ ] Push to GitHub

---

## 📋 PR19: Dual-Plane Communication ⭐⭐⭐⭐☆

**Priority**: HIGH  
**Estimated Time**: 5-7 days  
**Status**: 📋 Not Started  
**Depends On**: None (can start after PR18)

### Backend Tasks

- [ ] **WebSocket Server Setup** (4-6 hours)
  - [ ] Create `src-tauri/src/runtime/websocket_server.rs`
  - [ ] Implement `TerminalWebSocketServer` struct
  - [ ] Add Tokio TCP listener on `127.0.0.1:9527`
  - [ ] Implement WebSocket handshake with `tokio-tungstenite`
  - [ ] Add connection handler with session routing

- [ ] **Frame Protocol** (2-3 hours)
  - [ ] Design binary frame format: `[session_id_len(1)][session_id][payload]`
  - [ ] Implement frame parser
  - [ ] Implement frame serializer
  - [ ] Add frame validation

- [ ] **Session Integration** (3-4 hours)
  - [ ] Connect WebSocket to SSH session stdin/stdout
  - [ ] Add bidirectional data forwarding
  - [ ] Handle WebSocket disconnection gracefully
  - [ ] Add session cleanup on WebSocket close

- [ ] **Tauri Commands** (2 hours)
  - [ ] Add `websocket_start_server` command
  - [ ] Add `websocket_stop_server` command
  - [ ] Add `websocket_get_port` command
  - [ ] Add `websocket_get_stats` command

- [ ] **Testing** (3 hours)
  - [ ] Test WebSocket server startup
  - [ ] Test frame parsing/serialization
  - [ ] Test concurrent connections
  - [ ] Test high-throughput data transfer
  - [ ] Test graceful shutdown

### Frontend Tasks

- [ ] **WebSocket Client** (4-5 hours)
  - [ ] Create `src/lib/terminal-websocket.ts`
  - [ ] Implement `TerminalWebSocket` class
  - [ ] Add connection management (connect/disconnect/reconnect)
  - [ ] Implement frame encoding/decoding
  - [ ] Add error handling and retry logic

- [ ] **Terminal Integration** (3-4 hours)
  - [ ] Modify `TerminalPane.tsx` to use WebSocket for data
  - [ ] Keep Tauri IPC for control commands (resize, pause, etc.)
  - [ ] Add WebSocket connection status indicator
  - [ ] Handle WebSocket reconnection on network issues

- [ ] **Hook Enhancement** (2 hours)
  - [ ] Create `useTerminalWebSocket` hook
  - [ ] Add connection state management
  - [ ] Add automatic reconnection logic
  - [ ] Add data buffering during reconnection

- [ ] **Performance Monitoring** (2 hours)
  - [ ] Add latency tracking
  - [ ] Add throughput metrics
  - [ ] Add WebSocket stats to monitoring UI

- [ ] **Testing** (2 hours)
  - [ ] Test WebSocket connection establishment
  - [ ] Test data transmission (stdin/stdout)
  - [ ] Test reconnection on network loss
  - [ ] Test performance vs. pure Tauri IPC

### Documentation

- [ ] **Architecture Documentation** (2 hours)
  - [ ] Document dual-plane architecture design
  - [ ] Add sequence diagrams
  - [ ] Document frame protocol specification

- [ ] **Code Documentation** (1 hour)
  - [ ] Add Rust doc comments
  - [ ] Add JSDoc comments
  - [ ] Add inline comments for complex logic

### Commit & Push

- [ ] **Git Workflow**
  - [ ] Commit backend: `feat(PR19): implement WebSocket server for terminal data`
  - [ ] Commit frontend: `feat(PR19): add WebSocket client for dual-plane communication`
  - [ ] Commit docs: `docs(PR19): document dual-plane architecture`
  - [ ] Push to GitHub

---

## 📋 PR20: SFTP File Manager ⭐⭐⭐☆☆

**Priority**: MEDIUM  
**Estimated Time**: 7-10 days  
**Status**: 📋 Not Started  
**Depends On**: None (can start after PR18)

### Backend Tasks

- [ ] **SFTP Session Management** (3-4 hours)
  - [ ] Create `src-tauri/src/runtime/sftp.rs`
  - [ ] Implement SFTP session creation from SSH connection
  - [ ] Add session pooling (reuse connection pool from PR9)
  - [ ] Add session lifecycle management

- [ ] **File Operations** (6-8 hours)
  - [ ] Implement `sftp_list_dir` command
  - [ ] Implement `sftp_read_file` command
  - [ ] Implement `sftp_write_file` command
  - [ ] Implement `sftp_delete` command
  - [ ] Implement `sftp_rename` command
  - [ ] Implement `sftp_mkdir` command
  - [ ] Implement `sftp_stat` command (file metadata)

- [ ] **Transfer Management** (4-5 hours)
  - [ ] Implement chunked upload with progress
  - [ ] Implement chunked download with progress
  - [ ] Add transfer queue management
  - [ ] Add concurrent transfer limit (max 3)
  - [ ] Add transfer cancellation support

- [ ] **Tauri Commands** (2 hours)
  - [ ] Register all SFTP commands in `src-tauri/src/commands/sftp.rs`
  - [ ] Add transfer progress events
  - [ ] Add error handling for all operations

- [ ] **Testing** (3 hours)
  - [ ] Test file listing
  - [ ] Test upload/download
  - [ ] Test large file transfers (>100MB)
  - [ ] Test concurrent transfers
  - [ ] Test error scenarios (permission denied, disk full, etc.)

### Frontend Tasks

- [ ] **Backend API** (2 hours)
  - [ ] Create `src/lib/backend-sftp.ts`
  - [ ] Add all SFTP operation functions
  - [ ] Add TypeScript interfaces for file entries
  - [ ] Add transfer progress types

- [ ] **Hooks** (4-5 hours)
  - [ ] Create `useSFTPDirectory` hook
  - [ ] Create `useSFTPTransfer` hook
  - [ ] Create `useSFTPOperations` hook
  - [ ] Add file operation state management

- [ ] **UI Components** (12-15 hours)
  - [ ] Create `SFTPPanel.tsx` (main container)
  - [ ] Create `FilePane.tsx` (single pane with file list)
  - [ ] Create `FileList.tsx` (file/folder list with icons)
  - [ ] Create `FileEntry.tsx` (single file/folder row)
  - [ ] Create `PathBreadcrumb.tsx` (navigation breadcrumb)
  - [ ] Create `TransferQueue.tsx` (active transfers list)
  - [ ] Create `TransferProgress.tsx` (single transfer progress bar)
  - [ ] Create `FilePreview.tsx` (text/image preview)
  - [ ] Create `FileContextMenu.tsx` (right-click menu)

- [ ] **Features** (8-10 hours)
  - [ ] Implement dual-pane layout (local + remote)
  - [ ] Add drag-and-drop upload/download
  - [ ] Add file selection (single/multiple)
  - [ ] Add keyboard shortcuts (Ctrl+C, Ctrl+V, Delete, etc.)
  - [ ] Add file preview (text files, images)
  - [ ] Add file search/filter
  - [ ] Add sorting (name, size, date)

- [ ] **Testing** (3 hours)
  - [ ] Test file browsing
  - [ ] Test upload/download
  - [ ] Test drag-and-drop
  - [ ] Test keyboard shortcuts
  - [ ] Test file preview
  - [ ] Test error handling

### Documentation

- [ ] **User Guide** (2 hours)
  - [ ] Document SFTP file manager usage
  - [ ] Add screenshots
  - [ ] Document keyboard shortcuts

- [ ] **Code Documentation** (1 hour)
  - [ ] Add Rust doc comments
  - [ ] Add JSDoc comments

### Commit & Push

- [ ] **Git Workflow**
  - [ ] Commit backend: `feat(PR20): implement SFTP file operations`
  - [ ] Commit frontend hooks: `feat(PR20): add SFTP hooks and state management`
  - [ ] Commit UI components: `feat(PR20): add SFTP file manager UI`
  - [ ] Commit features: `feat(PR20): add drag-drop and file preview`
  - [ ] Commit docs: `docs(PR20): document SFTP file manager`
  - [ ] Push to GitHub

---

## 📊 Progress Tracking

### Overall Progress

- **PR18 (Grace Period Reconnect)**: 0% (0/30 tasks)
- **PR19 (Dual-Plane Communication)**: 0% (0/35 tasks)
- **PR20 (SFTP File Manager)**: 0% (0/50 tasks)

### Time Estimates

| PR | Estimated Time | Actual Time | Status |
|----|---------------|-------------|--------|
| PR18 | 2-3 days | - | 📋 Not Started |
| PR19 | 5-7 days | - | 📋 Not Started |
| PR20 | 7-10 days | - | 📋 Not Started |

### Milestones

- [ ] **Week 1**: Complete PR18 (Grace Period Reconnect)
- [ ] **Week 2-3**: Complete PR19 (Dual-Plane Communication)
- [ ] **Week 4-5**: Complete PR20 (SFTP File Manager)

---

## 🎯 Success Criteria

### PR18
- ✅ Grace period recovery rate > 70% for temporary network issues
- ✅ TUI applications preserve state in 90%+ of recoveries
- ✅ Clear UI feedback with countdown timer
- ✅ Configurable grace period settings

### PR19
- ✅ Terminal data throughput > 10MB/s
- ✅ Latency < 10ms for control commands
- ✅ No data loss during WebSocket reconnection
- ✅ Reduced Tauri IPC pressure by 80%+

### PR20
- ✅ File transfer speed > 5MB/s
- ✅ Support files up to 1GB
- ✅ Drag-and-drop works smoothly
- ✅ File preview for common formats (txt, json, png, jpg)
- ✅ Concurrent transfers (max 3) work correctly

---

## 📝 Notes

### Development Tips

1. **PR18 (Grace Period)**
   - Start with backend implementation
   - Test with real network interruptions (WiFi switch, VPN disconnect)
   - Focus on preserving TUI application state

2. **PR19 (Dual-Plane)**
   - Study OxideTerm's WebSocket implementation
   - Test with high-throughput scenarios (cat large file)
   - Ensure backward compatibility with existing Tauri IPC

3. **PR20 (SFTP)**
   - Reuse connection pool from PR9
   - Implement chunked transfers for large files
   - Add comprehensive error handling

### Testing Strategy

- **Unit Tests**: Not available (no test framework)
- **Type Checks**: `npm run build` (TypeScript), `cargo clippy` (Rust)
- **Manual Tests**: Real-world scenarios with actual SSH servers
- **Performance Tests**: Measure latency, throughput, memory usage

### Git Commit Convention

```
feat(PR##): <description>
fix(PR##): <description>
docs(PR##): <description>
refactor(PR##): <description>
test(PR##): <description>
```

---

## 🔗 References

- **OxideTerm Project**: https://github.com/AnalyseDeCircuit/oxideterm
- **OxideTerm README**: https://github.com/AnalyseDeCircuit/oxideterm/blob/main/docs/readme/README.zh-Hans.md
- **Proj-Eye CLAUDE.md**: `/Users/guozhiwei/Desktop/project/rust/Proj-Eye/CLAUDE.md`
- **PR18 Spec**: `/Users/guozhiwei/Desktop/project/rust/Proj-Eye/docs/refactor/PR18-Grace-Period-Reconnect.md`

---

**Last Updated**: 2024-01-XX  
**Next Review**: After PR18 completion
