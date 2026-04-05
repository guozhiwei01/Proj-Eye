use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use mysql::{prelude::Queryable, Conn, OptsBuilder, Value as MysqlValue};
use redis::Value as RedisValue;
use reqwest::blocking::Client;
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter};
use url::Url;
use uuid::Uuid;

use super::{config, secure};

const SESSION_EVENT: &str = "proj-eye://runtime/session";
const LOG_EVENT: &str = "proj-eye://runtime/logs";
const QUERY_EVENT: &str = "proj-eye://runtime/query";
const AI_EVENT: &str = "proj-eye://runtime/ai";
const CWD_MARKER: &str = "__PROJ_EYE_CWD__";
const EXIT_MARKER: &str = "__PROJ_EYE_EXIT__";

#[derive(Clone)]
struct RuntimeSession {
    id: String,
    project_id: String,
    server_id: String,
    tab_id: String,
    title: String,
    cwd: String,
    connection_state: String,
    transcript: Vec<String>,
    started_at: u64,
}

#[derive(Default)]
struct RuntimeState {
    sessions: HashMap<String, RuntimeSession>,
}

#[derive(Clone)]
struct ServerConfigData {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    credential_ref: Option<String>,
    os_type: String,
}

#[derive(Clone)]
struct LogSourceConfig {
    id: String,
    kind: String,
    value: String,
}

#[derive(Clone)]
struct ProjectConfigData {
    id: String,
    name: String,
    server_id: String,
    root_path: String,
    health_check_command: Option<String>,
    log_source: Option<LogSourceConfig>,
}

#[derive(Clone)]
struct DatabaseConfigData {
    id: String,
    name: String,
    database_type: String,
    host: String,
    port: u16,
    username: Option<String>,
    credential_ref: Option<String>,
    default_database: Option<String>,
    db_number: Option<u8>,
    readonly_mode: bool,
}

#[derive(Clone)]
struct ProviderConfigData {
    name: String,
    provider_type: String,
    model: String,
    api_key_ref: Option<String>,
    base_url: Option<String>,
    enabled: bool,
}

#[derive(Default)]
struct CommandExecution {
    lines: Vec<String>,
    cwd: Option<String>,
    exit_status: Option<i32>,
}

fn runtime_state() -> &'static Mutex<RuntimeState> {
    static INSTANCE: OnceLock<Mutex<RuntimeState>> = OnceLock::new();
    INSTANCE.get_or_init(|| Mutex::new(RuntimeState::default()))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn create_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

fn object(value: &Value) -> Result<&Map<String, Value>, String> {
    value
        .as_object()
        .ok_or_else(|| "Expected a JSON object payload.".to_string())
}

fn array<'a>(root: &'a Value, key: &str) -> Result<&'a Vec<Value>, String> {
    root.get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Config field '{key}' is missing or not an array."))
}

fn find_by_id<'a>(items: &'a [Value], item_id: &str) -> Option<&'a Value> {
    items.iter()
        .find(|item| item.get("id").and_then(Value::as_str) == Some(item_id))
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

fn u16_field(payload: &Map<String, Value>, key: &str, default: u16) -> u16 {
    payload
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u16::try_from(value).ok())
        .unwrap_or(default)
}

fn u8_field(payload: &Map<String, Value>, key: &str) -> Option<u8> {
    payload
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u8::try_from(value).ok())
}

fn emit_runtime_event(app: &AppHandle, event: &str, payload: Value) {
    let _ = app.emit(event, payload);
}

fn parse_server(value: &Value) -> Result<ServerConfigData, String> {
    let payload = object(value)?;
    Ok(ServerConfigData {
        id: string_field(payload, "id"),
        name: string_field(payload, "name"),
        host: string_field(payload, "host"),
        port: u16_field(payload, "port", 22),
        username: string_field(payload, "username"),
        auth_type: string_field(payload, "authType"),
        credential_ref: optional_string_field(payload, "credentialRef"),
        os_type: {
            let os_type = string_field(payload, "osType");
            if os_type.is_empty() {
                "linux".to_string()
            } else {
                os_type
            }
        },
    })
}

fn parse_log_source(value: &Value) -> Result<LogSourceConfig, String> {
    let payload = object(value)?;
    Ok(LogSourceConfig {
        id: string_field(payload, "id"),
        kind: string_field(payload, "type"),
        value: string_field(payload, "value"),
    })
}

fn parse_project(value: &Value) -> Result<ProjectConfigData, String> {
    let payload = object(value)?;
    let log_source = payload
        .get("logSources")
        .and_then(Value::as_array)
        .and_then(|sources| sources.first())
        .map(parse_log_source)
        .transpose()?;

    Ok(ProjectConfigData {
        id: string_field(payload, "id"),
        name: string_field(payload, "name"),
        server_id: string_field(payload, "serverId"),
        root_path: string_field(payload, "rootPath"),
        health_check_command: optional_string_field(payload, "healthCheckCommand"),
        log_source,
    })
}

fn parse_database(value: &Value) -> Result<DatabaseConfigData, String> {
    let payload = object(value)?;
    let database_type = {
        let value = string_field(payload, "type");
        if value.is_empty() {
            "mysql".to_string()
        } else {
            value
        }
    };

    let default_port = match database_type.as_str() {
        "redis" => 6379,
        "postgresql" => 5432,
        _ => 3306,
    };

    Ok(DatabaseConfigData {
        id: string_field(payload, "id"),
        name: string_field(payload, "name"),
        database_type,
        host: string_field(payload, "host"),
        port: u16_field(payload, "port", default_port),
        username: optional_string_field(payload, "username"),
        credential_ref: optional_string_field(payload, "credentialRef"),
        default_database: optional_string_field(payload, "defaultDatabase"),
        db_number: u8_field(payload, "dbNumber"),
        readonly_mode: bool_field(payload, "readonlyMode", true),
    })
}

fn parse_provider(value: &Value) -> Result<ProviderConfigData, String> {
    let payload = object(value)?;
    Ok(ProviderConfigData {
        name: string_field(payload, "name"),
        provider_type: string_field(payload, "type"),
        model: string_field(payload, "model"),
        api_key_ref: optional_string_field(payload, "apiKeyRef"),
        base_url: optional_string_field(payload, "baseUrl"),
        enabled: bool_field(payload, "enabled", true),
    })
}

fn load_project_context(
    app: &AppHandle,
    project_id: &str,
) -> Result<(Value, ProjectConfigData, ServerConfigData), String> {
    let config = config::refresh(app)?;
    let project = parse_project(
        find_by_id(array(&config, "projects")?, project_id)
            .ok_or_else(|| "Project not found.".to_string())?,
    )?;
    let server = parse_server(
        find_by_id(array(&config, "servers")?, &project.server_id)
            .ok_or_else(|| "Server configuration is missing.".to_string())?,
    )?;

    Ok((config, project, server))
}

fn session_to_value(session: &RuntimeSession) -> Value {
    json!({
        "id": session.id,
        "projectId": session.project_id,
        "tabId": session.tab_id,
        "title": session.title,
        "cwd": session.cwd,
        "connectionState": session.connection_state,
        "transcript": session.transcript,
        "startedAt": session.started_at
    })
}

fn tab_to_value(session: &RuntimeSession, command: &str, active: bool) -> Value {
    json!({
        "id": session.tab_id,
        "projectId": session.project_id,
        "title": session.title,
        "command": command,
        "active": active,
        "sessionId": session.id
    })
}

fn persist_session(session: RuntimeSession) -> Result<RuntimeSession, String> {
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
    state.sessions.insert(session.id.clone(), session.clone());
    Ok(session)
}

fn update_session<F>(session_id: &str, mutate: F) -> Result<RuntimeSession, String>
where
    F: FnOnce(&mut RuntimeSession),
{
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
    let session = state
        .sessions
        .get_mut(session_id)
        .ok_or_else(|| "Terminal session not found.".to_string())?;
    mutate(session);
    Ok(session.clone())
}

fn find_project_session(project_id: &str, preferred_session_id: Option<&str>) -> Result<RuntimeSession, String> {
    let state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;

    if let Some(session_id) = preferred_session_id {
        if let Some(session) = state.sessions.get(session_id) {
            return Ok(session.clone());
        }
    }

    state
        .sessions
        .values()
        .filter(|session| session.project_id == project_id)
        .max_by_key(|session| session.started_at)
        .cloned()
        .ok_or_else(|| "Open a terminal tab before executing commands.".to_string())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn parse_command_output(output: &str) -> CommandExecution {
    let mut parsed = CommandExecution::default();

    for raw_line in output.replace('\r', "").lines() {
        let line = raw_line.trim_end();
        if line.starts_with(CWD_MARKER) {
            parsed.cwd = Some(line.trim_start_matches(CWD_MARKER).trim().to_string());
            continue;
        }
        if line.starts_with(EXIT_MARKER) {
            parsed.exit_status = line
                .trim_start_matches(EXIT_MARKER)
                .trim()
                .parse::<i32>()
                .ok();
            continue;
        }
        if !line.is_empty() {
            parsed.lines.push(line.to_string());
        }
    }

    parsed
}

fn build_remote_command(server: &ServerConfigData, cwd: &str, command: &str) -> String {
    if server.os_type == "windows" {
        let script = format!(
            "& {{ Set-Location -LiteralPath {}; {}; $projEyeExit = if ($null -eq $LASTEXITCODE) {{ 0 }} else {{ [int]$LASTEXITCODE }}; Write-Output ('{}' + $projEyeExit); Write-Output ('{}' + (Get-Location).Path); exit $projEyeExit }}",
            powershell_quote(cwd),
            command,
            EXIT_MARKER,
            CWD_MARKER
        );
        format!(
            "powershell -NoProfile -NonInteractive -Command {}",
            powershell_quote(&script)
        )
    } else {
        let script = format!(
            "cd {} >/dev/null 2>&1 || exit 1\n{}\nproj_eye_exit=$?\nprintf '\\n{}%s\\n' \"$proj_eye_exit\"\nprintf '{}%s\\n' \"$PWD\"\nexit \"$proj_eye_exit\"",
            shell_quote(cwd),
            command,
            EXIT_MARKER,
            CWD_MARKER
        );
        format!("sh -lc {}", shell_quote(&script))
    }
}

fn temporary_path(prefix: &str, extension: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "proj-eye-{}-{}.{}",
        prefix,
        Uuid::new_v4(),
        extension
    ))
}

fn local_known_hosts_sink() -> &'static str {
    if cfg!(windows) {
        "NUL"
    } else {
        "/dev/null"
    }
}

fn cleanup_temp_paths(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

fn create_askpass_script(password: &str) -> Result<PathBuf, String> {
    let path = temporary_path("askpass", if cfg!(windows) { "cmd" } else { "sh" });
    let contents = if cfg!(windows) {
        "@echo off\r\npowershell -NoProfile -Command \"[Console]::Write($env:PROJ_EYE_SSH_PASSWORD)\"\r\n"
            .to_string()
    } else {
        "#!/bin/sh\nprintf '%s' \"$PROJ_EYE_SSH_PASSWORD\"\n".to_string()
    };

    fs::write(&path, contents)
        .map_err(|error| format!("Unable to create SSH askpass helper {:?}: {error}", path))?;
    let _ = password;
    Ok(path)
}

fn create_private_key_file(secret: &str) -> Result<PathBuf, String> {
    let path = temporary_path("ssh-key", "pem");
    fs::write(&path, secret)
        .map_err(|error| format!("Unable to write temporary private key {:?}: {error}", path))?;
    Ok(path)
}

fn execute_ssh_command(server: &ServerConfigData, cwd: &str, command: &str) -> Result<CommandExecution, String> {
    let remote_command = build_remote_command(server, cwd, command);
    let mut ssh = Command::new("ssh");
    let mut cleanup = Vec::new();

    ssh.arg("-p")
        .arg(server.port.to_string())
        .arg("-o")
        .arg("StrictHostKeyChecking=no")
        .arg("-o")
        .arg(format!("UserKnownHostsFile={}", local_known_hosts_sink()))
        .arg("-o")
        .arg("ConnectTimeout=20");

    match server.auth_type.as_str() {
        "agent" => {
            ssh.arg("-o").arg("PreferredAuthentications=publickey");
        }
        "password" => {
            let secret = secure::read_secret(server.credential_ref.clone())?
                .ok_or_else(|| format!("No password is stored for server '{}'.", server.name))?;
            let askpass_path = create_askpass_script(&secret)?;
            ssh.arg("-o")
                .arg("PreferredAuthentications=password,keyboard-interactive")
                .arg("-o")
                .arg("PubkeyAuthentication=no")
                .stdin(Stdio::null())
                .env("SSH_ASKPASS", &askpass_path)
                .env("SSH_ASKPASS_REQUIRE", "force")
                .env("PROJ_EYE_SSH_PASSWORD", secret);
            if !cfg!(windows) {
                ssh.env("DISPLAY", "proj-eye:0");
            }
            cleanup.push(askpass_path);
        }
        _ => {
            let secret = secure::read_secret(server.credential_ref.clone())?
                .ok_or_else(|| format!("No private key is stored for server '{}'.", server.name))?;
            let key_path = create_private_key_file(&secret)?;
            ssh.arg("-i")
                .arg(&key_path)
                .arg("-o")
                .arg("IdentitiesOnly=yes");
            cleanup.push(key_path);
        }
    }

    ssh.arg(format!("{}@{}", server.username, server.host))
        .arg(remote_command);

    let output = ssh
        .output()
        .map_err(|error| format!("Unable to run the local ssh client: {error}"))?;
    cleanup_temp_paths(&cleanup);

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let has_remote_markers = stdout.contains(EXIT_MARKER) || stderr.contains(EXIT_MARKER);
    if !output.status.success() && !has_remote_markers {
        let message = stderr
            .lines()
            .find(|line| !line.trim().is_empty())
            .or_else(|| stdout.lines().find(|line| !line.trim().is_empty()))
            .unwrap_or("ssh exited before the remote command completed");
        return Err(format!("SSH command failed for '{}': {message}", server.name));
    }

    let mut parsed = parse_command_output(&stdout);
    let stderr_lines = parse_command_output(&stderr).lines;
    if !stderr_lines.is_empty() {
        parsed.lines.extend(
            stderr_lines
                .into_iter()
                .map(|line| format!("[stderr] {line}")),
        );
    }

    if parsed.exit_status.is_none() {
        parsed.exit_status = output.status.code();
    }

    Ok(parsed)
}

fn classify_log_level(line: &str) -> &'static str {
    let normalized = line.to_ascii_lowercase();
    if normalized.contains("error") || normalized.contains("exception") {
        "error"
    } else if normalized.contains("warn") || normalized.contains("timeout") {
        "warning"
    } else {
        "info"
    }
}

fn logs_to_values(project: &ProjectConfigData, source: &LogSourceConfig, lines: &[String]) -> Vec<Value> {
    lines.iter()
        .enumerate()
        .map(|(index, line)| {
            json!({
                "id": create_id("log"),
                "projectId": project.id,
                "sourceId": source.id,
                "line": line,
                "level": classify_log_level(line),
                "createdAt": now_ms().saturating_sub(((lines.len().saturating_sub(index)) as u64) * 1_000)
            })
        })
        .collect()
}

fn build_log_command(source: &LogSourceConfig, os_type: &str) -> Result<String, String> {
    let command = match source.kind.as_str() {
        "file" => {
            if os_type == "windows" {
                format!("Get-Content -Tail 60 -Path {}", powershell_quote(&source.value))
            } else {
                format!("tail -n 60 {}", shell_quote(&source.value))
            }
        }
        "command" => source.value.clone(),
        "docker" => {
            if os_type == "windows" {
                format!("docker logs --tail 60 {}", powershell_quote(&source.value))
            } else {
                format!("docker logs --tail 60 {}", shell_quote(&source.value))
            }
        }
        "pm2" => {
            if os_type == "windows" {
                format!(
                    "pm2 logs {} --lines 60 --nostream",
                    powershell_quote(&source.value)
                )
            } else {
                format!(
                    "pm2 logs {} --lines 60 --nostream",
                    shell_quote(&source.value)
                )
            }
        }
        "journald" => {
            if os_type == "windows" {
                return Err("journald log sources are not supported on Windows targets.".to_string());
            }
            format!(
                "journalctl -n 60 -u {} --no-pager",
                shell_quote(&source.value)
            )
        }
        other => {
            return Err(format!("Unsupported log source type '{other}'."));
        }
    };

    Ok(command)
}

fn fetch_project_logs(project: &ProjectConfigData, server: &ServerConfigData) -> Result<Vec<Value>, String> {
    let Some(source) = project.log_source.clone() else {
        return Ok(Vec::new());
    };

    let command = build_log_command(&source, &server.os_type)?;
    let result = execute_ssh_command(server, &project.root_path, &command)?;
    Ok(logs_to_values(project, &source, &result.lines))
}

fn primary_log_command(project: &ProjectConfigData, server: &ServerConfigData) -> String {
    if let Some(source) = project.log_source.as_ref() {
        match source.kind.as_str() {
            "file" => {
                if server.os_type == "windows" {
                    format!("Get-Content -Tail 200 -Path {}", powershell_quote(&source.value))
                } else {
                    format!("tail -n 200 {}", shell_quote(&source.value))
                }
            }
            "docker" => {
                if server.os_type == "windows" {
                    format!("docker logs --tail 200 {}", powershell_quote(&source.value))
                } else {
                    format!("docker logs --tail 200 {}", shell_quote(&source.value))
                }
            }
            "pm2" => format!("pm2 logs {} --lines 200 --nostream", source.value),
            "journald" => format!("journalctl -n 200 -u {} --no-pager", source.value),
            "command" => source.value.clone(),
            _ => format!("cd {}", project.root_path),
        }
    } else if server.os_type == "windows" {
        "Get-ChildItem".to_string()
    } else {
        "ls -la".to_string()
    }
}

fn is_multi_statement(statement: &str) -> bool {
    let trimmed = statement.trim().trim_end_matches(';').trim();
    trimmed.contains(';')
}

fn keyword_allowed(statement: &str, allowed: &[&str]) -> bool {
    let Some(keyword) = statement.split_whitespace().next() else {
        return false;
    };
    allowed
        .iter()
        .any(|candidate| keyword.eq_ignore_ascii_case(candidate))
}

fn mysql_readonly_allowed(statement: &str) -> bool {
    !is_multi_statement(statement)
        && keyword_allowed(statement, &["select", "show", "describe", "desc", "explain"])
}

fn redis_readonly_allowed(statement: &str) -> bool {
    !is_multi_statement(statement)
        && keyword_allowed(
            statement,
            &[
                "get",
                "mget",
                "hget",
                "hgetall",
                "lrange",
                "llen",
                "ttl",
                "exists",
                "keys",
                "type",
                "info",
                "smembers",
                "scard",
                "zrange",
            ],
        )
}

fn mysql_value_to_json(value: MysqlValue) -> Value {
    match value {
        MysqlValue::NULL => Value::Null,
        MysqlValue::Bytes(bytes) => Value::String(String::from_utf8_lossy(&bytes).to_string()),
        MysqlValue::Int(number) => json!(number),
        MysqlValue::UInt(number) => json!(number),
        MysqlValue::Float(number) => json!(number),
        MysqlValue::Double(number) => json!(number),
        MysqlValue::Date(year, month, day, hour, minute, second, micros) => json!(format!(
            "{year:04}-{month:02}-{day:02} {hour:02}:{minute:02}:{second:02}.{:06}",
            micros
        )),
        MysqlValue::Time(negative, days, hours, minutes, seconds, micros) => json!(format!(
            "{}{} {:02}:{:02}:{:02}.{:06}",
            if negative { "-" } else { "" },
            days,
            hours,
            minutes,
            seconds,
            micros
        )),
    }
}

fn run_mysql_query(database: &DatabaseConfigData, statement: &str) -> Result<Value, String> {
    let mut builder = OptsBuilder::new()
        .ip_or_hostname(Some(database.host.clone()))
        .tcp_port(database.port);

    if let Some(username) = database.username.clone() {
        builder = builder.user(Some(username));
    }

    if let Some(password) = secure::read_secret(database.credential_ref.clone())? {
        builder = builder.pass(Some(password));
    }

    if let Some(default_database) = database.default_database.clone() {
        builder = builder.db_name(Some(default_database));
    }

    let mut conn = Conn::new(builder)
        .map_err(|error| format!("Unable to connect to MySQL '{}': {error}", database.name))?;
    let mut result = conn
        .query_iter(statement)
        .map_err(|error| format!("MySQL query failed for '{}': {error}", database.name))?;

    let columns = result
        .columns()
        .as_ref()
        .iter()
        .map(|column| column.name_str().to_string())
        .collect::<Vec<_>>();

    let mut rows = Vec::new();
    for row_result in result.by_ref() {
        let row = row_result
            .map_err(|error| format!("Unable to read MySQL row for '{}': {error}", database.name))?;
        let values = row.unwrap();
        let mut record = Map::new();
        for (column, value) in columns.iter().zip(values.into_iter()) {
            record.insert(column.clone(), mysql_value_to_json(value));
        }
        rows.push(Value::Object(record));
    }

    Ok(json!({
        "databaseId": database.id,
        "engine": "mysql",
        "safety": "allowed",
        "columns": columns,
        "rows": rows,
        "notice": format!("MySQL query executed against '{}'.", database.name)
    }))
}

fn redis_value_to_rows(value: RedisValue) -> (Vec<String>, Vec<Value>) {
    match value {
        RedisValue::Nil => (vec!["value".to_string()], vec![json!({ "value": Value::Null })]),
        RedisValue::Int(number) => (vec!["value".to_string()], vec![json!({ "value": number })]),
        RedisValue::BulkString(bytes) => (
            vec!["value".to_string()],
            vec![json!({ "value": String::from_utf8_lossy(&bytes).to_string() })],
        ),
        RedisValue::SimpleString(text) => (vec!["value".to_string()], vec![json!({ "value": text })]),
        RedisValue::Okay => (vec!["value".to_string()], vec![json!({ "value": "OK" })]),
        RedisValue::Array(values) | RedisValue::Set(values) | RedisValue::Push { data: values, .. } => {
            let rows = values
                .into_iter()
                .enumerate()
                .map(|(index, entry)| {
                    let (_, nested_rows) = redis_value_to_rows(entry);
                    let nested_value = nested_rows
                        .first()
                        .and_then(|row| row.get("value"))
                        .cloned()
                        .unwrap_or_else(|| json!(nested_rows));
                    json!({
                        "index": index,
                        "value": nested_value
                    })
                })
                .collect::<Vec<_>>();
            (vec!["index".to_string(), "value".to_string()], rows)
        }
        RedisValue::Map(entries) => {
            let rows = entries
                .into_iter()
                .map(|(key, entry)| {
                    let (_, key_rows) = redis_value_to_rows(key);
                    let (_, value_rows) = redis_value_to_rows(entry);
                    json!({
                        "key": key_rows.first().and_then(|row| row.get("value")).cloned().unwrap_or_else(|| json!(key_rows)),
                        "value": value_rows.first().and_then(|row| row.get("value")).cloned().unwrap_or_else(|| json!(value_rows))
                    })
                })
                .collect::<Vec<_>>();
            (vec!["key".to_string(), "value".to_string()], rows)
        }
        RedisValue::Attribute { data, .. } => redis_value_to_rows(*data),
        other => (vec!["value".to_string()], vec![json!({ "value": format!("{other:?}") })]),
    }
}

fn run_redis_query(database: &DatabaseConfigData, statement: &str) -> Result<Value, String> {
    let mut url = Url::parse("redis://127.0.0.1/")
        .map_err(|error| format!("Unable to create Redis URL: {error}"))?;
    url.set_host(Some(&database.host))
        .map_err(|error| format!("Unable to apply Redis host: {error}"))?;
    url.set_port(Some(database.port))
        .map_err(|_| "Unable to apply Redis port.".to_string())?;

    if let Some(username) = database.username.as_deref() {
        url.set_username(username)
            .map_err(|_| "Unable to apply Redis username.".to_string())?;
    }

    if let Some(password) = secure::read_secret(database.credential_ref.clone())? {
        url.set_password(Some(&password))
            .map_err(|_| "Unable to apply Redis password.".to_string())?;
    }

    url.set_path(&format!("/{}", database.db_number.unwrap_or(0)));
    let client = redis::Client::open(url.as_str())
        .map_err(|error| format!("Unable to create Redis client for '{}': {error}", database.name))?;
    let mut connection = client
        .get_connection()
        .map_err(|error| format!("Unable to connect to Redis '{}': {error}", database.name))?;

    let parts = statement
        .split_whitespace()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    let Some(command) = parts.first() else {
        return Err("Redis command cannot be empty.".to_string());
    };

    let mut redis_command = redis::cmd(command);
    for argument in parts.iter().skip(1) {
        redis_command.arg(argument);
    }

    let raw = redis_command
        .query::<RedisValue>(&mut connection)
        .map_err(|error| format!("Redis command failed for '{}': {error}", database.name))?;
    let (columns, rows) = redis_value_to_rows(raw);

    Ok(json!({
        "databaseId": database.id,
        "engine": "redis",
        "safety": "allowed",
        "columns": columns,
        "rows": rows,
        "notice": format!("Redis command executed against '{}'.", database.name)
    }))
}

fn classify_command_risk(command: &str) -> (&'static str, bool) {
    let normalized = command.trim().to_ascii_lowercase();
    let blocked_patterns = [
        "rm -rf /",
        "mkfs",
        "shutdown",
        "reboot",
        "halt",
        "poweroff",
        ":(){:|:&};:",
    ];
    if blocked_patterns
        .iter()
        .any(|pattern| normalized.contains(pattern))
    {
        return ("blocked", true);
    }

    if normalized.contains("docker restart")
        || normalized.contains("systemctl restart")
        || normalized.contains("pm2 restart")
        || normalized.contains("deploy")
    {
        return ("caution", false);
    }

    ("safe", false)
}

fn build_ai_suggestion(project: &ProjectConfigData, server: &ServerConfigData, context: &Map<String, Value>) -> Value {
    let warning_source = context
        .get("logSnippet")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .chain(
            context
                .get("terminalSnippet")
                .and_then(Value::as_array)
                .into_iter()
                .flatten(),
        )
        .filter_map(Value::as_str)
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();

    let suggested_command = if warning_source.contains("timeout") {
        primary_log_command(project, server)
    } else if let Some(health_check) = project.health_check_command.as_deref() {
        health_check.to_string()
    } else if server.os_type == "windows" {
        "Get-Process | Select-Object -First 20".to_string()
    } else {
        format!("cd {} && ls -la", project.root_path)
    };

    let (risk, blocked) = classify_command_risk(&suggested_command);

    json!({
        "id": create_id("cmd"),
        "command": suggested_command,
        "reason": if warning_source.contains("timeout") {
            "Inspect the freshest log window before touching downstream services."
        } else if project.health_check_command.is_some() {
            "Run the configured health check before making changes."
        } else {
            "Start with a safe inspection command in the project workspace."
        },
        "risk": risk,
        "requiresConfirmation": true,
        "blocked": blocked
    })
}

fn resolve_provider(config: &Value) -> Result<ProviderConfigData, String> {
    let providers = array(config, "providers")?;
    let settings = config.get("settings").and_then(Value::as_object);
    let default_provider_id = settings
        .and_then(|value| value.get("defaultAiProviderId"))
        .and_then(Value::as_str);

    if let Some(provider_id) = default_provider_id {
        if let Some(provider_value) = find_by_id(providers, provider_id) {
            let provider = parse_provider(provider_value)?;
            if provider.enabled
                && secure::read_secret(provider.api_key_ref.clone())?.is_some()
            {
                return Ok(provider);
            }
        }
    }

    providers
        .iter()
        .map(parse_provider)
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .find(|provider| {
            provider.enabled
                && secure::read_secret(provider.api_key_ref.clone())
                    .map(|secret| secret.is_some())
                    .unwrap_or(false)
        })
        .ok_or_else(|| "No enabled AI provider with a stored API key is available.".to_string())
}

fn append_endpoint(base: Option<&str>, suffix: &str, default: &str) -> String {
    match base.map(str::trim).filter(|value| !value.is_empty()) {
        Some(base_url) if base_url.contains(suffix) => base_url.to_string(),
        Some(base_url) => format!(
            "{}/{}",
            base_url.trim_end_matches('/'),
            suffix.trim_start_matches('/')
        ),
        None => default.to_string(),
    }
}

fn parse_openai_content(response: &Value) -> Option<String> {
    response
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| {
            content.as_str().map(ToString::to_string).or_else(|| {
                content.as_array().map(|parts| {
                    parts
                        .iter()
                        .filter_map(|part| part.get("text").and_then(Value::as_str))
                        .collect::<Vec<_>>()
                        .join("\n")
                })
            })
        })
}

fn parse_anthropic_content(response: &Value) -> Option<String> {
    response
        .get("content")
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|text| !text.trim().is_empty())
}

fn parse_gemini_content(response: &Value) -> Option<String> {
    response
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|text| !text.trim().is_empty())
}

fn request_provider_analysis(provider: &ProviderConfigData, prompt: &str) -> Result<String, String> {
    let api_key = secure::read_secret(provider.api_key_ref.clone())?
        .ok_or_else(|| format!("Provider '{}' is missing an API key.", provider.name))?;
    let client = Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Unable to build AI HTTP client: {error}"))?;

    match provider.provider_type.as_str() {
        "openai" => {
            let endpoint = append_endpoint(
                provider.base_url.as_deref(),
                "chat/completions",
                "https://api.openai.com/v1/chat/completions",
            );
            let response = client
                .post(endpoint)
                .bearer_auth(api_key)
                .json(&json!({
                    "model": provider.model,
                    "temperature": 0.2,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are Proj-Eye, a concise operations assistant. Summarize the likely issue, evidence, and safest next check."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                }))
                .send()
                .and_then(|response| response.error_for_status())
                .map_err(|error| format!("OpenAI request failed: {error}"))?
                .json::<Value>()
                .map_err(|error| format!("OpenAI response was not valid JSON: {error}"))?;

            parse_openai_content(&response)
                .filter(|text| !text.trim().is_empty())
                .ok_or_else(|| "OpenAI response did not include assistant text.".to_string())
        }
        "anthropic" => {
            let endpoint = append_endpoint(
                provider.base_url.as_deref(),
                "v1/messages",
                "https://api.anthropic.com/v1/messages",
            );
            let response = client
                .post(endpoint)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&json!({
                    "model": provider.model,
                    "max_tokens": 512,
                    "system": "You are Proj-Eye, a concise operations assistant. Summarize the likely issue, evidence, and safest next check.",
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                }))
                .send()
                .and_then(|response| response.error_for_status())
                .map_err(|error| format!("Anthropic request failed: {error}"))?
                .json::<Value>()
                .map_err(|error| format!("Anthropic response was not valid JSON: {error}"))?;

            parse_anthropic_content(&response)
                .ok_or_else(|| "Anthropic response did not include assistant text.".to_string())
        }
        "gemini" => {
            let endpoint = append_endpoint(
                provider.base_url.as_deref(),
                &format!("models/{}:generateContent", provider.model),
                &format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                    provider.model
                ),
            );
            let response = client
                .post(endpoint)
                .header("x-goog-api-key", api_key)
                .json(&json!({
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "text": prompt
                                }
                            ]
                        }
                    ]
                }))
                .send()
                .and_then(|response| response.error_for_status())
                .map_err(|error| format!("Gemini request failed: {error}"))?
                .json::<Value>()
                .map_err(|error| format!("Gemini response was not valid JSON: {error}"))?;

            parse_gemini_content(&response)
                .ok_or_else(|| "Gemini response did not include assistant text.".to_string())
        }
        other => Err(format!("Provider type '{other}' is not supported in the MVP.")),
    }
}

fn build_ai_prompt(project: &ProjectConfigData, server: &ServerConfigData, context: &Map<String, Value>) -> String {
    let log_lines = context
        .get("logSnippet")
        .and_then(Value::as_array)
        .map(|lines| {
            lines
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let terminal_lines = context
        .get("terminalSnippet")
        .and_then(Value::as_array)
        .map(|lines| {
            lines
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let database_summary = context
        .get("databaseSummary")
        .and_then(Value::as_array)
        .map(|lines| {
            lines
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();

    format!(
        "Project: {}\nServer: {}@{}:{} ({})\nRoot path: {}\nDatabases: {}\n\nRecent terminal:\n{}\n\nRecent logs:\n{}\n\nRespond in three short paragraphs: likely issue, supporting evidence, safest next check.",
        project.name,
        server.username,
        server.host,
        server.port,
        server.os_type,
        project.root_path,
        if database_summary.is_empty() {
            "none".to_string()
        } else {
            database_summary
        },
        if terminal_lines.is_empty() {
            "none".to_string()
        } else {
            terminal_lines
        },
        if log_lines.is_empty() {
            "none".to_string()
        } else {
            log_lines
        }
    )
}

fn execute_command_for_session(
    app: &AppHandle,
    session_id: &str,
    command: &str,
) -> Result<Value, String> {
    let snapshot = {
        let state = runtime_state()
            .lock()
            .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
        state
            .sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| "Terminal session not found.".to_string())?
    };

    let config = config::refresh(app)?;
    let server = parse_server(
        find_by_id(array(&config, "servers")?, &snapshot.server_id)
            .ok_or_else(|| "Server configuration is missing for this session.".to_string())?,
    )?;

    let execution = execute_ssh_command(&server, &snapshot.cwd, command)?;
    let exit_code = execution.exit_status.unwrap_or(0);
    let transcript_lines = std::iter::once(format!("$ {command}"))
        .chain(execution.lines)
        .chain((exit_code != 0).then(|| format!("[exit {exit_code}]")))
        .collect::<Vec<_>>();

    let updated = update_session(session_id, |session| {
        if let Some(next_cwd) = execution.cwd.clone().filter(|value| !value.is_empty()) {
            session.cwd = next_cwd;
        }
        session.connection_state = "ready".to_string();
        session.transcript.extend(transcript_lines.clone());
    })?;

    Ok(json!({
        "session": session_to_value(&updated),
        "lines": transcript_lines
    }))
}

pub fn connect_project(app: &AppHandle, project_id: &str) -> Result<Value, String> {
    let (_, project, server) = load_project_context(app, project_id)?;

    let handshake_command = if server.os_type == "windows" {
        "Get-Location"
    } else {
        "pwd"
    };
    let handshake = execute_ssh_command(&server, &project.root_path, handshake_command)?;
    let mut transcript = vec![
        format!(
            "Connected to {}@{}:{}",
            server.username, server.host, server.port
        ),
        format!("cd {}", project.root_path),
    ];
    transcript.extend(handshake.lines);
    if let Some(health_check) = project.health_check_command.as_deref() {
        transcript.push(format!("Health check configured: {health_check}"));
    }
    transcript.push("Environment is ready.".to_string());

    let session = persist_session(RuntimeSession {
        id: create_id("session"),
        project_id: project.id.clone(),
        server_id: server.id.clone(),
        tab_id: create_id("tab"),
        title: "shell".to_string(),
        cwd: handshake.cwd.unwrap_or_else(|| project.root_path.clone()),
        connection_state: "ready".to_string(),
        transcript,
        started_at: now_ms(),
    })?;

    let logs = match fetch_project_logs(&project, &server) {
        Ok(lines) => lines,
        Err(error) if project.log_source.is_some() => {
            let source = project.log_source.as_ref().unwrap();
            logs_to_values(&project, source, &[format!("[WARN] Unable to fetch logs: {error}")])
        }
        Err(_) => Vec::new(),
    };

    let payload = json!({
        "session": session_to_value(&session),
        "tab": tab_to_value(&session, handshake_command, true),
        "logs": logs
    });

    emit_runtime_event(
        app,
        SESSION_EVENT,
        json!({
            "kind": "connected",
            "projectId": project_id,
            "payload": payload
        }),
    );
    emit_runtime_event(
        app,
        LOG_EVENT,
        json!({
            "kind": "seeded",
            "projectId": project_id,
            "logs": payload.get("logs").cloned().unwrap_or_else(|| json!([]))
        }),
    );

    Ok(payload)
}

pub fn create_terminal_tab(
    app: &AppHandle,
    project_id: &str,
    current_count: usize,
) -> Result<Value, String> {
    let (_, project, server) = load_project_context(app, project_id)?;
    let probe_command = if server.os_type == "windows" {
        "Get-Location"
    } else {
        "pwd"
    };
    let probe = execute_ssh_command(&server, &project.root_path, probe_command)?;

    let title = format!("shell-{}", current_count + 1);
    let mut transcript = vec![format!(
        "Connected to {}@{}:{}",
        server.username, server.host, server.port
    )];
    transcript.extend(probe.lines);

    let session = persist_session(RuntimeSession {
        id: create_id("session"),
        project_id: project.id.clone(),
        server_id: server.id.clone(),
        tab_id: create_id("tab"),
        title: title.clone(),
        cwd: probe.cwd.unwrap_or_else(|| project.root_path.clone()),
        connection_state: "ready".to_string(),
        transcript,
        started_at: now_ms(),
    })?;

    let payload = json!({
        "session": session_to_value(&session),
        "tab": tab_to_value(&session, probe_command, true)
    });

    emit_runtime_event(
        app,
        SESSION_EVENT,
        json!({
            "kind": "tab-opened",
            "projectId": project_id,
            "payload": payload
        }),
    );

    Ok(payload)
}

pub fn execute_session_command(
    app: &AppHandle,
    session_id: &str,
    command: &str,
) -> Result<Value, String> {
    if command.trim().is_empty() {
        return Err("Command cannot be empty.".to_string());
    }

    execute_command_for_session(app, session_id, command.trim())
}

pub fn refresh_project_logs(app: &AppHandle, project_id: &str) -> Result<Vec<Value>, String> {
    let (_, project, server) = load_project_context(app, project_id)?;
    let logs = fetch_project_logs(&project, &server)?;

    emit_runtime_event(
        app,
        LOG_EVENT,
        json!({
            "kind": "seeded",
            "projectId": project_id,
            "logs": logs
        }),
    );

    Ok(logs)
}

pub fn run_database_query(
    app: &AppHandle,
    database_id: &str,
    statement: &str,
) -> Result<Value, String> {
    let config = config::refresh(app)?;
    let database = parse_database(
        find_by_id(array(&config, "databases")?, database_id)
            .ok_or_else(|| "Database not found.".to_string())?,
    )?;
    let trimmed = statement.trim();

    if trimmed.is_empty() {
        return Err("Query cannot be empty.".to_string());
    }

    let result = match database.database_type.as_str() {
        "postgresql" => json!({
            "databaseId": database.id,
            "engine": "postgresql",
            "safety": "unsupported",
            "columns": [],
            "rows": [],
            "notice": "PostgreSQL is reserved for future implementation in this MVP."
        }),
        "mysql" => {
            if database.readonly_mode && !mysql_readonly_allowed(trimmed) {
                json!({
                    "databaseId": database.id,
                    "engine": "mysql",
                    "safety": "readonly_only",
                    "columns": [],
                    "rows": [],
                    "notice": "Only single-statement SELECT / SHOW / DESCRIBE / EXPLAIN queries are allowed."
                })
            } else {
                run_mysql_query(&database, trimmed)?
            }
        }
        "redis" => {
            if !redis_readonly_allowed(trimmed) {
                json!({
                    "databaseId": database.id,
                    "engine": "redis",
                    "safety": "blocked",
                    "columns": [],
                    "rows": [],
                    "notice": "The Redis command is blocked by the MVP whitelist."
                })
            } else {
                run_redis_query(&database, trimmed)?
            }
        }
        other => json!({
            "databaseId": database.id,
            "engine": other,
            "safety": "unsupported",
            "columns": [],
            "rows": [],
            "notice": format!("Database type '{other}' is not supported in the MVP.")
        }),
    };

    emit_runtime_event(
        app,
        QUERY_EVENT,
        json!({
            "databaseId": database_id,
            "statement": trimmed,
            "result": result
        }),
    );

    Ok(result)
}

pub fn analyze_project(app: &AppHandle, project_id: &str, context: Value) -> Result<Value, String> {
    let (config, project, server) = load_project_context(app, project_id)?;
    let context_object = object(&context)?;
    let provider = resolve_provider(&config)?;
    let prompt = build_ai_prompt(&project, &server, context_object);
    let assistant_message = request_provider_analysis(&provider, &prompt)?;
    let suggestion = build_ai_suggestion(&project, &server, context_object);

    let payload = json!({
        "messages": [
            {
                "id": create_id("msg"),
                "speaker": "system",
                "content": format!("Context pack routed through {} / {}.", provider.name, provider.model),
                "createdAt": now_ms()
            },
            {
                "id": create_id("msg"),
                "speaker": "assistant",
                "content": assistant_message,
                "createdAt": now_ms()
            }
        ],
        "suggestion": suggestion
    });

    emit_runtime_event(
        app,
        AI_EVENT,
        json!({
            "kind": "analysis",
            "projectId": project_id,
            "payload": payload
        }),
    );

    Ok(payload)
}

pub fn confirm_suggested_command(
    app: &AppHandle,
    project_id: &str,
    session_id: Option<String>,
    suggestion: Value,
) -> Result<Value, String> {
    let command = suggestion
        .get("command")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if command.is_empty() {
        return Err("Suggested command is empty.".to_string());
    }

    let (_, blocked) = classify_command_risk(&command);
    if blocked {
        return Err("This command is blocked by the Proj-Eye safety policy.".to_string());
    }

    let session = find_project_session(project_id, session_id.as_deref())?;
    let payload = execute_command_for_session(app, &session.id, &command)?;

    emit_runtime_event(
        app,
        AI_EVENT,
        json!({
            "kind": "command-confirmed",
            "projectId": project_id,
            "payload": payload
        }),
    );

    Ok(payload)
}

pub fn validate_provider(app: &AppHandle, provider_id: &str) -> Result<Value, String> {
    let config = config::refresh(app)?;
    let provider = parse_provider(
        find_by_id(array(&config, "providers")?, provider_id)
            .ok_or_else(|| "Provider configuration not found.".to_string())?,
    )?;

    if !provider.enabled {
        return Ok(json!({
            "ok": false,
            "message": format!("Provider '{}' is disabled.", provider.name)
        }));
    }

    let response = request_provider_analysis(
        &provider,
        "Reply with a short readiness acknowledgement for an operations assistant health check.",
    )?;

    Ok(json!({
        "ok": true,
        "message": format!("{} responded successfully: {}", provider.name, response.trim())
    }))
}
