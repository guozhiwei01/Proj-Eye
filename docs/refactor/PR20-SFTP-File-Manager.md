# PR20: SFTP File Manager ⭐⭐⭐☆☆

**Status**: 🚧 IN PROGRESS  
**Priority**: Medium  
**Estimated Effort**: 3-4 days  
**Inspiration**: OxideTerm SFTP integration

## 📋 Overview

Add integrated SFTP file manager to enable seamless file operations between local and remote systems within the SSH terminal workspace. Reuses existing connection pool infrastructure for efficient SFTP session management.

## 🎯 Goals

1. **Dual-Pane File Browser**: Side-by-side local and remote file navigation
2. **Core File Operations**: Upload, download, delete, rename, mkdir
3. **Drag-and-Drop Support**: Intuitive file transfer between panes
4. **File Preview**: Text and image preview for quick inspection
5. **Progress Tracking**: Real-time feedback for large file transfers
6. **Connection Reuse**: Leverage existing connection pool for SFTP sessions

## 🏗️ Architecture

### Backend (Rust)

```
src-tauri/src/
├── runtime/
│   └── sftp.rs          # New: SFTP session management
├── commands/
│   └── sftp.rs          # New: SFTP Tauri commands
└── store/
    └── runtime.rs       # Modified: Add SFTP session tracking
```

### Frontend (TypeScript)

```
src/
├── lib/
│   └── backend-sftp.ts  # New: SFTP API wrapper
├── hooks/
│   ├── useSFTP.ts       # New: SFTP operations hook
│   └── useFileTransfer.ts # New: Transfer progress tracking
└── components/
    └── SFTP/
        ├── SFTPPanel.tsx           # Main SFTP panel
        ├── FilePane.tsx            # Local/Remote file pane
        ├── FileList.tsx            # File list with icons
        ├── FilePreview.tsx         # Text/image preview
        ├── TransferProgress.tsx    # Upload/download progress
        └── FileOperations.tsx      # Action buttons
```

## 📦 Data Structures

### Rust Types

```rust
// src-tauri/src/runtime/sftp.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpSession {
    pub session_id: String,
    pub server_id: String,
    pub connection_id: String,
    pub current_remote_path: String,
    pub created_at: u64,
    pub last_activity: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub permissions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    pub transfer_id: String,
    pub operation: TransferOperation,
    pub local_path: String,
    pub remote_path: String,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub status: TransferStatus,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferOperation {
    Upload,
    Download,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransferStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}
```

### TypeScript Types

```typescript
// src/lib/backend-sftp.ts

export interface SftpSession {
  session_id: string;
  server_id: string;
  connection_id: string;
  current_remote_path: string;
  created_at: number;
  last_activity: number;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  permissions: string;
}

export interface TransferProgress {
  transfer_id: string;
  operation: 'Upload' | 'Download';
  local_path: string;
  remote_path: string;
  total_bytes: number;
  transferred_bytes: number;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled';
  error?: string;
}
```

## 🔌 Tauri Commands

### Session Management

```rust
#[tauri::command]
pub async fn sftp_create_session(
    server_id: String,
) -> Result<SftpSession, String>

#[tauri::command]
pub async fn sftp_close_session(
    session_id: String,
) -> Result<(), String>

#[tauri::command]
pub async fn sftp_get_session(
    session_id: String,
) -> Result<Option<SftpSession>, String>
```

### File Operations

```rust
#[tauri::command]
pub async fn sftp_list_dir(
    session_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String>

#[tauri::command]
pub async fn sftp_create_dir(
    session_id: String,
    path: String,
) -> Result<(), String>

#[tauri::command]
pub async fn sftp_delete(
    session_id: String,
    path: String,
) -> Result<(), String>

#[tauri::command]
pub async fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String>
```

### File Transfer

```rust
#[tauri::command]
pub async fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String, String> // Returns transfer_id

#[tauri::command]
pub async fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String, String> // Returns transfer_id

#[tauri::command]
pub async fn sftp_get_transfer_progress(
    transfer_id: String,
) -> Result<Option<TransferProgress>, String>

#[tauri::command]
pub async fn sftp_cancel_transfer(
    transfer_id: String,
) -> Result<(), String>
```

### File Preview

```rust
#[tauri::command]
pub async fn sftp_read_file(
    session_id: String,
    path: String,
    max_bytes: Option<u64>,
) -> Result<Vec<u8>, String>

#[tauri::command]
pub async fn sftp_stat(
    session_id: String,
    path: String,
) -> Result<FileEntry, String>
```

**Total Commands**: 13

## 🎨 UI Components

### SFTPPanel

Main container with dual-pane layout:

```tsx
<SFTPPanel sessionId={sessionId}>
  <FilePane 
    type="local" 
    currentPath={localPath}
    onNavigate={setLocalPath}
  />
  <FilePane 
    type="remote" 
    currentPath={remotePath}
    onNavigate={setRemotePath}
  />
  <TransferProgress transfers={activeTransfers} />
</SFTPPanel>
```

### FilePane

Single pane showing file list with breadcrumb navigation:

- Breadcrumb path navigation
- File list with icons (folder/file type)
- Context menu (right-click operations)
- Drag-and-drop source/target
- Selection support (single/multi)

### FileList

Virtualized list for performance with large directories:

- File icon based on type
- File size (human-readable)
- Modified timestamp
- Permissions display
- Sort by name/size/date

### FilePreview

Modal preview for selected file:

- Text files: Syntax-highlighted code view
- Images: Thumbnail with zoom
- Binary files: Hex dump (first 1KB)
- Large files: Show first/last N lines

### TransferProgress

Bottom panel showing active transfers:

- Progress bar per transfer
- Speed indicator (KB/s, MB/s)
- ETA calculation
- Cancel button
- Completed transfers (last 10)

## 🔄 Implementation Plan

### Phase 1: Backend Foundation (Day 1)

1. **Create `src-tauri/src/runtime/sftp.rs`**
   - Implement `SftpManager` struct
   - Session lifecycle management
   - Connection pool integration
   - Use `ssh2` crate for SFTP protocol

2. **Create `src-tauri/src/commands/sftp.rs`**
   - Implement all 13 Tauri commands
   - Error handling and validation
   - Register commands in `main.rs`

3. **Modify `src-tauri/Cargo.toml`**
   - Add `ssh2 = "0.9"` dependency

### Phase 2: Frontend API Layer (Day 1-2)

1. **Create `src/lib/backend-sftp.ts`**
   - TypeScript wrappers for all commands
   - Type definitions matching Rust structs

2. **Create `src/hooks/useSFTP.ts`**
   - `useSFTPSession()` - Session management
   - `useFileList()` - Directory listing with caching
   - `useFileOperations()` - CRUD operations

3. **Create `src/hooks/useFileTransfer.ts`**
   - `useUpload()` - Upload with progress
   - `useDownload()` - Download with progress
   - Progress polling mechanism

### Phase 3: UI Components (Day 2-3)

1. **Create `src/components/SFTP/FileList.tsx`**
   - Virtualized list with `react-window`
   - File icons (use `lucide-react`)
   - Sort and filter

2. **Create `src/components/SFTP/FilePane.tsx`**
   - Breadcrumb navigation
   - Integrate FileList
   - Context menu
   - Drag-and-drop handlers

3. **Create `src/components/SFTP/SFTPPanel.tsx`**
   - Dual-pane layout
   - Splitter for resizing
   - Toolbar with common actions

4. **Create `src/components/SFTP/TransferProgress.tsx`**
   - Transfer list
   - Progress bars
   - Speed/ETA display

5. **Create `src/components/SFTP/FilePreview.tsx`**
   - Modal dialog
   - Text preview with syntax highlighting
   - Image preview

### Phase 4: Integration (Day 3-4)

1. **Add SFTP button to Workspace**
   - Toggle SFTP panel visibility
   - Position below terminal or as side panel

2. **Session lifecycle integration**
   - Auto-create SFTP session when SSH connects
   - Auto-close SFTP session when SSH disconnects
   - Reuse connection from pool

3. **Error handling**
   - Permission denied errors
   - Network errors
   - File not found errors
   - User-friendly error messages

4. **Testing**
   - Manual testing with various file types
   - Large file transfers (100MB+)
   - Network interruption handling
   - Permission edge cases

## 🎯 Acceptance Criteria

- [ ] Can browse local and remote directories side-by-side
- [ ] Can upload files via drag-and-drop or button
- [ ] Can download files via drag-and-drop or button
- [ ] Can create/delete/rename files and directories
- [ ] Progress bar shows real-time transfer status
- [ ] Can preview text files (< 1MB) and images
- [ ] Can cancel in-progress transfers
- [ ] SFTP session reuses existing SSH connection from pool
- [ ] Handles permission errors gracefully
- [ ] Handles network interruptions (shows error, allows retry)
- [ ] File list updates after operations
- [ ] Supports multi-file selection and batch operations

## 🔍 Technical Considerations

### Connection Reuse

SFTP sessions will reuse SSH connections from the existing connection pool:

```rust
// Pseudo-code
let conn = pool.acquire(server_id)?;
let sftp = conn.ssh_session.sftp()?;
// Use sftp for operations
// Connection returns to pool when SftpSession is dropped
```

### Large File Handling

For files > 10MB:

- Stream transfers in chunks (1MB per chunk)
- Emit progress events every 500ms
- Support pause/resume (future enhancement)

### Security

- Validate all file paths (prevent directory traversal)
- Respect SSH user permissions
- No credential storage (reuse from connection pool)

### Performance

- Cache directory listings (5s TTL)
- Virtualized lists for large directories (1000+ files)
- Debounce file operations (prevent rapid clicks)

## 📊 Success Metrics

- **User Value**: Eliminates need for external SFTP clients (FileZilla, WinSCP)
- **Performance**: File list loads in < 500ms for typical directories
- **Reliability**: 99% success rate for transfers < 100MB
- **UX**: Drag-and-drop works intuitively (no user confusion)

## 🔗 Related PRs

- **PR9**: Connection pool (reused for SFTP sessions)
- **PR10**: Session lifecycle (SFTP sessions follow same patterns)
- **PR18**: Grace period reconnect (SFTP benefits from stable connections)

## 📝 Notes

- SFTP is built on SSH protocol, so it naturally integrates with existing SSH infrastructure
- Unlike FTP, SFTP is secure by default (encrypted)
- Most SSH servers have SFTP enabled by default
- Consider adding file search in future enhancement (PR24+)

## 🚀 Future Enhancements (Post-PR20)

- File search across remote directories
- Bookmark favorite directories
- File synchronization (bidirectional sync)
- Batch operations (multi-file upload/download)
- File comparison (diff local vs remote)
- Archive operations (zip/unzip on remote)
