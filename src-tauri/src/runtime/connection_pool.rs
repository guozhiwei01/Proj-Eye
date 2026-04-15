/**
 * Connection Pool
 *
 * 管理 SSH 连接的池化，允许多个 WorkspaceNode 共享同一个连接。
 */

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum ConnectionState {
    Idle,
    Active,
    Degraded,
    Closed,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PooledConnection {
    pub project_id: String,
    pub server_id: String,
    pub session_id: String,
    pub ref_count: usize,
    pub created_at: u64,
    pub last_used_at: u64,
    pub state: ConnectionState,
}

pub struct ConnectionPool {
    connections: HashMap<String, PooledConnection>,
    max_connections: usize,
}

impl ConnectionPool {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
            max_connections: 100, // 默认最大 100 个连接
        }
    }

    pub fn with_max_connections(max_connections: usize) -> Self {
        Self {
            connections: HashMap::new(),
            max_connections,
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

    pub fn len(&self) -> usize {
        self.connections.len()
    }

    pub fn is_empty(&self) -> bool {
        self.connections.is_empty()
    }

    /// 获取或创建连接
    pub fn acquire(&mut self, project_id: &str, server_id: &str) -> Result<String, String> {
        // 检查连接池是否已满
        if self.connections.len() >= self.max_connections && !self.connections.contains_key(project_id) {
            return Err("Connection pool is full".to_string());
        }

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

    /// 释放连接
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

    /// 清理空闲连接
    pub fn cleanup_idle(&mut self, max_idle_ms: u64) -> usize {
        let now = current_timestamp();
        let mut to_remove = Vec::new();

        for (project_id, conn) in &self.connections {
            if conn.state == ConnectionState::Idle {
                let idle_time = now.saturating_sub(conn.last_used_at);
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

    /// 连接预热
    pub fn prewarm(&mut self, project_id: &str, server_id: &str) -> Result<(), String> {
        if !self.connections.contains_key(project_id) {
            self.acquire(project_id, server_id)?;
            self.release(project_id)?;
        }
        Ok(())
    }

    /// 健康检查
    pub fn health_check(&self, project_id: &str) -> Result<bool, String> {
        if let Some(conn) = self.connections.get(project_id) {
            Ok(conn.state == ConnectionState::Active)
        } else {
            Ok(false)
        }
    }

    /// 获取所有连接信息
    pub fn list_all(&self) -> Vec<&PooledConnection> {
        self.connections.values().collect()
    }

    /// 获取活跃连接数
    pub fn active_count(&self) -> usize {
        self.connections
            .values()
            .filter(|c| c.state == ConnectionState::Active)
            .count()
    }

    /// 获取空闲连接数
    pub fn idle_count(&self) -> usize {
        self.connections
            .values()
            .filter(|c| c.state == ConnectionState::Idle)
            .count()
    }
}

impl Default for ConnectionPool {
    fn default() -> Self {
        Self::new()
    }
}

/// 获取当前时间戳（毫秒）
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

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

    #[test]
    fn test_max_connections() {
        let mut pool = ConnectionPool::with_max_connections(2);
        pool.acquire("proj1", "server1").unwrap();
        pool.acquire("proj2", "server2").unwrap();

        let result = pool.acquire("proj3", "server3");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Connection pool is full");
    }

    #[test]
    fn test_prewarm() {
        let mut pool = ConnectionPool::new();
        pool.prewarm("proj1", "server1").unwrap();

        let conn = pool.get("proj1").unwrap();
        assert_eq!(conn.ref_count, 0);
        assert_eq!(conn.state, ConnectionState::Idle);
    }

    #[test]
    fn test_health_check() {
        let mut pool = ConnectionPool::new();
        assert!(!pool.health_check("proj1").unwrap());

        pool.acquire("proj1", "server1").unwrap();
        assert!(pool.health_check("proj1").unwrap());

        pool.release("proj1").unwrap();
        assert!(!pool.health_check("proj1").unwrap());
    }
}
