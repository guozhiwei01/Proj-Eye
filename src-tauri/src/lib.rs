mod commands;
mod runtime;
mod store;

use tauri::Manager;
use std::sync::Arc;

#[cfg(windows)]
fn disable_webview_default_context_menu<R: tauri::Runtime>(app: &tauri::App<R>) {
    if let Some(webview_window) = app.get_webview_window("main") {
        let _ = webview_window.with_webview(|webview| unsafe {
            if let Ok(core_webview) = webview.controller().CoreWebView2() {
                if let Ok(settings) = core_webview.Settings() {
                    let _ = settings.SetAreDefaultContextMenusEnabled(false);
                }
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(windows)]
            disable_webview_default_context_menu(app);

            // Initialize WebSocket server and Terminal Manager
            let ws_server = Arc::new(runtime::WsServer::new(9527));
            let terminal_manager = Arc::new(runtime::TerminalManager::new(Arc::clone(&ws_server)));

            // Start WebSocket server in background
            let ws_server_clone = Arc::clone(&ws_server);
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ws_server_clone.start().await {
                    eprintln!("WebSocket server error: {}", e);
                }
            });

            // Store terminal state
            let terminal_state = Arc::new(tokio::sync::RwLock::new(commands::terminal::TerminalState {
                manager: terminal_manager,
            }));
            app.manage(terminal_state);

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::app_health,
            commands::app_bootstrap,
            commands::config_refresh,
            commands::secure_status,
            commands::secure_initialize_vault,
            commands::secure_unlock_vault,
            commands::secure_lock_vault,
            commands::secure_inspect_credential,
            commands::config_save_settings,
            commands::config_save_server,
            commands::config_delete_server,
            commands::config_save_database,
            commands::config_delete_database,
            commands::config_save_project,
            commands::config_delete_project,
            commands::config_save_provider,
            commands::config_delete_provider,
            commands::ssh_connect_project,
            commands::ssh_create_terminal_tab,
            commands::ssh_execute_session_command,
            commands::ssh_write_session_input,
            commands::ssh_resize_session,
            commands::ssh_close_session,
            commands::ssh_reconnect_session,
            commands::logs_refresh_project,
            commands::database_run_query,
            commands::ai_analyze_project,
            commands::ai_send_followup,
            commands::ai_confirm_suggested_command,
            commands::ai_validate_provider,
            commands::diag_append_timing_log,
            commands::diag_get_timing_log_path,
            commands::workspace_register_node,
            commands::workspace_bind_node_session,
            commands::workspace_get_session_by_node,
            commands::workspace_get_node_by_session,
            commands::workspace_update_node_state,
            commands::connection_register,
            commands::connection_get,
            commands::connection_update_state,
            commands::connection_set_error,
            commands::connection_bind_session,
            commands::connection_unbind_session,
            commands::connection_add_node,
            commands::connection_remove_node,
            commands::connection_record_success,
            commands::connection_update_health_check,
            commands::connection_remove,
            commands::connection_list_all,
            commands::connection_list_by_state,
            commands::connection_list_with_active_nodes,
            commands::connection_list_by_server,
            commands::session_register,
            commands::session_get,
            commands::session_touch,
            commands::session_list_by_project,
            commands::session_remove,
            commands::session_remove_by_project,
            commands::session_count_by_project,
            commands::snapshot_create,
            commands::snapshot_get,
            commands::snapshot_restore,
            commands::snapshot_remove,
            commands::snapshot_list_by_project,
            commands::snapshot_cleanup_expired,
            commands::pool_acquire,
            commands::pool_release,
            commands::pool_get_info,
            commands::pool_cleanup_idle,
            commands::pool_list_all,
            commands::pool_stats,
            commands::pool_prewarm,
            commands::pool_health_check,
            commands::session_lifecycle::lifecycle_create_session,
            commands::session_lifecycle::lifecycle_get_session,
            commands::session_lifecycle::lifecycle_record_activity,
            commands::session_lifecycle::lifecycle_pause_session,
            commands::session_lifecycle::lifecycle_resume_session,
            commands::session_lifecycle::lifecycle_hibernate_session,
            commands::session_lifecycle::lifecycle_wake_session,
            commands::session_lifecycle::lifecycle_destroy_session,
            commands::session_lifecycle::lifecycle_get_sessions_by_state,
            commands::session_lifecycle::lifecycle_get_stats,
            commands::session_lifecycle::lifecycle_check_transitions,
            commands::session_lifecycle::lifecycle_set_policy,
            commands::reconnect_start,
            commands::reconnect_cancel,
            commands::reconnect_get_status,
            commands::reconnect_list_active,
            commands::reconnect_record_attempt,
            commands::reconnect_mark_success,
            commands::reconnect_set_strategy,
            commands::reconnect_get_strategy,
            commands::reconnect_should_attempt,
            commands::reconnect_get_ready,
            commands::reconnect_cleanup,
            commands::reconnect_get_stats,
            commands::reconnect_start_grace_period,
            commands::reconnect_update_grace_period,
            commands::reconnect_end_grace_period,
            commands::reconnect_set_grace_period_config,
            commands::reconnect_get_grace_period_config,
            commands::health_check_register,
            commands::health_check_unregister,
            commands::health_check_record,
            commands::health_check_get_metrics,
            commands::health_check_get_all,
            commands::health_check_get_by_status,
            commands::health_check_get_ready,
            commands::health_check_set_config,
            commands::health_check_get_config,
            commands::health_check_get_stats,
            commands::health_check_cleanup,
            commands::health_check_perform,
            commands::prewarm_record_usage,
            commands::prewarm_get_candidates,
            commands::prewarm_get_pattern,
            commands::prewarm_get_all_patterns,
            commands::prewarm_add_schedule,
            commands::prewarm_remove_schedule,
            commands::prewarm_get_schedules,
            commands::prewarm_set_strategy,
            commands::prewarm_get_strategy,
            commands::prewarm_clear_patterns,
            commands::sftp_create_session,
            commands::sftp_close_session,
            commands::sftp_get_session,
            commands::sftp_list_dir,
            commands::sftp_create_dir,
            commands::sftp_delete,
            commands::sftp_rename,
            commands::sftp_upload,
            commands::sftp_download,
            commands::sftp_get_transfer_progress,
            commands::sftp_cancel_transfer,
            commands::sftp_read_file,
            commands::sftp_stat,
            commands::create_terminal_session,
            commands::resize_terminal_session,
            commands::close_terminal_session,
            commands::get_terminal_session,
            commands::list_terminal_sessions,
            commands::get_ws_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
