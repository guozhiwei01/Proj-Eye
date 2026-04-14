# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install frontend dependencies
npm install

# Run Vite dev server (frontend only, no native bridge — uses local-backend mock)
npm run dev

# Type-check and bundle frontend
npm run build

# Full desktop dev (macOS/Linux — requires Rust toolchain + Tauri CLI)
npx tauri dev

# Build desktop binary (macOS/Linux)
npx tauri build --debug --no-bundle

# Rust checks (macOS/Linux — run from src-tauri/)
cd src-tauri && cargo check
cd src-tauri && cargo clippy -- -D warnings
```

On **Windows**, use the wrapped npm scripts instead of calling Cargo/Tauri directly — they bootstrap `vcvars64.bat` via PowerShell helpers in `scripts/`:

```bash
npm run tauri:dev:windows
npm run tauri:build:windows
npm run cargo:check:windows
npm run cargo:clippy:windows
```

There are no automated tests (no vitest, jest, or cargo test setup). Correctness checks are `npm run build` (TypeScript) and `cargo clippy` (Rust).

## Architecture

Proj-Eye is a **Tauri 2** desktop app: a React 19 / TypeScript frontend communicates with a Rust backend through Tauri's `invoke` IPC bridge.

### Frontend (`src/`)

| Layer | Key files | Purpose |
|---|---|---|
| Types | `types/models.ts` | Single source of truth for all domain types and enums |
| Backend adapter | `lib/backend.ts` | Wraps every `invoke` call; auto-falls back to `local-backend` when Tauri is unavailable |
| Local backend | `lib/local-backend.ts` | In-memory mock mirroring the Tauri API — powers browser-only `npm run dev` |
| Runtime events | `lib/runtime-events.ts` | Listens to four Tauri event channels with ref-counted subscribers |
| State | `store/app.ts`, `workspace.ts`, `ai.ts`, `panels.ts` | Zustand v5 stores; `app.ts` is the root and owns bootstrap |
| i18n | `lib/i18n.ts` | Flat key-value translations for `zh-CN` / `en-US` via `useI18n()` hook |
| Theming | `themes/*.css` | CSS variable files per theme (`teal`, `amber`, `blue`) — Tailwind CSS v4 |

**Backend mode lock**: `backend.ts` tracks a module-level `backendMode` (`"unknown"` → `"tauri"` | `"local"`). The first successful `invoke` locks to `"tauri"`; any failure on first call falls back to `"local"` permanently. After locking to `"tauri"`, subsequent failures propagate (no further fallback).

**Config mirroring**: every Tauri write operation silently calls `syncLocalConfigFromTauri()` to keep the in-memory local-backend replica in sync.

**Styling**: Tailwind CSS v4 with 100% CSS-variable theming (`var(--text0)`, `var(--accent)`, etc.). No hardcoded colors.

### Bootstrap flow

1. `ensureRuntimeListeners()` — binds Tauri event listeners (session, logs, terminal, terminal-stream)
2. `initialize()` → `app_bootstrap` command → returns config + secure status + health
3. If secure strategy is `"fallback_vault"` and vault is locked, `VaultGate` blocks until unlocked
4. Stores hydrated with config bundle; main `Home` view renders

### Rust backend (`src-tauri/src/`)

| File | Purpose |
|---|---|
| `commands.rs` | All `#[tauri::command]` handlers — thin wrappers delegating to `store/` modules |
| `store/config.rs` | JSON config persistence (`~AppData/proj-eye/config/config.json`); CRUD for servers, databases, projects, providers, settings |
| `store/secure.rs` | Credential store: prefers OS keyring (`com.projeye.desktop.credentials`); falls back to AES-256-GCM encrypted vault with PBKDF2-SHA256 at 200k iterations |
| `store/runtime.rs` | Live operations: SSH via system `ssh` + `portable-pty`, MySQL/Redis queries, HTTP AI provider calls, log refresh |
| `store/diagnostics.rs` | AI timing log persistence (JSON Lines at `~AppData/proj-eye/logs/ai-timing.log`) |

**Rust conventions**:
- All public functions return `Result<T, String>` — no custom error types. Errors are human-readable strings for the IPC boundary.
- Global state uses `OnceLock<Mutex<RuntimeState>>` with explicit lock-poisoning checks.
- All I/O uses blocking APIs (`reqwest::blocking`, `mysql`, `redis` sync).

**Credential flow**: config.json never stores secrets. Entities hold a `credentialRef` string (e.g. `"cred-<uuid>"`); the actual secret lives in the OS keyring or encrypted vault.

### Runtime events (backend → frontend)

| Channel | Payload kinds |
|---|---|
| `proj-eye://runtime/session` | `connected`, `tab-opened` |
| `proj-eye://runtime/logs` | `seeded`, `appended` |
| `proj-eye://runtime/terminal` | `updated` |
| `proj-eye://runtime/terminal-stream` | `chunk` (raw terminal data) |

### Data model

```
Server → Project (serverId) → LogSources, DatabaseIds
DatabaseResource (standalone, referenced by Project.databaseIds)
ProviderConfig (standalone, referenced by AppSettings.defaultAiProviderId)
```

Config is one flat `AppConfigBundle` JSON file. The frontend receives it on bootstrap and after every mutating command.

### Views

Three top-level views (`AppView`): **Workspace** (SSH terminal + logs + database + AI overlay), **Manage** (CRUD for servers, databases, projects, providers), **Settings**. Navigation via `useAppStore`.

## Important behaviors

- **Log source priority**: only the first entry in `project.logSources[]` is used; the rest are ignored.
- **SSH password automation**: runtime auto-detects `password:` prompts and injects the credential once, then clears it from memory.
- **CWD markers**: runtime uses `__PROJ_EYE_CWD__` / `__PROJ_EYE_EXIT__` sentinel strings in terminal transcripts for internal state tracking.
- **AI response limit**: `AI_MAX_RESPONSE_TOKENS = 320`. Supports OpenAI, Anthropic, Gemini, Ollama, and custom providers.
- **PostgreSQL**: intentionally disabled for query execution in current MVP — `database_run_query` returns an unsupported notice.
- **MySQL**: read-only mode enforced by default. **Redis**: whitelist of safe commands only (GET, HGETALL, KEYS, etc.).
- **Server deletion cascade**: deleting a server closes all workspace tabs for projects on that server.
- **Tauri window**: 1280×860 default, 1024×720 minimum, centered, no custom decorations. No CSP configured.

## i18n

All user-visible strings live in `src/lib/i18n.ts`. Use `useI18n()` → `t(key, params?)`. Interpolation: `{paramName}` placeholders. Both `zh-CN` and `en-US` locales must be updated together.

## Product spec

The initial product document is `document-version1.md` (written in Chinese).
