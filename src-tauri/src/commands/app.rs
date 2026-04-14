use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

use crate::store::{config, secure};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealth {
    pub app: &'static str,
    pub stage: &'static str,
    pub version: &'static str,
    pub backend_ready: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBootstrap {
    pub health: AppHealth,
    pub config: Value,
    pub secure_status: secure::SecureStatus,
    pub backend_mode: &'static str,
}

#[tauri::command]
pub fn app_health() -> AppHealth {
    AppHealth {
        app: "Proj-Eye",
        stage: "native-mvp",
        version: env!("CARGO_PKG_VERSION"),
        backend_ready: true,
    }
}

#[tauri::command]
pub fn app_bootstrap(app: AppHandle) -> Result<AppBootstrap, String> {
    Ok(AppBootstrap {
        health: app_health(),
        config: config::refresh(&app)?,
        secure_status: secure::status(&app)?,
        backend_mode: "tauri",
    })
}

#[tauri::command]
pub fn config_refresh(app: AppHandle) -> Result<Value, String> {
    config::refresh(&app)
}
