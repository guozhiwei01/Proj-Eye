import {
  SecureStoreStrategy,
  type CredentialSecretInput,
  type SecureStoreStatus,
} from "../types/models";

interface EncryptedVaultPayload {
  version: 1;
  salt: string;
  iv: string;
  cipherText: string;
}

interface VaultRecord extends CredentialSecretInput {
  updatedAt: number;
}

interface VaultData {
  records: Record<string, VaultRecord>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VAULT_KEY = "proj-eye:vault:v1";
const ITERATIONS = 200_000;

let unlockedVault: VaultData | null = null;
let unlockedPassword: string | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readPayload(): EncryptedVaultPayload | null {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EncryptedVaultPayload;
  } catch {
    return null;
  }
}

function writePayload(payload: EncryptedVaultPayload): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(payload));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptVault(data: VaultData, password: string): Promise<EncryptedVaultPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data)),
  );

  return {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipherText: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptVault(payload: EncryptedVaultPayload, password: string): Promise<VaultData> {
  const key = await deriveKey(password, base64ToBytes(payload.salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.cipherText),
  );

  return JSON.parse(decoder.decode(new Uint8Array(decrypted))) as VaultData;
}

async function persistUnlockedVault(): Promise<void> {
  if (!unlockedVault || !unlockedPassword) {
    throw new Error("Vault is locked.");
  }

  const payload = await encryptVault(unlockedVault, unlockedPassword);
  writePayload(payload);
}

export function getSecureStoreStatus(): SecureStoreStatus {
  const payload = readPayload();
  const initialized = Boolean(payload);
  const locked = initialized && !unlockedVault;

  return {
    strategy: SecureStoreStrategy.FallbackVault,
    initialized,
    locked,
    keyringAvailable: false,
    message: initialized
      ? locked
        ? "Vault is encrypted. Unlock it with the master password."
        : "Fallback vault is unlocked."
      : "Create a master password to initialize the fallback vault.",
  };
}

export async function initializeVault(password: string): Promise<SecureStoreStatus> {
  if (!password.trim()) {
    throw new Error("Master password cannot be empty.");
  }

  if (readPayload()) {
    throw new Error("Vault has already been initialized.");
  }

  unlockedVault = { records: {} };
  unlockedPassword = password;
  await persistUnlockedVault();
  return getSecureStoreStatus();
}

export async function unlockVault(password: string): Promise<SecureStoreStatus> {
  const payload = readPayload();
  if (!payload) {
    throw new Error("Vault is not initialized yet.");
  }

  try {
    unlockedVault = await decryptVault(payload, password);
    unlockedPassword = password;
    return getSecureStoreStatus();
  } catch {
    unlockedVault = null;
    unlockedPassword = null;
    throw new Error("Master password is incorrect.");
  }
}

export function lockVault(): SecureStoreStatus {
  unlockedVault = null;
  unlockedPassword = null;
  return getSecureStoreStatus();
}

export async function saveCredential(record: CredentialSecretInput): Promise<void> {
  if (!unlockedVault) {
    throw new Error("Unlock the vault before saving credentials.");
  }

  unlockedVault.records[record.ref] = {
    ...record,
    updatedAt: Date.now(),
  };
  await persistUnlockedVault();
}

export async function deleteCredential(ref: string): Promise<void> {
  if (!unlockedVault) {
    throw new Error("Unlock the vault before removing credentials.");
  }

  delete unlockedVault.records[ref];
  await persistUnlockedVault();
}

export function hasCredential(ref?: string | null): boolean {
  if (!ref || !unlockedVault) {
    return false;
  }

  return Boolean(unlockedVault.records[ref]);
}

export function getCredential(ref?: string | null): string | null {
  if (!ref || !unlockedVault) {
    return null;
  }

  return unlockedVault.records[ref]?.secret ?? null;
}
