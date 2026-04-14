# Commands Module Structure

This directory contains all Tauri command handlers, organized by domain.

## Module Organization

| Module | Commands | Purpose |
|--------|----------|---------|
| `app.rs` | `app_health`, `app_bootstrap`, `config_refresh` | Application lifecycle and health checks |
| `config.rs` | `config_save_*`, `config_delete_*` | Configuration CRUD operations |
| `secure.rs` | `secure_*` | Credential management and vault operations |
| `ssh.rs` | `ssh_*` | SSH connection and terminal session management |
| `logs.rs` | `logs_refresh_project` | Log retrieval operations |
| `database.rs` | `database_run_query` | Database query execution |
| `ai.rs` | `ai_*` | AI provider integration and analysis |
| `diagnostics.rs` | `diag_*` | Diagnostic logging and telemetry |

## Design Principles

- **Thin handlers**: Commands are thin wrappers that delegate to `store/` modules
- **Consistent signatures**: All commands return `Result<T, String>` for IPC boundary
- **Domain separation**: Each module focuses on a single domain area
- **Backward compatibility**: The parent `commands.rs` re-exports all functions

## Migration Notes

Previously all commands lived in a single 236-line `commands.rs` file. This has been refactored into:
- 8 domain-specific modules (~10-56 lines each)
- 1 re-export file (20 lines)
- Total: 281 lines (includes module structure overhead)

No function signatures were changed. Frontend code requires no modifications.
