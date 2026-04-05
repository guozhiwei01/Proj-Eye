mod commands;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            commands::logs_refresh_project,
            commands::database_run_query,
            commands::ai_analyze_project,
            commands::ai_confirm_suggested_command,
            commands::ai_validate_provider
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
