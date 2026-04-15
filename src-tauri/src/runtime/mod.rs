pub mod connection_runtime;
pub mod reconnect_snapshot;
pub mod session_registry;
pub mod connection_pool;
pub mod session_lifecycle;
pub mod reconnect;
pub mod health_check;

pub use connection_runtime::{
    add_node, all_connections, bind_session as bind_connection_session,
    connections_by_server, connections_by_state, connections_with_active_nodes,
    get_connection, record_success, register_connection, remove_connection, remove_node,
    set_error as set_connection_error, unbind_session as unbind_connection_session,
    update_health_check, update_state as update_connection_state, ConnectionContext,
    ConnectionState,
};

pub use reconnect_snapshot::{
    all_snapshots, cleanup_expired_snapshots, get_snapshot, remove_snapshot, save_snapshot,
    valid_snapshots, ReconnectSnapshot, SnapshotReason, TerminalTabSnapshot,
};

pub use session_registry::{
    all_sessions, count_project_sessions, get_project_sessions, get_session, register_session,
    remove_project_sessions, remove_session, touch_session, SessionMetadata,
};

pub use connection_pool::{ConnectionPool, PooledConnection, ConnectionState as PoolConnectionState};

pub use health_check::{HealthCheckManager, HealthCheckConfig, HealthMetrics, HealthStatus};
