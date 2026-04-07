use std::env;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use keyring::Entry;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};

const KEYRING_SERVICE: &str = "com.projeye.desktop.credentials";

fn main() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let host = args.next().ok_or_else(|| "missing host".to_string())?;
    let username = args.next().ok_or_else(|| "missing username".to_string())?;
    let port = args
        .next()
        .ok_or_else(|| "missing port".to_string())?
        .parse::<u16>()
        .map_err(|error| format!("invalid port: {error}"))?;
    let credential_ref = args.next().ok_or_else(|| "missing credential ref".to_string())?;
    let remote_command = args.next().unwrap_or_else(|| "sh -lc 'pwd; exec bash --noprofile --norc -i'".to_string());

    let entry = Entry::new(KEYRING_SERVICE, &credential_ref)
        .map_err(|error| format!("keyring entry error: {error}"))?;
    let password_payload = entry
        .get_password()
        .map_err(|error| format!("keyring read error: {error}"))?;
    let password = serde_json::from_str::<serde_json::Value>(&password_payload)
        .ok()
        .and_then(|value| value.get("secret").and_then(|inner| inner.as_str()).map(ToString::to_string))
        .unwrap_or(password_payload);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 32,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("openpty error: {error}"))?;

    let mut command = CommandBuilder::new("ssh");
    command.arg("-F");
    command.arg("NUL");
    command.arg("-p");
    command.arg(port.to_string());
    command.arg("-o");
    command.arg("StrictHostKeyChecking=no");
    command.arg("-o");
    command.arg("UserKnownHostsFile=NUL");
    command.arg("-o");
    command.arg("ConnectTimeout=20");
    command.arg("-o");
    command.arg("PreferredAuthentications=password,keyboard-interactive");
    command.arg("-o");
    command.arg("PubkeyAuthentication=no");
    command.arg("-o");
    command.arg("NumberOfPasswordPrompts=1");
    command.arg("-tt");
    command.arg(format!("{username}@{host}"));
    command.arg(remote_command);

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("spawn error: {error}"))?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("reader error: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("writer error: {error}"))?;
    let writer = Arc::new(Mutex::new(writer));

    let pw = password.clone();
    let writer_for_thread = Arc::clone(&writer);
    let reader_thread = thread::spawn(move || -> Result<(), String> {
        let mut buf = [0u8; 4096];
        loop {
            let size = reader.read(&mut buf).map_err(|error| format!("read error: {error}"))?;
            if size == 0 {
                println!("[probe] eof");
                return Ok(());
            }
            let chunk = String::from_utf8_lossy(&buf[..size]).to_string();
            print!("{chunk}");
            let lower = chunk.to_ascii_lowercase();
            if lower.contains("password:") || lower.contains("password for") {
                let mut locked = writer_for_thread
                    .lock()
                    .map_err(|_| "writer mutex poisoned".to_string())?;
                locked
                    .write_all(format!("{pw}\r").as_bytes())
                    .map_err(|error| format!("password write error: {error}"))?;
                locked
                    .flush()
                    .map_err(|error| format!("password flush error: {error}"))?;
                println!("\n[probe] password sent");
            }
        }
    });

    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(15) {
        if let Some(status) = child.try_wait().map_err(|error| format!("wait error: {error}"))? {
            println!("[probe] child exited with {:?}", status.exit_code());
            break;
        }
        thread::sleep(Duration::from_millis(200));
    }

    let _ = child.kill();
    let _ = child.wait();
    let _ = reader_thread.join();
    Ok(())
}
