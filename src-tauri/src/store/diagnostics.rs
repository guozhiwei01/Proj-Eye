use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};

fn logs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;
    let dir = base.join("logs");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create diagnostics log directory {:?}: {error}", dir))?;
    Ok(dir)
}

fn timing_log_path_buf(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(logs_dir(app)?.join("ai-timing.log"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn timing_log_path(app: &AppHandle) -> Result<String, String> {
    timing_log_path_buf(app)?
        .into_os_string()
        .into_string()
        .map_err(|_| "Unable to convert diagnostics log path into a UTF-8 string.".to_string())
}

pub fn append_timing_log(app: &AppHandle, entry: Value) -> Result<(), String> {
    let mut payload = match entry {
        Value::Object(map) => map,
        _ => return Err("Diagnostics timing log payload must be a JSON object.".to_string()),
    };

    if !payload.contains_key("ts") {
        payload.insert("ts".to_string(), json!(now_ms()));
    }

    let path = timing_log_path_buf(app)?;
    let serialized = serde_json::to_string(&Value::Object(Map::from_iter(payload)))
        .map_err(|error| format!("Unable to serialize diagnostics log entry: {error}"))?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("Unable to open diagnostics timing log {:?}: {error}", path))?;
    file.write_all(serialized.as_bytes())
        .map_err(|error| format!("Unable to write diagnostics timing log {:?}: {error}", path))?;
    file.write_all(b"\n")
        .map_err(|error| format!("Unable to finalize diagnostics timing log {:?}: {error}", path))?;

    Ok(())
}
