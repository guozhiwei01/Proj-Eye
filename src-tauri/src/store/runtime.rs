use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use mysql::{prelude::Queryable, Conn, OptsBuilder, Value as MysqlValue};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use redis::Value as RedisValue;
use reqwest::blocking::Client;
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter};
use url::Url;
use uuid::Uuid;

use super::{config, diagnostics, secure};

const SESSION_EVENT: &str = "proj-eye://runtime/session";
const TERMINAL_EVENT: &str = "proj-eye://runtime/terminal";
const TERMINAL_STREAM_EVENT: &str = "proj-eye://runtime/terminal-stream";
const LOG_EVENT: &str = "proj-eye://runtime/logs";
const QUERY_EVENT: &str = "proj-eye://runtime/query";
const AI_EVENT: &str = "proj-eye://runtime/ai";
const CWD_MARKER: &str = "__PROJ_EYE_CWD__";
const EXIT_MARKER: &str = "__PROJ_EYE_EXIT__";
const AI_MAX_RESPONSE_TOKENS: u32 = 320;

#[derive(Clone)]
struct RuntimeSession {
    id: String,
    project_id: String,
    tab_id: String,
    title: String,
    cwd: String,
    connection_state: String,
    transcript: Vec<String>,
    open_line: bool,
    started_at: u64,
}

struct InteractiveShell {
    child: Box<dyn portable_pty::Child + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Box<dyn MasterPty + Send>,
    cleanup_paths: Vec<PathBuf>,
    pending_password: Option<String>,
}

#[derive(Default)]
struct RuntimeState {
    sessions: HashMap<String, RuntimeSession>,
    interactive_shells: HashMap<String, InteractiveShell>,
}

struct SshCommandSpec {
    args: Vec<String>,
    envs: Vec<(String, String)>,
    cleanup_paths: Vec<PathBuf>,
    password: Option<String>,
}

#[derive(Clone)]
struct ServerConfigData {
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

#[derive(Clone)]
struct ProviderChatMessage {
    role: String,
    content: String,
}

struct AiModelReply {
    answer: String,
    suggested_command: Option<String>,
    suggestion_reason: Option<String>,
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

fn localized_text(locale: &str, zh: &str, en: &str) -> String {
    if locale == "zh-CN" {
        zh.to_string()
    } else {
        en.to_string()
    }
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

fn session_intro_transcript(
    project: &ProjectConfigData,
    server: &ServerConfigData,
    cwd: &str,
    include_health_check: bool,
    reconnecting: bool,
) -> Vec<String> {
    let mut transcript = vec![if reconnecting {
        format!(
            "Reconnecting to {}@{}:{}",
            server.username, server.host, server.port
        )
    } else {
        format!(
            "Connecting to {}@{}:{}",
            server.username, server.host, server.port
        )
    }];

    let display_cwd = if cwd.trim().is_empty() {
        if server.os_type == "windows" {
            "%USERPROFILE%"
        } else {
            "~"
        }
    } else {
        cwd
    };

    transcript.push(format!("cd {display_cwd}"));

    if include_health_check {
        if let Some(health_check) = project.health_check_command.as_deref() {
            transcript.push(format!("Health check configured: {health_check}"));
        }
    }

    transcript.push("Launching interactive shell...".to_string());
    transcript
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

fn store_interactive_shell(session_id: &str, shell: InteractiveShell) -> Result<(), String> {
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
    state.interactive_shells.insert(session_id.to_string(), shell);
    Ok(())
}

fn cleanup_interactive_shell(session_id: &str) {
    let shell = {
        let mut state = match runtime_state().lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        state.interactive_shells.remove(session_id)
    };

    if let Some(mut shell) = shell {
        let _ = shell.child.kill();
        let _ = shell.child.wait();
        cleanup_temp_paths(&shell.cleanup_paths);
    }
}

fn password_prompt_detected(chunk: &str) -> bool {
    let normalized = chunk.to_ascii_lowercase();
    normalized.contains("password:")
        || normalized.contains("password for")
        || normalized.contains("verification code:")
}

fn maybe_answer_password_prompt(session_id: &str, chunk: &str) -> Result<(), String> {
    if !password_prompt_detected(chunk) {
        return Ok(());
    }

    let (writer, password) = {
        let mut state = runtime_state()
            .lock()
            .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
        let shell = state
            .interactive_shells
            .get_mut(session_id)
            .ok_or_else(|| "Interactive shell is not available for this session.".to_string())?;
        let Some(password) = shell.pending_password.take() else {
            return Ok(());
        };
        (Arc::clone(&shell.writer), password)
    };

    let mut writer = writer
        .lock()
        .map_err(|_| "Interactive shell writer lock was poisoned.".to_string())?;
    writer
        .write_all(format!("{password}\r").as_bytes())
        .map_err(|error| format!("Unable to answer the SSH password prompt: {error}"))?;
    writer
        .flush()
        .map_err(|error| format!("Unable to flush the SSH password response: {error}"))?;

    Ok(())
}

fn remove_session(session_id: &str) -> Result<Option<RuntimeSession>, String> {
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
    Ok(state.sessions.remove(session_id))
}

fn emit_terminal_session(app: &AppHandle, session: &RuntimeSession) {
    emit_runtime_event(
        app,
        TERMINAL_EVENT,
        json!({
            "kind": "updated",
            "projectId": session.project_id,
            "session": session_to_value(session)
        }),
    );
}

fn emit_terminal_chunk(app: &AppHandle, session: &RuntimeSession, data: &str) {
    if data.is_empty() {
        return;
    }

    emit_runtime_event(
        app,
        TERMINAL_STREAM_EVENT,
        json!({
            "kind": "chunk",
            "projectId": session.project_id,
            "sessionId": session.id,
            "data": data
        }),
    );
}

fn append_transcript_fragment(session: &mut RuntimeSession, fragment: &str, newline_terminated: bool) {
    if fragment.is_empty() && !newline_terminated {
        return;
    }

    if session.open_line {
        if let Some(last_line) = session.transcript.last_mut() {
            last_line.push_str(fragment);
        } else if !fragment.is_empty() {
            session.transcript.push(fragment.to_string());
        }
    } else {
        session.transcript.push(fragment.to_string());
    }

    session.open_line = !newline_terminated;
}

fn strip_ansi_sequences(input: &str) -> String {
    let mut output = String::new();
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '\u{1b}' {
            if ch != '\u{7}' {
                output.push(ch);
            }
            continue;
        }

        match chars.peek().copied() {
            Some('[') => {
                chars.next();
                while let Some(next) = chars.next() {
                    if ('@'..='~').contains(&next) {
                        break;
                    }
                }
            }
            Some(']') => {
                chars.next();
                while let Some(next) = chars.next() {
                    if next == '\u{7}' {
                        break;
                    }
                    if next == '\u{1b}' && matches!(chars.peek(), Some('\\')) {
                        chars.next();
                        break;
                    }
                }
            }
            _ => {
                let _ = chars.next();
            }
        }
    }

    output
}

fn append_transcript_text(session: &mut RuntimeSession, text: &str) {
    if text.is_empty() {
        return;
    }

    for piece in text.replace("\r\n", "\n").replace('\r', "\n").split_inclusive('\n') {
        let newline_terminated = piece.ends_with('\n');
        let fragment = strip_ansi_sequences(piece.trim_end_matches('\n'));
        append_transcript_fragment(session, &fragment, newline_terminated);
    }
}

fn process_interactive_output(
    app: &AppHandle,
    session_id: &str,
    pending: &mut String,
    chunk: &str,
) {
    if chunk.is_empty() {
        return;
    }

    pending.push_str(chunk);

    let mut display = String::new();
    let mut transcript_text = String::new();
    let mut cwd_update: Option<String> = None;

    while let Some(newline_index) = pending.find('\n') {
        let segment: String = pending.drain(..=newline_index).collect();
        let line = segment.trim_end_matches('\n').trim_end_matches('\r');

        if line.starts_with(CWD_MARKER) {
            cwd_update = Some(line.trim_start_matches(CWD_MARKER).trim().to_string());
            continue;
        }

        display.push_str(&segment);
        transcript_text.push_str(&segment);
    }

    if !pending.is_empty() && !pending.starts_with(CWD_MARKER) && !CWD_MARKER.starts_with(pending.as_str()) {
        display.push_str(pending);
        transcript_text.push_str(pending);
        pending.clear();
    }

    if display.is_empty() && cwd_update.is_none() {
        return;
    }

    let updated = update_session(session_id, |session| {
        if let Some(next_cwd) = cwd_update.clone().filter(|value| !value.is_empty()) {
            session.cwd = next_cwd;
        }
        append_transcript_text(session, &transcript_text);
        session.connection_state = "ready".to_string();
    });

    if let Ok(session) = updated {
        if !display.is_empty() {
            emit_terminal_chunk(app, &session, &display);
        }
        emit_terminal_session(app, &session);
    }
}

fn mark_interactive_session_failed(app: &AppHandle, session_id: &str, message: &str) {
    if let Ok(session) = update_session(session_id, |session| {
        session.connection_state = "failed".to_string();
        session.open_line = false;
        session.transcript.push(message.to_string());
    }) {
        emit_terminal_chunk(app, &session, &format!("\r\n{message}\r\n"));
        emit_terminal_session(app, &session);
    }

    cleanup_interactive_shell(session_id);
}

fn spawn_stream_reader<R>(app: AppHandle, session_id: String, reader: R, stderr: bool)
where
    R: std::io::Read + Send + 'static,
{
    thread::spawn(move || {
        let mut reader = reader;
        let mut buffer = [0_u8; 4096];
        let mut pending = String::new();

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let chunk = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = stderr;
                    if let Err(error) = maybe_answer_password_prompt(&session_id, &chunk) {
                        mark_interactive_session_failed(&app, &session_id, &error);
                        return;
                    }
                    process_interactive_output(&app, &session_id, &mut pending, &chunk);
                }
                Err(error) => {
                    mark_interactive_session_failed(
                        &app,
                        &session_id,
                        &format!("[terminal stream error] {error}"),
                    );
                    return;
                }
            }
        }

        if !pending.is_empty() {
            let trailing = pending.clone();
            process_interactive_output(&app, &session_id, &mut pending, &trailing);
        }
    });
}

fn spawn_session_watcher(app: AppHandle, session_id: String) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(400));

        let status = {
            let mut state = match runtime_state().lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            let shell = match state.interactive_shells.get_mut(&session_id) {
                Some(shell) => shell,
                None => return,
            };

            match shell.child.try_wait() {
                Ok(status) => status,
                Err(error) => {
                    drop(state);
                    mark_interactive_session_failed(
                        &app,
                        &session_id,
                        &format!("[terminal process error] {error}"),
                    );
                    return;
                }
            }
        };

        if let Some(status) = status {
            let exit_code = status.exit_code();
            let message = if exit_code == 0 {
                "[session closed]".to_string()
            } else {
                format!("[session closed with exit {exit_code}]")
            };

            if let Ok(session) = update_session(&session_id, |session| {
                session.connection_state = "failed".to_string();
                session.open_line = false;
                session.transcript.push(message.clone());
            }) {
                emit_terminal_chunk(&app, &session, &format!("\r\n{message}\r\n"));
                emit_terminal_session(&app, &session);
            }

            cleanup_interactive_shell(&session_id);
            return;
        }
    });
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
    "/dev/null"
}

fn local_ssh_config_sink() -> &'static str {
    "/dev/null"
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

fn build_ssh_command_spec(server: &ServerConfigData) -> Result<SshCommandSpec, String> {
    let mut args = vec![
        "-F".to_string(),
        local_ssh_config_sink().to_string(),
        "-p".to_string(),
        server.port.to_string(),
        "-o".to_string(),
        "StrictHostKeyChecking=no".to_string(),
        "-o".to_string(),
        format!("UserKnownHostsFile={}", local_known_hosts_sink()),
        "-o".to_string(),
        "ConnectTimeout=20".to_string(),
    ];
    let mut envs = Vec::new();
    let mut cleanup_paths = Vec::new();
    let mut password = None;

    match server.auth_type.as_str() {
        "agent" => {
            args.push("-o".to_string());
            args.push("PreferredAuthentications=publickey".to_string());
        }
        "password" => {
            let secret = secure::read_secret(server.credential_ref.clone())?
                .ok_or_else(|| format!("No password is stored for server '{}'.", server.name))?;
            let askpass_path = create_askpass_script(&secret)?;
            args.push("-o".to_string());
            args.push("PreferredAuthentications=password,keyboard-interactive".to_string());
            args.push("-o".to_string());
            args.push("PubkeyAuthentication=no".to_string());
            envs.push((
                "SSH_ASKPASS".to_string(),
                askpass_path.to_string_lossy().to_string(),
            ));
            envs.push(("SSH_ASKPASS_REQUIRE".to_string(), "force".to_string()));
            envs.push(("PROJ_EYE_SSH_PASSWORD".to_string(), secret.clone()));
            if !cfg!(windows) {
                envs.push(("DISPLAY".to_string(), "proj-eye:0".to_string()));
            }
            cleanup_paths.push(askpass_path);
            password = Some(secret);
        }
        _ => {
            let secret = secure::read_secret(server.credential_ref.clone())?
                .ok_or_else(|| format!("No private key is stored for server '{}'.", server.name))?;
            let key_path = create_private_key_file(&secret)?;
            args.push("-i".to_string());
            args.push(key_path.to_string_lossy().to_string());
            args.push("-o".to_string());
            args.push("IdentitiesOnly=yes".to_string());
            cleanup_paths.push(key_path);
        }
    }

    args.push(format!("{}@{}", server.username, server.host));

    Ok(SshCommandSpec {
        args,
        envs,
        cleanup_paths,
        password,
    })
}

fn build_interactive_ssh_command_spec(server: &ServerConfigData) -> Result<SshCommandSpec, String> {
    let mut args = vec![
        "-F".to_string(),
        local_ssh_config_sink().to_string(),
        "-p".to_string(),
        server.port.to_string(),
        "-o".to_string(),
        "StrictHostKeyChecking=no".to_string(),
        "-o".to_string(),
        format!("UserKnownHostsFile={}", local_known_hosts_sink()),
        "-o".to_string(),
        "ConnectTimeout=20".to_string(),
        "-o".to_string(),
        "NumberOfPasswordPrompts=1".to_string(),
    ];
    let mut cleanup_paths = Vec::new();
    let mut password = None;

    match server.auth_type.as_str() {
        "agent" => {
            args.push("-o".to_string());
            args.push("PreferredAuthentications=publickey".to_string());
        }
        "password" => {
            let secret = secure::read_secret(server.credential_ref.clone())?
                .ok_or_else(|| format!("No password is stored for server '{}'.", server.name))?;
            args.push("-o".to_string());
            args.push("PreferredAuthentications=password,keyboard-interactive".to_string());
            args.push("-o".to_string());
            args.push("PubkeyAuthentication=no".to_string());
            password = Some(secret);
        }
        _ => {
            let secret = secure::read_secret(server.credential_ref.clone())?
                .ok_or_else(|| format!("No private key is stored for server '{}'.", server.name))?;
            let key_path = create_private_key_file(&secret)?;
            args.push("-i".to_string());
            args.push(key_path.to_string_lossy().to_string());
            args.push("-o".to_string());
            args.push("IdentitiesOnly=yes".to_string());
            cleanup_paths.push(key_path);
        }
    }

    args.push(format!("{}@{}", server.username, server.host));

    Ok(SshCommandSpec {
        args,
        envs: Vec::new(),
        cleanup_paths,
        password,
    })
}

fn prepare_ssh_command(server: &ServerConfigData) -> Result<(Command, Vec<PathBuf>), String> {
    let spec = build_ssh_command_spec(server)?;
    let mut ssh = Command::new("ssh");
    ssh.args(&spec.args);
    for (key, value) in &spec.envs {
        ssh.env(key, value);
    }
    if spec.password.is_some() {
        ssh.stdin(Stdio::null());
    }

    Ok((ssh, spec.cleanup_paths))
}

fn build_interactive_remote_command(server: &ServerConfigData, cwd: &str) -> String {
    if server.os_type == "windows" {
        let script = format!(
            "Set-Location -LiteralPath {}; function prompt {{ Write-Output ('{}' + (Get-Location).Path); \"PS $((Get-Location).Path)> \" }}",
            powershell_quote(cwd),
            CWD_MARKER
        );
        format!(
            "powershell -NoProfile -NoLogo -NoExit -Command {}",
            powershell_quote(&script)
        )
    } else {
        let cd_command = if cwd.trim().is_empty() {
            "cd >/dev/null 2>&1 || exit 1".to_string()
        } else {
            format!("cd {} >/dev/null 2>&1 || exit 1", shell_quote(cwd))
        };
        let prompt_command = format!(
            "alias ll='ls -alF'; alias la='ls -A'; alias l='ls -CF'; printf \"{}%s\\n\" \"$PWD\"",
            CWD_MARKER
        );
        let script = format!(
            "{cd_command}\nunset TMUX\nunset BASH_ENV\nunset ENV\nexport PROMPT_COMMAND={}\nexport PS1='\\u@\\h:\\w\\\\$ '\nexec env PROJ_EYE_INTERACTIVE=1 bash --noprofile --norc -i",
            shell_quote(&prompt_command)
        );
        format!("sh -lc {}", shell_quote(&script))
    }
}

fn spawn_interactive_ssh_session(
    app: &AppHandle,
    session: RuntimeSession,
    server: &ServerConfigData,
) -> Result<RuntimeSession, String> {
    let remote_command = build_interactive_remote_command(server, &session.cwd);
    let spec = build_interactive_ssh_command_spec(server)?;
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 32,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Unable to open a local PTY: {error}"))?;

    let mut command = CommandBuilder::new("ssh");
    let host = spec
        .args
        .last()
        .cloned()
        .ok_or_else(|| "Interactive SSH target is missing.".to_string())?;
    let ssh_args = &spec.args[..spec.args.len().saturating_sub(1)];
    command.args(ssh_args);
    command.arg("-tt");
    command.arg(host);
    command.arg(&remote_command);
    for (key, value) in &spec.envs {
        command.env(key, value);
    }

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("Unable to start the interactive ssh session: {error}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("Unable to open the PTY reader: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("Unable to open the PTY writer: {error}"))?;
    let writer = Arc::new(Mutex::new(writer));

    let persisted = persist_session(session)?;
    if let Err(error) = store_interactive_shell(
        &persisted.id,
        InteractiveShell {
            child,
            writer,
            master: pair.master,
            cleanup_paths: spec.cleanup_paths.clone(),
            pending_password: spec.password.clone(),
        },
    ) {
        cleanup_temp_paths(&spec.cleanup_paths);
        return Err(error);
    }

    spawn_stream_reader(app.clone(), persisted.id.clone(), reader, false);
    spawn_session_watcher(app.clone(), persisted.id.clone());

    Ok(persisted)
}

fn execute_ssh_command(server: &ServerConfigData, cwd: &str, command: &str) -> Result<CommandExecution, String> {
    let remote_command = build_remote_command(server, cwd, command);
    let (mut ssh, cleanup) = prepare_ssh_command(server)?;
    ssh.arg(remote_command);

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

fn default_project_inspection_command(project: &ProjectConfigData, server: &ServerConfigData) -> String {
    if server.os_type == "windows" {
        if project.root_path.trim().is_empty() {
            "Get-Location".to_string()
        } else {
            format!(
                "Get-ChildItem -Force -LiteralPath {} | Select-Object -First 50",
                powershell_quote(&project.root_path)
            )
        }
    } else if project.root_path.trim().is_empty() {
        "pwd".to_string()
    } else {
        format!("ls -la {}", shell_quote(&project.root_path))
    }
}

fn normalize_ai_suggested_command(command: &str) -> Option<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut non_empty_lines = trimmed.lines().map(str::trim).filter(|line| !line.is_empty());
    let first_line = non_empty_lines.next()?;
    if non_empty_lines.next().is_some() {
        return None;
    }

    if first_line.contains("&&")
        || first_line.contains("||")
        || first_line.contains(';')
        || first_line.contains("$(")
        || first_line.contains('`')
        || first_line.contains('>')
        || first_line.contains('<')
    {
        return None;
    }

    if first_line.matches('|').count() > 1 {
        return None;
    }

    Some(first_line.to_string())
}

fn build_ai_suggestion(
    project: &ProjectConfigData,
    server: &ServerConfigData,
    context: &Map<String, Value>,
    locale: &str,
) -> Value {
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
        .chain(
            context
                .get("commandOutputSnippet")
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
    } else {
        default_project_inspection_command(project, server)
    };

    let (risk, blocked) = classify_command_risk(&suggested_command);

    json!({
        "id": create_id("cmd"),
        "command": suggested_command,
        "reason": if warning_source.contains("timeout") {
            localized_text(
                locale,
                "先看最新一波错误日志，再判断是否要动下游依赖。",
                "Inspect the freshest log window before touching downstream services.",
            )
        } else if project.health_check_command.is_some() {
            localized_text(
                locale,
                "先跑已配置的健康检查，再决定是否需要变更。",
                "Run the configured health check before making changes.",
            )
        } else {
            localized_text(
                locale,
                "先用一条安全的只读命令检查项目当前状态。",
                "Start with a safe inspection command in the project workspace.",
            )
        },
        "risk": risk,
        "requiresConfirmation": true,
        "blocked": blocked
    })
}

fn resolve_ui_locale(config: &Value) -> &str {
    config
        .get("settings")
        .and_then(Value::as_object)
        .and_then(|settings| settings.get("locale"))
        .and_then(Value::as_str)
        .unwrap_or("zh-CN")
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

fn request_provider_chat(
    provider: &ProviderConfigData,
    system_prompt: &str,
    messages: &[ProviderChatMessage],
) -> Result<String, String> {
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
            let request_messages = std::iter::once(json!({
                "role": "system",
                "content": system_prompt
            }))
            .chain(messages.iter().map(|message| {
                json!({
                    "role": message.role.clone(),
                    "content": message.content.clone()
                })
            }))
            .collect::<Vec<_>>();
            let response = client
                .post(endpoint)
                .bearer_auth(api_key)
                .json(&json!({
                    "model": provider.model,
                    "temperature": 0.2,
                    "max_tokens": AI_MAX_RESPONSE_TOKENS,
                    "messages": request_messages
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
            let request_messages = messages
                .iter()
                .map(|message| {
                    json!({
                        "role": message.role.clone(),
                        "content": message.content.clone()
                    })
                })
                .collect::<Vec<_>>();
            let response = client
                .post(endpoint)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&json!({
                    "model": provider.model,
                    "max_tokens": AI_MAX_RESPONSE_TOKENS,
                    "system": system_prompt,
                    "messages": request_messages
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
            let contents = messages
                .iter()
                .map(|message| {
                    json!({
                        "role": if message.role == "assistant" { "model" } else { "user" },
                        "parts": [
                            {
                                "text": message.content.clone()
                            }
                        ]
                    })
                })
                .collect::<Vec<_>>();
            let response = client
                .post(endpoint)
                .header("x-goog-api-key", api_key)
                .json(&json!({
                    "systemInstruction": {
                        "parts": [
                            {
                                "text": system_prompt
                            }
                        ]
                    },
                    "contents": contents,
                    "generationConfig": {
                        "maxOutputTokens": AI_MAX_RESPONSE_TOKENS
                    }
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

fn extract_json_object(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut start = None;
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (index, ch) in trimmed.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
                continue;
            }

            match ch {
                '\\' => escaped = true,
                '"' => in_string = false,
                _ => {}
            }
            continue;
        }

        match ch {
            '"' => in_string = true,
            '{' => {
                if start.is_none() {
                    start = Some(index);
                }
                depth += 1;
            }
            '}' => {
                if depth == 0 {
                    continue;
                }
                depth -= 1;
                if depth == 0 {
                    let begin = start?;
                    return Some(trimmed[begin..index + ch.len_utf8()].to_string());
                }
            }
            _ => {}
        }
    }

    None
}

fn value_at_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    Some(current)
}

fn first_string_value(value: &Value, paths: &[&[&str]]) -> Option<String> {
    paths.iter().find_map(|path| {
        value_at_path(value, path)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(ToString::to_string)
    })
}

fn parse_ai_model_reply(text: &str) -> Option<AiModelReply> {
    let json_candidate = extract_json_object(text)?;
    let value = serde_json::from_str::<Value>(&json_candidate).ok()?;
    let answer = first_string_value(&value, &[&["answer"], &["analysis"], &["summary"]])?;
    let suggested_command = first_string_value(
        &value,
        &[
            &["suggestedCommand"],
            &["command"],
            &["nextCommand"],
            &["suggestion", "command"],
        ],
    );
    let suggestion_reason = first_string_value(
        &value,
        &[
            &["suggestionReason"],
            &["reason"],
            &["commandReason"],
            &["suggestion", "reason"],
        ],
    );

    Some(AiModelReply {
        answer,
        suggested_command,
        suggestion_reason,
    })
}

#[allow(dead_code)]
fn build_ai_system_prompt(locale: &str) -> String {
    let target_language = if locale == "zh-CN" {
        "Simplified Chinese"
    } else {
        "English"
    };

    format!(
        "You are Proj-Eye, a concise operations assistant. Reply in {target_language}. Return only valid JSON with keys answer, suggestedCommand, and suggestionReason. answer must be concise and actionable. suggestedCommand must be a single non-destructive inspection command. If unsure, return the safest readonly inspection command available. Do not wrap the JSON in markdown fences."
    )
}

#[allow(dead_code)]
fn build_ai_context_message(
    project: &ProjectConfigData,
    server: &ServerConfigData,
    context: &Map<String, Value>,
) -> String {
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
        "Current project context\nProject: {}\nServer: {}@{}:{} ({})\nRoot path: {}\nDatabases: {}\n\nRecent terminal:\n{}\n\nRecent logs:\n{}",
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

#[allow(dead_code)]
fn build_ai_turn_request(locale: &str, prompt: Option<&str>) -> String {
    match prompt.map(str::trim).filter(|value| !value.is_empty()) {
        Some(user_prompt) => format!(
            "{}\n\n{}",
            localized_text(
                locale,
                "继续沿着这条链路排查。以下是用户的追加问题：",
                "Continue the same investigation. Here is the user's follow-up question:",
            ),
            user_prompt
        ),
        None => localized_text(
            locale,
            "请先做一轮综合排查：总结最可能的问题、关键证据，以及下一步最安全的检查命令。",
            "Start a fresh triage pass. Summarize the most likely issue, the strongest evidence, and the safest next inspection command.",
        ),
    }
}

fn parse_ai_history(history: Option<&Value>) -> Vec<ProviderChatMessage> {
    let mut messages = history
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let payload = item.as_object()?;
                    let role = match payload.get("speaker").and_then(Value::as_str)? {
                        "user" => "user",
                        "assistant" => "assistant",
                        _ => return None,
                    };
                    let content = payload.get("content").and_then(Value::as_str)?.trim();
                    if content.is_empty() {
                        return None;
                    }

                    Some(ProviderChatMessage {
                        role: role.to_string(),
                        content: content.to_string(),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if messages.len() > 8 {
        messages = messages.split_off(messages.len() - 8);
    }

    messages
}

#[allow(dead_code)]
fn finalize_ai_suggestion(
    project: &ProjectConfigData,
    server: &ServerConfigData,
    context: &Map<String, Value>,
    locale: &str,
    suggested_command: Option<String>,
    suggestion_reason: Option<String>,
) -> Value {
    let fallback = build_ai_suggestion(project, server, context, locale);
    let Some(command) = suggested_command
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return fallback;
    };

    let (risk, blocked) = classify_command_risk(&command);
    if blocked {
        return fallback;
    }

    json!({
        "id": create_id("cmd"),
        "command": command,
        "reason": suggestion_reason
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| localized_text(
                locale,
                "先执行一条安全的只读检查，再根据结果继续缩小范围。",
                "Run one safe readonly inspection command, then narrow the scope with the result.",
            )),
        "risk": risk,
        "requiresConfirmation": true,
        "blocked": false
    })
}

fn build_ai_system_prompt_v2(locale: &str) -> String {
    let target_language = if locale == "zh-CN" {
        "Simplified Chinese"
    } else {
        "English"
    };

    format!(
        "You are Proj-Eye, a concise operations assistant. Reply in {target_language}. Return only valid JSON with keys answer, suggestedCommand, and suggestionReason. answer must be concise, evidence-based, and under 4 sentences. If the context contains a non-empty 'Latest confirmed command output' section, treat it as the primary evidence and do not claim the result is missing. suggestedCommand must be exactly one non-destructive readonly shell command line. Do not chain commands with &&, ;, or ||. Avoid multi-step bundles. At most one pipe is allowed only when truncation or filtering is necessary. Prefer the smallest inspection command that resolves the next uncertainty. Do not wrap the JSON in markdown fences."
    )
}

fn build_ai_context_message_v2(
    project: &ProjectConfigData,
    server: &ServerConfigData,
    context: &Map<String, Value>,
) -> String {
    let join_lines = |key: &str| {
        context
            .get(key)
            .and_then(Value::as_array)
            .map(|lines| {
                lines
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default()
    };
    let command_output_lines = join_lines("commandOutputSnippet");
    let terminal_lines = join_lines("terminalSnippet");
    let log_lines = join_lines("logSnippet");
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
        "Current project context\nProject: {}\nServer: {}@{}:{} ({})\nRoot path: {}\nDatabases: {}\n\nLatest confirmed command output:\n{}\n\nRecent terminal:\n{}\n\nRecent logs:\n{}",
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
        if command_output_lines.is_empty() {
            "none".to_string()
        } else {
            command_output_lines
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

fn build_ai_turn_request_v2(prompt: Option<&str>) -> String {
    match prompt.map(str::trim).filter(|value| !value.is_empty()) {
        Some(user_prompt) => format!(
            "Continue the same investigation. Base the answer on the newest confirmed command output when available.\n\nUser follow-up:\n{}",
            user_prompt
        ),
        None => "Start a fresh triage pass. Summarize the most likely issue, the strongest evidence, and the next smallest safe readonly inspection command.".to_string(),
    }
}

fn finalize_ai_suggestion_v2(
    project: &ProjectConfigData,
    server: &ServerConfigData,
    context: &Map<String, Value>,
    locale: &str,
    suggested_command: Option<String>,
    suggestion_reason: Option<String>,
) -> Value {
    let fallback = build_ai_suggestion(project, server, context, locale);
    let Some(command) = suggested_command.and_then(|value| normalize_ai_suggested_command(&value)) else {
        return fallback;
    };

    let (risk, blocked) = classify_command_risk(&command);
    if blocked {
        return fallback;
    }

    json!({
        "id": create_id("cmd"),
        "command": command,
        "reason": suggestion_reason
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| localized_text(
                locale,
                "先执行一条安全的只读检查，再根据结果继续缩小范围。",
                "Run one safe readonly inspection command, then narrow the scope with the result.",
            )),
        "risk": risk,
        "requiresConfirmation": true,
        "blocked": false
    })
}

fn build_ai_round_payload(
    app: &AppHandle,
    project_id: &str,
    context: Value,
    history: Option<Value>,
    prompt: Option<&str>,
    event_kind: &str,
) -> Result<Value, String> {
    let (config, project, server) = load_project_context(app, project_id)?;
    let context_object = object(&context)?;
    let locale = resolve_ui_locale(&config);
    let provider = resolve_provider(&config)?;
    let system_prompt = build_ai_system_prompt_v2(locale);
    let trace_id = context_object
        .get("traceId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let mut messages = vec![ProviderChatMessage {
        role: "user".to_string(),
        content: build_ai_context_message_v2(&project, &server, context_object),
    }];
    messages.extend(parse_ai_history(history.as_ref()));
    messages.push(ProviderChatMessage {
        role: "user".to_string(),
        content: build_ai_turn_request_v2(prompt),
    });

    let _ = diagnostics::append_timing_log(
        app,
        json!({
            "source": "backend",
            "traceId": if trace_id.is_empty() { Value::Null } else { json!(trace_id) },
            "stage": "provider_request_start",
            "projectId": project_id,
            "eventKind": event_kind,
            "providerName": provider.name,
            "providerType": provider.provider_type,
            "model": provider.model,
            "historyCount": messages.len().saturating_sub(2),
            "terminalLines": context_object.get("terminalSnippet").and_then(Value::as_array).map(|items| items.len()).unwrap_or(0),
            "commandOutputLines": context_object.get("commandOutputSnippet").and_then(Value::as_array).map(|items| items.len()).unwrap_or(0),
            "logLines": context_object.get("logSnippet").and_then(Value::as_array).map(|items| items.len()).unwrap_or(0)
        }),
    );

    let provider_request_started_at = Instant::now();
    let raw_response = match request_provider_chat(&provider, &system_prompt, &messages) {
        Ok(response) => {
            let _ = diagnostics::append_timing_log(
                app,
                json!({
                    "source": "backend",
                    "traceId": if trace_id.is_empty() { Value::Null } else { json!(trace_id) },
                    "stage": "provider_request_done",
                    "projectId": project_id,
                    "eventKind": event_kind,
                    "providerName": provider.name,
                    "providerType": provider.provider_type,
                    "model": provider.model,
                    "durationMs": provider_request_started_at.elapsed().as_millis() as u64,
                    "responseChars": response.len()
                }),
            );
            response
        }
        Err(error) => {
            let _ = diagnostics::append_timing_log(
                app,
                json!({
                    "source": "backend",
                    "traceId": if trace_id.is_empty() { Value::Null } else { json!(trace_id) },
                    "stage": "provider_request_error",
                    "projectId": project_id,
                    "eventKind": event_kind,
                    "providerName": provider.name,
                    "providerType": provider.provider_type,
                    "model": provider.model,
                    "durationMs": provider_request_started_at.elapsed().as_millis() as u64,
                    "error": error
                }),
            );
            return Err(error);
        }
    };
    let parsed = parse_ai_model_reply(&raw_response);
    let assistant_content = parsed
        .as_ref()
        .map(|reply| reply.answer.trim().to_string())
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| {
            let trimmed = raw_response.trim();
            if trimmed.is_empty() {
                localized_text(
                    locale,
                    "当前没有拿到可用分析结果，先执行建议命令补一轮信号。",
                    "No usable analysis came back yet. Run the suggested inspection command first and retry.",
                )
            } else {
                trimmed.to_string()
            }
        });
    let suggestion = finalize_ai_suggestion_v2(
        &project,
        &server,
        context_object,
        locale,
        parsed.as_ref().and_then(|reply| reply.suggested_command.clone()),
        parsed.as_ref().and_then(|reply| reply.suggestion_reason.clone()),
    );

    let payload = json!({
        "messages": [
            {
                "id": create_id("msg"),
                "speaker": "assistant",
                "content": assistant_content,
                "createdAt": now_ms()
            }
        ],
        "suggestion": suggestion
    });

    emit_runtime_event(
        app,
        AI_EVENT,
        json!({
            "kind": event_kind,
            "projectId": project_id,
            "payload": payload
        }),
    );

    Ok(payload)
}

fn execute_command_for_session(
    _app: &AppHandle,
    session_id: &str,
    command: &str,
) -> Result<Value, String> {
    let updated = {
        let mut state = runtime_state()
            .lock()
            .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
        let RuntimeState {
            sessions,
            interactive_shells,
        } = &mut *state;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| "Terminal session not found.".to_string())?;
        let shell = interactive_shells
            .get_mut(session_id)
            .ok_or_else(|| "Interactive shell is not available for this session.".to_string())?;

        session.connection_state = "ready".to_string();

        let mut writer = shell
            .writer
            .lock()
            .map_err(|_| "Interactive shell writer lock was poisoned.".to_string())?;

        writer
            .write_all(format!("{command}\r").as_bytes())
            .map_err(|error| format!("Unable to write to the interactive shell: {error}"))?;
        writer
            .flush()
            .map_err(|error| format!("Unable to flush the interactive shell input: {error}"))?;

        session.clone()
    };

    emit_terminal_session(_app, &updated);

    Ok(json!({
        "session": session_to_value(&updated),
        "lines": []
    }))
}

pub fn connect_project(app: &AppHandle, project_id: &str) -> Result<Value, String> {
    let (_, project, server) = load_project_context(app, project_id)?;
    let tab_title = project.name.clone();

    let session = spawn_interactive_ssh_session(
        app,
        RuntimeSession {
        id: create_id("session"),
        project_id: project.id.clone(),
        tab_id: create_id("tab"),
        title: tab_title,
        cwd: project.root_path.clone(),
        connection_state: "ready".to_string(),
        transcript: session_intro_transcript(&project, &server, &project.root_path, true, false),
        open_line: false,
        started_at: now_ms(),
        },
        &server,
    )?;

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
        "tab": tab_to_value(&session, "interactive-shell", true),
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

    let title = if current_count == 0 {
        project.name.clone()
    } else {
        format!("{} {}", project.name, current_count + 1)
    };

    let session = spawn_interactive_ssh_session(
        app,
        RuntimeSession {
        id: create_id("session"),
        project_id: project.id.clone(),
        tab_id: create_id("tab"),
        title: title.clone(),
        cwd: project.root_path.clone(),
        connection_state: "ready".to_string(),
        transcript: session_intro_transcript(&project, &server, &project.root_path, false, false),
        open_line: false,
        started_at: now_ms(),
        },
        &server,
    )?;

    let payload = json!({
        "session": session_to_value(&session),
        "tab": tab_to_value(&session, "interactive-shell", true)
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

pub fn write_session_input(_app: &AppHandle, session_id: &str, input: &str) -> Result<(), String> {
    if input.is_empty() {
        return Ok(());
    }

    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
    let shell = state
        .interactive_shells
        .get_mut(session_id)
        .ok_or_else(|| "Interactive shell is not available for this session.".to_string())?;

    let mut writer = shell
        .writer
        .lock()
        .map_err(|_| "Interactive shell writer lock was poisoned.".to_string())?;

    writer
        .write_all(input.as_bytes())
        .map_err(|error| format!("Unable to write terminal input: {error}"))?;
    writer
        .flush()
        .map_err(|error| format!("Unable to flush terminal input: {error}"))?;

    Ok(())
}

pub fn resize_session(_app: &AppHandle, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let mut state = runtime_state()
        .lock()
        .map_err(|_| "Runtime state lock was poisoned.".to_string())?;
    let shell = state
        .interactive_shells
        .get_mut(session_id)
        .ok_or_else(|| "Interactive shell is not available for this session.".to_string())?;

    shell
        .master
        .resize(PtySize {
            rows: rows.max(2),
            cols: cols.max(20),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("Unable to resize the terminal PTY: {error}"))?;

    Ok(())
}

pub fn close_session(_app: &AppHandle, session_id: &str) -> Result<Value, String> {
    let session = remove_session(session_id)?
        .ok_or_else(|| "Terminal session not found.".to_string())?;
    cleanup_interactive_shell(session_id);

    Ok(json!({
        "sessionId": session.id,
        "tabId": session.tab_id,
        "projectId": session.project_id
    }))
}

pub fn reconnect_session(app: &AppHandle, session_id: &str) -> Result<Value, String> {
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

    let (_config, project, server) = load_project_context(app, &snapshot.project_id)?;
    cleanup_interactive_shell(session_id);
    let _ = remove_session(session_id)?;

    let reconnect_cwd = if snapshot.cwd.trim().is_empty() {
        project.root_path.clone()
    } else {
        snapshot.cwd.clone()
    };

    let session = spawn_interactive_ssh_session(
        app,
        RuntimeSession {
            id: create_id("session"),
            project_id: snapshot.project_id.clone(),
            tab_id: snapshot.tab_id.clone(),
            title: snapshot.title.clone(),
            cwd: reconnect_cwd.clone(),
            connection_state: "ready".to_string(),
            transcript: session_intro_transcript(&project, &server, &reconnect_cwd, false, true),
            open_line: false,
            started_at: now_ms(),
        },
        &server,
    )?;

    Ok(json!({
        "session": session_to_value(&session),
        "tab": tab_to_value(&session, "interactive-shell", true)
    }))
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
    build_ai_round_payload(app, project_id, context, None, None, "analysis")
}

pub fn send_ai_followup(
    app: &AppHandle,
    project_id: &str,
    context: Value,
    history: Value,
    prompt: &str,
) -> Result<Value, String> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err("AI follow-up prompt cannot be empty.".to_string());
    }

    build_ai_round_payload(
        app,
        project_id,
        context,
        Some(history),
        Some(trimmed),
        "follow-up",
    )
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

    let response = request_provider_chat(
        &provider,
        "You are Proj-Eye. Reply with a short readiness acknowledgement for an operations assistant health check.",
        &[ProviderChatMessage {
            role: "user".to_string(),
            content: "Reply with a short readiness acknowledgement for an operations assistant health check.".to_string(),
        }],
    )?;

    Ok(json!({
        "ok": true,
        "message": format!("{} responded successfully: {}", provider.name, response.trim())
    }))
}
