use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use keyring::{Entry, Error as KeyringError};
use pbkdf2::pbkdf2_hmac;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use tauri::{AppHandle, Manager};

const ITERATIONS: u32 = 200_000;
const KEYRING_SERVICE: &str = "com.projeye.desktop.credentials";
const KEYRING_PROBE_REF: &str = "__proj_eye_probe__";

#[derive(Default)]
struct SecureRuntime {
    unlocked: Option<UnlockedVault>,
}

impl SecureRuntime {
    const fn new() -> Self {
        Self { unlocked: None }
    }
}

struct UnlockedVault {
    password: String,
    data: VaultData,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureStatus {
    pub strategy: &'static str,
    pub initialized: bool,
    pub locked: bool,
    pub keyring_available: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct VaultData {
    records: HashMap<String, VaultRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultRecord {
    kind: String,
    label: String,
    secret: String,
    updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultFile {
    version: u8,
    salt: String,
    iv: String,
    cipher_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyringSecretPayload {
    kind: String,
    label: String,
    secret: String,
    updated_at: u64,
}

static SECURE_RUNTIME: Mutex<SecureRuntime> = Mutex::new(SecureRuntime::new());

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn secure_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;
    let dir = base.join("secure");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Unable to create secure directory {:?}: {error}", dir))?;
    Ok(dir)
}

fn vault_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(secure_dir(app)?.join("fallback_vault.json"))
}

fn derive_key(password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0_u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, ITERATIONS, &mut key);
    key
}

fn encrypt_vault(data: &VaultData, password: &str) -> Result<VaultFile, String> {
    let mut salt = [0_u8; 16];
    let mut iv = [0_u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut iv);

    let key = derive_key(password, &salt);
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|error| format!("Cipher init failed: {error}"))?;
    let serialized =
        serde_json::to_vec(data).map_err(|error| format!("Vault serialize failed: {error}"))?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&iv), serialized.as_ref())
        .map_err(|_| "Unable to encrypt secure vault.".to_string())?;

    Ok(VaultFile {
        version: 1,
        salt: BASE64.encode(salt),
        iv: BASE64.encode(iv),
        cipher_text: BASE64.encode(encrypted),
    })
}

fn decrypt_vault(file: &VaultFile, password: &str) -> Result<VaultData, String> {
    let salt = BASE64
        .decode(&file.salt)
        .map_err(|error| format!("Vault salt decode failed: {error}"))?;
    let iv = BASE64
        .decode(&file.iv)
        .map_err(|error| format!("Vault iv decode failed: {error}"))?;
    let cipher_text = BASE64
        .decode(&file.cipher_text)
        .map_err(|error| format!("Vault payload decode failed: {error}"))?;

    let key = derive_key(password, &salt);
    let cipher =
        Aes256Gcm::new_from_slice(&key).map_err(|error| format!("Cipher init failed: {error}"))?;
    let decrypted = cipher
        .decrypt(Nonce::from_slice(&iv), cipher_text.as_ref())
        .map_err(|_| "Master password is incorrect.".to_string())?;

    serde_json::from_slice(&decrypted).map_err(|error| format!("Vault payload is invalid: {error}"))
}

fn read_vault_file(app: &AppHandle) -> Result<Option<VaultFile>, String> {
    let path = vault_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read secure vault {:?}: {error}", path))?;
    let vault = serde_json::from_str(&contents)
        .map_err(|error| format!("Secure vault file is invalid JSON: {error}"))?;
    Ok(Some(vault))
}

fn write_vault_file(app: &AppHandle, vault: &VaultFile) -> Result<(), String> {
    let path = vault_path(app)?;
    let serialized = serde_json::to_string_pretty(vault)
        .map_err(|error| format!("Unable to serialize secure vault: {error}"))?;
    fs::write(&path, serialized)
        .map_err(|error| format!("Unable to write secure vault {:?}: {error}", path))?;
    Ok(())
}

fn persist_unlocked(app: &AppHandle, runtime: &UnlockedVault) -> Result<(), String> {
    let encrypted = encrypt_vault(&runtime.data, &runtime.password)?;
    write_vault_file(app, &encrypted)
}

fn keyring_entry(reference: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, reference)
        .map_err(|error| format!("Unable to create keyring entry for '{reference}': {error}"))
}

fn keyring_available() -> bool {
    let Ok(entry) = keyring_entry(KEYRING_PROBE_REF) else {
        return false;
    };

    matches!(entry.get_password(), Ok(_) | Err(KeyringError::NoEntry))
}

fn inspect_keyring(reference: &str) -> Result<bool, String> {
    match keyring_entry(reference)?.get_password() {
        Ok(_) => Ok(true),
        Err(KeyringError::NoEntry) => Ok(false),
        Err(error) => Err(format!(
            "Unable to read '{reference}' from the system keyring: {error}"
        )),
    }
}

fn read_secret_from_keyring(reference: &str) -> Result<Option<String>, String> {
    match keyring_entry(reference)?.get_password() {
        Ok(payload) => {
            if let Ok(parsed) = serde_json::from_str::<KeyringSecretPayload>(&payload) {
                Ok(Some(parsed.secret))
            } else {
                Ok(Some(payload))
            }
        }
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Unable to read '{reference}' from the system keyring: {error}"
        )),
    }
}

fn save_secret_to_keyring(reference: &str, kind: &str, label: &str, secret: &str) -> Result<(), String> {
    let payload = serde_json::to_string(&KeyringSecretPayload {
        kind: kind.to_string(),
        label: label.to_string(),
        secret: secret.to_string(),
        updated_at: now_ms(),
    })
    .map_err(|error| format!("Unable to serialize keyring secret payload: {error}"))?;

    keyring_entry(reference)?
        .set_password(&payload)
        .map_err(|error| format!("Unable to persist '{reference}' in the system keyring: {error}"))
}

fn delete_secret_from_keyring(reference: &str) -> Result<(), String> {
    match keyring_entry(reference)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Unable to delete '{reference}' from the system keyring: {error}"
        )),
    }
}

fn inspect_fallback(reference: &str) -> Result<bool, String> {
    let runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    Ok(runtime
        .unlocked
        .as_ref()
        .map(|vault| vault.data.records.contains_key(reference))
        .unwrap_or(false))
}

fn read_secret_from_fallback(reference: &str) -> Result<Option<String>, String> {
    let runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    Ok(runtime
        .unlocked
        .as_ref()
        .and_then(|vault| vault.data.records.get(reference))
        .map(|record| record.secret.clone()))
}

fn save_secret_to_fallback(
    app: &AppHandle,
    reference: &str,
    kind: &str,
    label: &str,
    secret: &str,
) -> Result<(), String> {
    let mut runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    let unlocked = runtime
        .unlocked
        .as_mut()
        .ok_or_else(|| "Unlock the fallback vault before saving credentials.".to_string())?;

    unlocked.data.records.insert(
        reference.to_string(),
        VaultRecord {
            kind: kind.to_string(),
            label: label.to_string(),
            secret: secret.to_string(),
            updated_at: now_ms(),
        },
    );
    persist_unlocked(app, unlocked)
}

fn delete_secret_from_fallback(app: &AppHandle, reference: &str) -> Result<(), String> {
    let mut runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    let Some(unlocked) = runtime.unlocked.as_mut() else {
        return Ok(());
    };

    unlocked.data.records.remove(reference);
    persist_unlocked(app, unlocked)
}

pub fn status(app: &AppHandle) -> Result<SecureStatus, String> {
    let fallback_initialized = read_vault_file(app)?.is_some();

    if keyring_available() {
        let message = if fallback_initialized {
            "System keyring is active. The fallback vault remains available if native storage becomes unavailable.".to_string()
        } else {
            "System keyring is active. Secrets are stored in the OS credential manager.".to_string()
        };

        return Ok(SecureStatus {
            strategy: "keyring",
            initialized: true,
            locked: false,
            keyring_available: true,
            message,
        });
    }

    let runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    let locked = fallback_initialized && runtime.unlocked.is_none();

    let message = if fallback_initialized {
        if locked {
            "System keyring is unavailable. Unlock the fallback vault with the master password.".to_string()
        } else {
            "System keyring is unavailable. The fallback vault is unlocked.".to_string()
        }
    } else {
        "System keyring is unavailable. Create a master password to initialize the fallback vault.".to_string()
    };

    Ok(SecureStatus {
        strategy: "fallback_vault",
        initialized: fallback_initialized,
        locked,
        keyring_available: false,
        message,
    })
}

pub fn initialize_vault(app: &AppHandle, password: &str) -> Result<SecureStatus, String> {
    if keyring_available() {
        return status(app);
    }

    if password.trim().is_empty() {
        return Err("Master password cannot be empty.".to_string());
    }
    if read_vault_file(app)?.is_some() {
        return Err("Fallback vault is already initialized.".to_string());
    }

    let unlocked = UnlockedVault {
        password: password.to_string(),
        data: VaultData::default(),
    };
    persist_unlocked(app, &unlocked)?;

    let mut runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    runtime.unlocked = Some(unlocked);
    drop(runtime);
    status(app)
}

pub fn unlock_vault(app: &AppHandle, password: &str) -> Result<SecureStatus, String> {
    if keyring_available() {
        return status(app);
    }

    let file = read_vault_file(app)?
        .ok_or_else(|| "Fallback vault is not initialized yet.".to_string())?;
    let data = decrypt_vault(&file, password)?;
    let mut runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    runtime.unlocked = Some(UnlockedVault {
        password: password.to_string(),
        data,
    });
    drop(runtime);
    status(app)
}

pub fn lock_vault(app: &AppHandle) -> Result<SecureStatus, String> {
    if keyring_available() {
        return status(app);
    }

    let mut runtime = SECURE_RUNTIME
        .lock()
        .map_err(|_| "Secure runtime lock was poisoned.".to_string())?;
    runtime.unlocked = None;
    drop(runtime);
    status(app)
}

pub fn inspect_credential(reference: Option<String>) -> Result<bool, String> {
    let Some(reference) = reference else {
        return Ok(false);
    };

    if keyring_available() {
        match inspect_keyring(&reference) {
            Ok(true) => return Ok(true),
            Ok(false) => {}
            Err(_) => {}
        }
    }

    inspect_fallback(&reference)
}

pub fn save_secret(
    app: &AppHandle,
    reference: &str,
    kind: &str,
    label: &str,
    secret: &str,
) -> Result<(), String> {
    if keyring_available() {
        match save_secret_to_keyring(reference, kind, label, secret) {
            Ok(()) => return Ok(()),
            Err(keyring_error) => {
                if read_vault_file(app)?.is_some() {
                    save_secret_to_fallback(app, reference, kind, label, secret)?;
                    return Ok(());
                }
                return Err(format!(
                    "{keyring_error} Initialize or unlock the fallback vault to store this secret locally."
                ));
            }
        }
    }

    save_secret_to_fallback(app, reference, kind, label, secret)
}

pub fn delete_secret(app: &AppHandle, reference: &str) -> Result<(), String> {
    if keyring_available() {
        let _ = delete_secret_from_keyring(reference);
    }

    delete_secret_from_fallback(app, reference)
}

pub fn read_secret(reference: Option<String>) -> Result<Option<String>, String> {
    let Some(reference) = reference else {
        return Ok(None);
    };

    if keyring_available() {
        match read_secret_from_keyring(&reference) {
            Ok(Some(secret)) => return Ok(Some(secret)),
            Ok(None) => {}
            Err(_) => {}
        }
    }

    read_secret_from_fallback(&reference)
}
