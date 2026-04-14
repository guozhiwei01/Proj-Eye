// Command modules organized by domain
pub mod app;
pub mod config;
pub mod secure;
pub mod ssh;
pub mod logs;
pub mod database;
pub mod ai;
pub mod diagnostics;
pub mod workspace;
pub mod connection;
pub mod snapshot;

// Re-export all commands for backward compatibility
pub use app::*;
pub use config::*;
pub use secure::*;
pub use ssh::*;
pub use logs::*;
pub use database::*;
pub use ai::*;
pub use diagnostics::*;
pub use workspace::*;
pub use connection::*;
pub use snapshot::*;
