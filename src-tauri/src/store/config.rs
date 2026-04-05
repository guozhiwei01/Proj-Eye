use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use super::secure;

pub fn default_config() -> Value {
    json!({
        "servers": [],
        "databases": [],
        "projects": [],
        "providers": [],
        "settings": {
            "theme": "teal",
            "locale": "zh-CN",
            "shortcutModifier": "ctrl",
            "defaultAiProviderId": Value::Null,
            "preferredModel": ""
        }
    })
}

fn ensure_settings_defaults(root: &mut Value) -> Result<(), String> {
    let settings = object_mut(root)?
        .entry("settings".to_string())
        .or_insert_with(|| json!({}));
    let settings_object = settings
        .as_object_mut()
        .ok_or_else(|| "Config field 'settings' is not an object.".to_string())?;

    if !settings_object.contains_key("theme") {
        settings_object.insert("theme".to_string(), json!("teal"));
    }
    if !settings_object.contains_key("locale") {
        settings_object.insert("locale".to_string(), json!("zh-CN"));
    }
    if !settings_object.contains_key("shortcutModifier") {
        settings_object.insert("shortcutModifier".to_string(), json!("ctrl"));
    }
    if !settings_object.contains_key("defaultAiProviderId") {
        settings_object.insert("defaultAiProviderId".to_string(), Value::Null);
    }
    if !settings_object.contains_key("preferredModel") {
        settings_object.insert("preferredModel".to_string(), json!(""));
    }

    Ok(())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;
    let dir = base.join("config");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create config directory {:?}: {error}", dir))?;
    Ok(dir.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> Result<Value, String> {
    let path = config_path(app)?;
    if !path.exists() {
        let config = default_config();
        save_config(app, &config)?;
        return Ok(config);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read config file {:?}: {error}", path))?;

    let mut config: Value =
        serde_json::from_str(&contents).map_err(|error| format!("Config file is not valid JSON: {error}"))?;
    ensure_settings_defaults(&mut config)?;
    Ok(config)
}

pub fn save_config(app: &AppHandle, config: &Value) -> Result<(), String> {
    let path = config_path(app)?;
    let serialized = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Unable to serialize config: {error}"))?;
    fs::write(&path, serialized)
        .map_err(|error| format!("Unable to write config file {:?}: {error}", path))?;
    Ok(())
}

fn object_mut(value: &mut Value) -> Result<&mut Map<String, Value>, String> {
    value
        .as_object_mut()
        .ok_or_else(|| "Expected a JSON object payload.".to_string())
}

fn object(value: &Value) -> Result<&Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| "Expected a JSON object payload.".to_string())
}

fn array_mut<'a>(root: &'a mut Value, key: &str) -> Result<&'a mut Vec<Value>, String> {
    root.get_mut(key)
        .and_then(Value::as_array_mut)
        .ok_or_else(|| format!("Config field '{key}' is missing or not an array."))
}

fn array<'a>(root: &'a Value, key: &str) -> Result<&'a Vec<Value>, String> {
    root.get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Config field '{key}' is missing or not an array."))
}

fn string_field(payload: &Map<String, Value>, key: &str) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn optional_string_field(payload: &Map<String, Value>, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn bool_field(payload: &Map<String, Value>, key: &str, default: bool) -> bool {
    payload.get(key).and_then(Value::as_bool).unwrap_or(default)
}

fn u64_field(payload: &Map<String, Value>, key: &str, default: u64) -> u64 {
    payload.get(key).and_then(Value::as_u64).unwrap_or(default)
}

fn value_or(existing: Option<&Value>, key: &str, fallback: Value) -> Value {
    existing
        .and_then(|value| value.get(key))
        .cloned()
        .unwrap_or(fallback)
}

fn id_from_payload(payload: &Map<String, Value>, prefix: &str) -> String {
    optional_string_field(payload, "id").unwrap_or_else(|| format!("{prefix}-{}", Uuid::new_v4()))
}

fn upsert_by_id(items: &mut Vec<Value>, item: Value, item_id: &str) {
    if let Some(existing_index) = items
        .iter()
        .position(|existing| existing.get("id").and_then(Value::as_str) == Some(item_id))
    {
        items[existing_index] = item;
    } else {
        items.push(item);
    }
}

fn existing_by_id<'a>(items: &'a [Value], item_id: &str) -> Option<&'a Value> {
    items
        .iter()
        .find(|item| item.get("id").and_then(Value::as_str) == Some(item_id))
}

pub fn refresh(app: &AppHandle) -> Result<Value, String> {
    load_config(app)
}

pub fn save_settings(app: &AppHandle, settings: Value) -> Result<Value, String> {
    let mut config = load_config(app)?;
    object_mut(&mut config)?.insert("settings".to_string(), settings.clone());
    save_config(app, &config)?;
    Ok(settings)
}

pub fn save_server(app: &AppHandle, draft: Value) -> Result<Value, String> {
    let draft_object = object(&draft)?;
    let mut config = load_config(app)?;
    let existing_servers = array(&config, "servers")?;
    let server_id = id_from_payload(draft_object, "server");
    let existing = existing_by_id(existing_servers, &server_id);

    let auth_type = if string_field(draft_object, "authType").is_empty() {
        "private_key".to_string()
    } else {
        string_field(draft_object, "authType")
    };

    let credential_ref = if auth_type == "agent" {
        String::new()
    } else {
        optional_string_field(draft_object, "credentialRef")
            .or_else(|| {
                existing.and_then(|server| {
                    server
                        .get("credentialRef")
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                })
            })
            .unwrap_or_else(|| format!("cred-{}", Uuid::new_v4()))
    };

    if let Some(secret) = optional_string_field(draft_object, "credentialValue") {
        let label = format!("{} {}", string_field(draft_object, "name"), auth_type);
        secure::save_secret(
            app,
            &credential_ref,
            if auth_type == "private_key" {
                "server_private_key"
            } else {
                "server_password"
            },
            &label,
            &secret,
        )?;
    }

    let server = json!({
        "id": server_id,
        "name": string_field(draft_object, "name"),
        "host": string_field(draft_object, "host"),
        "port": u64_field(draft_object, "port", 22),
        "username": string_field(draft_object, "username"),
        "authType": auth_type,
        "credentialRef": credential_ref,
        "group": if string_field(draft_object, "group").is_empty() { "default".to_string() } else { string_field(draft_object, "group") },
        "osType": if string_field(draft_object, "osType").is_empty() { "linux".to_string() } else { string_field(draft_object, "osType") },
        "lastStatus": value_or(existing, "lastStatus", json!("unknown")),
        "lastPingAt": value_or(existing, "lastPingAt", json!(now_ms())),
        "extra": value_or(existing, "extra", json!({}))
    });

    let servers = array_mut(&mut config, "servers")?;
    upsert_by_id(servers, server.clone(), &server_id);
    save_config(app, &config)?;
    Ok(server)
}

pub fn delete_server(app: &AppHandle, server_id: &str) -> Result<(), String> {
    let mut config = load_config(app)?;
    if array(&config, "projects")?
        .iter()
        .any(|project| project.get("serverId").and_then(Value::as_str) == Some(server_id))
    {
        return Err("Remove or reassign projects before deleting this server.".to_string());
    }

    let credential_ref = array(&config, "servers")?
        .iter()
        .find(|server| server.get("id").and_then(Value::as_str) == Some(server_id))
        .and_then(|server| server.get("credentialRef"))
        .and_then(Value::as_str)
        .map(ToString::to_string);

    let servers = array_mut(&mut config, "servers")?;
    servers.retain(|server| server.get("id").and_then(Value::as_str) != Some(server_id));
    save_config(app, &config)?;

    if let Some(reference) = credential_ref.filter(|value| !value.is_empty()) {
        let _ = secure::delete_secret(app, &reference);
    }

    Ok(())
}

pub fn save_database(app: &AppHandle, draft: Value) -> Result<Value, String> {
    let draft_object = object(&draft)?;
    let mut config = load_config(app)?;
    let existing_databases = array(&config, "databases")?;
    let database_id = id_from_payload(draft_object, "db");
    let existing = existing_by_id(existing_databases, &database_id);

    let credential_ref = optional_string_field(draft_object, "credentialRef")
        .or_else(|| {
            existing.and_then(|database| {
                database
                    .get("credentialRef")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
            })
        })
        .or_else(|| {
            optional_string_field(draft_object, "credentialValue")
                .map(|_| format!("cred-{}", Uuid::new_v4()))
        });

    if let Some(secret) = optional_string_field(draft_object, "credentialValue") {
        if let Some(reference) = credential_ref.as_deref() {
            let label = format!("{} database credential", string_field(draft_object, "name"));
            secure::save_secret(app, reference, "database_password", &label, &secret)?;
        }
    }

    let database = json!({
        "id": database_id,
        "name": string_field(draft_object, "name"),
        "type": if string_field(draft_object, "type").is_empty() { "mysql".to_string() } else { string_field(draft_object, "type") },
        "host": string_field(draft_object, "host"),
        "port": u64_field(draft_object, "port", 3306),
        "username": optional_string_field(draft_object, "username"),
        "credentialRef": credential_ref,
        "defaultDatabase": optional_string_field(draft_object, "defaultDatabase"),
        "dbNumber": draft_object.get("dbNumber").cloned().unwrap_or(Value::Null),
        "readonlyMode": bool_field(draft_object, "readonlyMode", true),
        "group": if string_field(draft_object, "group").is_empty() { "default".to_string() } else { string_field(draft_object, "group") },
        "tags": draft_object.get("tags").cloned().unwrap_or_else(|| json!([])),
        "extra": value_or(existing, "extra", json!({}))
    });

    let databases = array_mut(&mut config, "databases")?;
    upsert_by_id(databases, database.clone(), &database_id);
    save_config(app, &config)?;
    Ok(database)
}

pub fn delete_database(app: &AppHandle, database_id: &str) -> Result<(), String> {
    let mut config = load_config(app)?;
    if array(&config, "projects")?.iter().any(|project| {
        project
            .get("databaseIds")
            .and_then(Value::as_array)
            .map(|database_ids| {
                database_ids
                    .iter()
                    .any(|candidate| candidate.as_str() == Some(database_id))
            })
            .unwrap_or(false)
    }) {
        return Err("Remove this database from all projects before deleting it.".to_string());
    }

    let credential_ref = array(&config, "databases")?
        .iter()
        .find(|database| database.get("id").and_then(Value::as_str) == Some(database_id))
        .and_then(|database| database.get("credentialRef"))
        .and_then(Value::as_str)
        .map(ToString::to_string);

    let databases = array_mut(&mut config, "databases")?;
    databases.retain(|database| database.get("id").and_then(Value::as_str) != Some(database_id));
    save_config(app, &config)?;

    if let Some(reference) = credential_ref {
        let _ = secure::delete_secret(app, &reference);
    }

    Ok(())
}

pub fn save_project(app: &AppHandle, draft: Value) -> Result<Value, String> {
    let draft_object = object(&draft)?;
    let mut config = load_config(app)?;
    let existing_projects = array(&config, "projects")?;
    let project_id = id_from_payload(draft_object, "project");
    let existing = existing_by_id(existing_projects, &project_id);

    let project = json!({
        "id": project_id,
        "name": string_field(draft_object, "name"),
        "serverId": string_field(draft_object, "serverId"),
        "rootPath": string_field(draft_object, "rootPath"),
        "environment": if string_field(draft_object, "environment").is_empty() { "production".to_string() } else { string_field(draft_object, "environment") },
        "databaseIds": draft_object.get("databaseIds").cloned().unwrap_or_else(|| json!([])),
        "deployType": if string_field(draft_object, "deployType").is_empty() { "pm2".to_string() } else { string_field(draft_object, "deployType") },
        "logSources": draft_object.get("logSources").cloned().unwrap_or_else(|| json!([])),
        "healthCheckCommand": optional_string_field(draft_object, "healthCheckCommand"),
        "tags": draft_object.get("tags").cloned().unwrap_or_else(|| json!([])),
        "lastAccessedAt": value_or(existing, "lastAccessedAt", json!(now_ms())),
        "health": value_or(existing, "health", json!("healthy")),
        "recentIssue": value_or(existing, "recentIssue", Value::Null),
        "extra": value_or(existing, "extra", json!({}))
    });

    let projects = array_mut(&mut config, "projects")?;
    upsert_by_id(projects, project.clone(), &project_id);
    save_config(app, &config)?;
    Ok(project)
}

pub fn delete_project(app: &AppHandle, project_id: &str) -> Result<(), String> {
    let mut config = load_config(app)?;
    let projects = array_mut(&mut config, "projects")?;
    projects.retain(|project| project.get("id").and_then(Value::as_str) != Some(project_id));
    save_config(app, &config)?;
    Ok(())
}

pub fn save_provider(app: &AppHandle, draft: Value) -> Result<Value, String> {
    let draft_object = object(&draft)?;
    let mut config = load_config(app)?;
    let existing_providers = array(&config, "providers")?;
    let provider_id = id_from_payload(draft_object, "provider");
    let existing = existing_by_id(existing_providers, &provider_id);

    let api_key_ref = optional_string_field(draft_object, "apiKeyRef")
        .or_else(|| {
            existing.and_then(|provider| {
                provider
                    .get("apiKeyRef")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
            })
        })
        .unwrap_or_else(|| format!("cred-{}", Uuid::new_v4()));

    if let Some(secret) = optional_string_field(draft_object, "apiKeyValue") {
        let label = format!("{} API key", string_field(draft_object, "name"));
        secure::save_secret(app, &api_key_ref, "provider_api_key", &label, &secret)?;
    }

    let provider = json!({
        "id": provider_id,
        "name": string_field(draft_object, "name"),
        "type": if string_field(draft_object, "type").is_empty() { "openai".to_string() } else { string_field(draft_object, "type") },
        "model": string_field(draft_object, "model"),
        "apiKeyRef": api_key_ref,
        "baseUrl": optional_string_field(draft_object, "baseUrl"),
        "enabled": bool_field(draft_object, "enabled", true)
    });

    let providers = array_mut(&mut config, "providers")?;
    upsert_by_id(providers, provider.clone(), &provider_id);
    save_config(app, &config)?;
    Ok(provider)
}

pub fn delete_provider(app: &AppHandle, provider_id: &str) -> Result<(), String> {
    let mut config = load_config(app)?;
    let api_key_ref = array(&config, "providers")?
        .iter()
        .find(|provider| provider.get("id").and_then(Value::as_str) == Some(provider_id))
        .and_then(|provider| provider.get("apiKeyRef"))
        .and_then(Value::as_str)
        .map(ToString::to_string);

    {
        let providers = array_mut(&mut config, "providers")?;
        providers
            .retain(|provider| provider.get("id").and_then(Value::as_str) != Some(provider_id));
    }

    if config
        .get("settings")
        .and_then(Value::as_object)
        .and_then(|settings| settings.get("defaultAiProviderId"))
        .and_then(Value::as_str)
        == Some(provider_id)
    {
        object_mut(&mut config)?
            .entry("settings".to_string())
            .or_insert_with(|| json!({}));
        if let Some(settings) = config.get_mut("settings").and_then(Value::as_object_mut) {
            settings.insert("defaultAiProviderId".to_string(), Value::Null);
        }
    }

    save_config(app, &config)?;

    if let Some(reference) = api_key_ref {
        let _ = secure::delete_secret(app, &reference);
    }

    Ok(())
}
