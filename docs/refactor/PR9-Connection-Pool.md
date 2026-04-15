# PR9: 实现连接池（Connection Pool）

## 概述

实现连接池机制，允许多个 WorkspaceNode 共享同一个 SSH 连接，提高资源利用率和性能。

## 目标

- 多个 terminal 节点可以共享同一个 SSH 连接
- 自动管理连接的创建和销毁
- 支持连接的引用计数
- 连接空闲时自动回收

## 架构设计

### 之前（每个节点独立连接）

```
Terminal Node 1 ──> SSH Connection 1 ──> Server
Terminal Node 2 ──> SSH Connection 2 ──> Server
Terminal Node 3 ──> SSH Connection 3 ──> Server

问题：
❌ 资源浪费（3 个连接到同一服务器）
❌ 连接开销大
❌ 服务器连接数限制
```

### 之后（连接池共享）

```
Terminal Node 1 ──┐
Terminal Node 2 ──┼──> Connection Pool ──> SSH Connection ──> Server
Terminal Node 3 ──┘

优势：
✅ 资源复用（1 个连接服务 3 个节点）
✅ 减少连接开销
✅ 节省服务器资源
✅ 支持连接预热
```

## 核心组件

### 1. ConnectionPool (Rust)

位置：`src-tauri/src/runtime/connection_pool.rs`

```rust
pub struct ConnectionPool {
    // projectId -> PooledConnection
    connections: HashMap<String, PooledConnection>,
}

pub struct PooledConnection {
    pub project_id: String,
    pub server_id: String,
    pub session_id: String,
    pub ref_count: usize,
    pub created_at: u64,
    pub last_used_at: u64,
    pub state: ConnectionState,
}

impl ConnectionPool {
    pub fn acquire(&mut self, project_id: &str) -> Result<String, String>;
    pub fn release(&mut self, project_id: &str) -> Result<(), String>;
    pub fn get_or_create(&mut self, project_id: &str) -> Result<String, String>;
    pub fn cleanup_idle(&mut self, max_idle_ms: u64) -> usize;
}
```

### 2. 连接获取流程

```rust
// 1. 检查池中是否有可用连接
if let Some(conn) = pool.get(project_id) {
    if conn.state == ConnectionState::Active {
        conn.ref_count += 1;
        return Ok(conn.session_id.clone());
    }
}

// 2. 创建新连接
let session_id = create_ssh_session(project_id)?;
pool.insert(project_id, PooledConnection {
    session_id: session_id.clone(),
    ref_count: 1,
    created_at: now(),
    last_used_at: now(),
    state: ConnectionState::Active,
});

Ok(session_id)
```

### 3. 连接释放流程

```rust
// 1. 减少引用计数
if let Some(conn) = pool.get_mut(project_id) {
    conn.ref_count -= 1;
    conn.last_used_at = now();
    
    // 2. 如果引用计数为 0，标记为空闲
    if conn.ref_count == 0 {
        conn.state = ConnectionState::Idle;
    }
}

// 3. 定期清理空闲连接（后台任务）
pool.cleanup_idle(300_000); // 5 分钟
```

## 实现步骤

### 阶段 1：创建连接池基础结构（2 小时）

**1.1 创建文件结构**
```bash
touch src-tauri/src/runtime/connection_pool.rs
```

**1.2 定义核心类型**
```rust
// connection_pool.rs
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct ConnectionPool {
    connections: HashMap<String, PooledConnection>,
}

pub struct PooledConnection {
    pub project_id: String,
    pub server_id: String,
    pub session_id: String,
    pub ref_count: usize,
    pub created_at: u64,
    pub last_used_at: u64,
    pub state: ConnectionState,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    Idle,
    Active,
    Degraded,
    Closed,
}
```

**1.3 实现基础方法**
```rust
impl ConnectionPool {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }
    
    pub fn get(&self, project_id: &str) -> Option<&PooledConnection> {
        self.connections.get(project_id)
    }
    
    pub fn get_mut(&mut self, project_id: &str) -> Option<&mut PooledConnection> {
        self.connections.get_mut(project_id)
    }
    
    pub fn insert(&mut self, project_id: String, conn: PooledConnection) {
        self.connections.insert(project_id, conn);
    }
    
    pub fn remove(&mut self, project_id: &str) -> Option<PooledConnection> {
        self.connections.remove(project_id)
    }
}
```

### 阶段 2：实现连接获取和释放（3 小时）

**2.1 实现 acquire 方法**
```rust
impl ConnectionPool {
    pub fn acquire(&mut self, project_id: &str, server_id: &str) -> Result<String, String> {
        // 检查是否有现有连接
        if let Some(conn) = self.connections.get_mut(project_id) {
            if conn.state == ConnectionState::Active {
                conn.ref_count += 1;
                conn.last_used_at = current_timestamp();
                return Ok(conn.session_id.clone());
            }
        }
        
        // 创建新连接
        let session_id = format!("session-{}-{}", project_id, uuid::Uuid::new_v4());
        
        let conn = PooledConnection {
            project_id: project_id.to_string(),
            server_id: server_id.to_string(),
            session_id: session_id.clone(),
            ref_count: 1,
            created_at: current_timestamp(),
            last_used_at: current_timestamp(),
            state: ConnectionState::Active,
        };
        
        self.connections.insert(project_id.to_string(), conn);
        
        Ok(session_id)
    }
}
```

**2.2 实现 release 方法**
```rust
impl ConnectionPool {
    pub fn release(&mut self, project_id: &str) -> Result<(), String> {
        if let Some(conn) = self.connections.get_mut(project_id) {
            if conn.ref_count > 0 {
                conn.ref_count -= 1;
                conn.last_used_at = current_timestamp();
                
                // 如果引用计数为 0，标记为空闲
                if conn.ref_count == 0 {
                    conn.state = ConnectionState::Idle;
                }
                
                Ok(())
            } else {
                Err("Connection ref_count is already 0".to_string())
            }
        } else {
            Err(format!("Connection not found for project: {}", project_id))
        }
    }
}
```

**2.3 实现空闲连接清理**
```rust
impl ConnectionPool {
    pub fn cleanup_idle(&mut self, max_idle_ms: u64) -> usize {
        let now = current_timestamp();
        let mut to_remove = Vec::new();
        
        for (project_id, conn) in &self.connections {
            if conn.state == ConnectionState::Idle {
                let idle_time = now - conn.last_used_at;
                if idle_time > max_idle_ms {
                    to_remove.push(project_id.clone());
                }
            }
        }
        
        let count = to_remove.len();
        for project_id in to_remove {
            self.connections.remove(&project_id);
        }
        
        count
    }
}
```

### 阶段 3：添加 Tauri 命令接口（1 小时）

**3.1 创建命令文件**
```rust
// commands/connection_pool.rs
use crate::runtime::connection_pool::{ConnectionPool, ConnectionState};
use std::sync::{Arc, Mutex};
use once_cell::sync::OnceCell;

static POOL: OnceCell<Arc<Mutex<ConnectionPool>>> = OnceCell::new();

fn get_pool() -> Arc<Mutex<ConnectionPool>> {
    POOL.get_or_init(|| Arc::new(Mutex::new(ConnectionPool::new())))
        .clone()
}

#[tauri::command]
pub fn pool_acquire(project_id: String, server_id: String) -> Result<String, String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    pool.acquire(&project_id, &server_id)
}

#[tauri::command]
pub fn pool_release(project_id: String) -> Result<(), String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    pool.release(&project_id)
}

#[tauri::command]
pub fn pool_get_info(project_id: String) -> Result<serde_json::Value, String> {
    let pool = get_pool().lock().map_err(|e| e.to_string())?;
    
    if let Some(conn) = pool.get(&project_id) {
        Ok(serde_json::json!({
            "projectId": conn.project_id,
            "serverId": conn.server_id,
            "sessionId": conn.session_id,
            "refCount": conn.ref_count,
            "state": format!("{:?}", conn.state),
            "createdAt": conn.created_at,
            "lastUsedAt": conn.last_used_at,
        }))
    } else {
        Err(format!("Connection not found for project: {}", project_id))
    }
}

#[tauri::command]
pub fn pool_cleanup_idle(max_idle_ms: u64) -> Result<usize, String> {
    let mut pool = get_pool().lock().map_err(|e| e.to_string())?;
    Ok(pool.cleanup_idle(max_idle_ms))
}
```

**3.2 注册命令**
```rust
// main.rs
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... 现有命令
            commands::connection_pool::pool_acquire,
            commands::connection_pool::pool_release,
            commands::connection_pool::pool_get_info,
            commands::connection_pool::pool_cleanup_idle,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 阶段 4：前端集成（2 小时）

**4.1 添加 backend API**
```typescript
// lib/backend.ts

export async function poolAcquire(projectId: string, serverId: string): Promise<string> {
  return withBackend("pool_acquire", { projectId, serverId }, async () => {
    throw new Error("Connection pool not available in local mode");
  });
}

export async function poolRelease(projectId: string): Promise<void> {
  return withBackend("pool_release", { projectId }, async () => {});
}

export async function poolGetInfo(projectId: string): Promise<any> {
  return withBackend("pool_get_info", { projectId }, async () => null);
}

export async function poolCleanupIdle(maxIdleMs: number): Promise<number> {
  return withBackend("pool_cleanup_idle", { maxIdleMs }, async () => 0);
}
```

**4.2 创建 useConnectionPool hook**
```typescript
// hooks/useConnectionPool.ts
import { useEffect, useCallback } from 'react';
import * as backend from '../lib/backend';

export function useConnectionPool(projectId: string, serverId: string) {
  const acquireConnection = useCallback(async () => {
    try {
      const sessionId = await backend.poolAcquire(projectId, serverId);
      return sessionId;
    } catch (error) {
      console.error('Failed to acquire connection:', error);
      throw error;
    }
  }, [projectId, serverId]);

  const releaseConnection = useCallback(async () => {
    try {
      await backend.poolRelease(projectId);
    } catch (error) {
      console.error('Failed to release connection:', error);
    }
  }, [projectId]);

  // 组件卸载时自动释放连接
  useEffect(() => {
    return () => {
      releaseConnection();
    };
  }, [releaseConnection]);

  return {
    acquireConnection,
    releaseConnection,
  };
}
```

**4.3 更新 useTerminalConnection**
```typescript
// hooks/useTerminalConnection.ts
import { useConnectionPool } from './useConnectionPool';

export function useTerminalConnection({
  projectId,
  session,
  tab,
  onReconnectComplete,
}: UseTerminalConnectionOptions): TerminalConnectionResult {
  // ... 现有代码
  
  // NEW: 使用连接池
  const { acquireConnection, releaseConnection } = useConnectionPool(
    projectId,
    project.serverId
  );
  
  // 在需要连接时获取
  useEffect(() => {
    if (tab && !session) {
      acquireConnection().then(sessionId => {
        // 使用获取的 sessionId 创建 session
      });
    }
  }, [tab, session, acquireConnection]);
  
  // ... 其余代码
}
```

### 阶段 5：后台清理任务（1 小时）

**5.1 实现定期清理**
```rust
// runtime/connection_pool.rs

use std::thread;
use std::time::Duration;

pub fn start_cleanup_task(pool: Arc<Mutex<ConnectionPool>>) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(60)); // 每分钟检查一次
            
            if let Ok(mut pool) = pool.lock() {
                let removed = pool.cleanup_idle(300_000); // 5 分钟空闲
                if removed > 0 {
                    println!("Cleaned up {} idle connections", removed);
                }
            }
        }
    });
}
```

**5.2 在应用启动时启动清理任务**
```rust
// main.rs

fn main() {
    let pool = get_pool();
    start_cleanup_task(pool.clone());
    
    tauri::Builder::default()
        // ...
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 测试计划

### 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_acquire_new_connection() {
        let mut pool = ConnectionPool::new();
        let session_id = pool.acquire("proj1", "server1").unwrap();
        assert!(!session_id.is_empty());
        
        let conn = pool.get("proj1").unwrap();
        assert_eq!(conn.ref_count, 1);
        assert_eq!(conn.state, ConnectionState::Active);
    }

    #[test]
    fn test_acquire_existing_connection() {
        let mut pool = ConnectionPool::new();
        let session_id1 = pool.acquire("proj1", "server1").unwrap();
        let session_id2 = pool.acquire("proj1", "server1").unwrap();
        
        assert_eq!(session_id1, session_id2);
        
        let conn = pool.get("proj1").unwrap();
        assert_eq!(conn.ref_count, 2);
    }

    #[test]
    fn test_release_connection() {
        let mut pool = ConnectionPool::new();
        pool.acquire("proj1", "server1").unwrap();
        pool.acquire("proj1", "server1").unwrap();
        
        pool.release("proj1").unwrap();
        let conn = pool.get("proj1").unwrap();
        assert_eq!(conn.ref_count, 1);
        assert_eq!(conn.state, ConnectionState::Active);
        
        pool.release("proj1").unwrap();
        let conn = pool.get("proj1").unwrap();
        assert_eq!(conn.ref_count, 0);
        assert_eq!(conn.state, ConnectionState::Idle);
    }

    #[test]
    fn test_cleanup_idle() {
        let mut pool = ConnectionPool::new();
        pool.acquire("proj1", "server1").unwrap();
        pool.release("proj1").unwrap();
        
        // 模拟时间流逝
        if let Some(conn) = pool.get_mut("proj1") {
            conn.last_used_at = 0;
        }
        
        let removed = pool.cleanup_idle(1000);
        assert_eq!(removed, 1);
        assert!(pool.get("proj1").is_none());
    }
}
```

### 集成测试

1. **多节点共享连接**
   - 创建 3 个 terminal 节点
   - 验证它们使用同一个 session_id
   - 验证 ref_count = 3

2. **连接释放**
   - 关闭 1 个节点
   - 验证 ref_count = 2
   - 关闭所有节点
   - 验证连接变为 Idle

3. **空闲清理**
   - 创建连接并释放
   - 等待 5 分钟
   - 验证连接被清理

## 性能优化

### 1. 连接预热

```rust
pub fn prewarm(&mut self, project_id: &str, server_id: &str) -> Result<(), String> {
    if !self.connections.contains_key(project_id) {
        self.acquire(project_id, server_id)?;
        self.release(project_id)?;
    }
    Ok(())
}
```

### 2. 连接健康检查

```rust
pub fn health_check(&mut self, project_id: &str) -> Result<bool, String> {
    if let Some(conn) = self.connections.get(project_id) {
        // 检查连接是否仍然有效
        // 可以发送一个简单的命令测试
        Ok(conn.state == ConnectionState::Active)
    } else {
        Ok(false)
    }
}
```

### 3. 最大连接数限制

```rust
pub struct ConnectionPool {
    connections: HashMap<String, PooledConnection>,
    max_connections: usize,
}

impl ConnectionPool {
    pub fn acquire(&mut self, project_id: &str, server_id: &str) -> Result<String, String> {
        if self.connections.len() >= self.max_connections {
            return Err("Connection pool is full".to_string());
        }
        // ... 其余逻辑
    }
}
```

## 向后兼容性

✅ 完全向后兼容

- 现有代码可以继续直接创建 session
- 新代码可以选择使用连接池
- 两种方式可以共存

## 文件清单

### 新增文件

- `src-tauri/src/runtime/connection_pool.rs` - 连接池实现
- `src-tauri/src/commands/connection_pool.rs` - Tauri 命令
- `src/hooks/useConnectionPool.ts` - 前端 hook
- `docs/refactor/PR9-Connection-Pool.md` - 本文档

### 修改文件

- `src-tauri/src/main.rs` - 注册新命令
- `src-tauri/src/runtime/mod.rs` - 导出连接池模块
- `src/lib/backend.ts` - 添加连接池 API
- `src/hooks/useTerminalConnection.ts` - 集成连接池

## 下一步

完成 PR9 后，继续 PR10：实现会话复用（Session Reuse）。

会话复用将在连接池的基础上，实现：
- 会话的保存和恢复
- 会话的迁移（从一个节点转移到另一个节点）
- 会话的克隆（复制会话状态）

## 总结

PR9 成功实现连接池机制：

✅ 多个节点可以共享同一个 SSH 连接
✅ 自动管理连接的引用计数
✅ 空闲连接自动清理
✅ 完全向后兼容
✅ 为 PR10（会话复用）奠定基础

连接池大幅减少了资源消耗，提高了系统性能和可扩展性。
