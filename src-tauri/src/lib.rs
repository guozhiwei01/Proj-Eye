mod commands;
mod runtime;
mod store;

use tauri::Manager;

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
            commands::pool_health_check
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
