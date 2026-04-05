# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install frontend dependencies
npm install

# Run Vite dev server (frontend only, no native bridge)
npm run dev

# Type-check and bundle frontend
npm run build

# Full desktop dev on Windows (boots Tauri + Vite together)
npm run tauri:dev:windows

# Native-only checks (run inside src-tauri)
npm run cargo:check:windows
npm run cargo:clippy:windows

# Build debug desktop binary (no installer)
npm run tauri:build:windows
```

The `tauri:*:windows` and `cargo:*:windows` scripts wrap PowerShell helpers that bootstrap `vcvars64.bat` before invoking Cargo. Use them instead of calling `cargo` directly on Windows.

## Architecture

Proj-Eye is a **Tauri 2** desktop app: a React/TypeScript frontend communicates with a Rust backend through Tauri's `invoke` IPC bridge.

### Frontend (`src/`)

| Layer | Files | Purpose |
|---|---|---|
| Types | `src/types/models.ts` | Single source of truth for all domain types and enums |
| Backend adapter | `src/lib/backend.ts` | Wraps every `invoke` call; auto-falls back to `local-backend` when Tauri is unavailable |
| Local backend | `src/lib/local-backend.ts` | In-memory mock that mirrors the Tauri API surface — used for browser-only `npm run dev` |
| State | `src/store/app.ts`, `workspace.ts`, `ai.ts`, `panels.ts` | Zustand stores; `app.ts` is the root store and owns the bootstrap flow |
| i18n | `src/lib/i18n.ts` | Flat key-value translations for `zh-CN` and `en-US`; consumed via `useI18n()` hook |
| Theming | `src/themes/` | Per-theme CSS variable files (`teal.css`, `amber.css`, `blue.css`) |

**Backend mode detection**: `src/lib/backend.ts` tracks a module-level `backendMode` variable (`"unknown"` → `"tauri"` or `"local"`). The first successful `invoke` locks it to `"tauri"`; any failure falls back to `"local"` permanently for that session.

### Rust backend (`src-tauri/src/`)

| File | Purpose |
|---|---|
| `commands.rs` | All `#[tauri::command]` handlers — thin wrappers that delegate to `store/` modules |
| `store/config.rs` | JSON config persistence (`~AppData/proj-eye/config/config.json`); CRUD for servers, databases, projects, providers, settings |
| `store/secure.rs` | Credential store: prefers OS keyring via the `keyring` crate; falls back to AES-256-GCM encrypted vault (`~AppData/proj-eye/secure/fallback_vault.json`) derived with PBKDF2/SHA-256 at 200k iterations |
| `store/runtime.rs` | Live operations: SSH via system `ssh` binary, MySQL queries, Redis commands, HTTP AI provider calls, log refresh |

**Credential flow**: credentials are never stored in `config.json`. Each entity stores a `credentialRef` string (e.g. `"cred-<uuid>"`); the actual secret lives in the keyring or encrypted vault, keyed by that ref.

### Data model hierarchy

```
Server → Project (serverId) → LogSources, DatabaseIds
DatabaseResource (standalone, referenced by Project.databaseIds)
ProviderConfig (standalone, referenced by AppSettings.defaultAiProviderId)
```

Config is one flat `AppConfigBundle` JSON file on disk. The frontend receives it on bootstrap and after every mutating operation via `config_refresh`.

### Views

The app has three top-level views (`AppView` enum): **Workspace** (SSH terminal + logs + database + AI overlay), **Manage** (CRUD for servers, databases, projects, providers), and **Settings**. Navigation is managed by `useAppStore`.

### i18n conventions

All user-visible strings come from `src/lib/i18n.ts`. Use the `useI18n()` hook to get `t(key, params?)`. Interpolation uses `{paramName}` placeholders. Both locales must be updated together when adding new strings.

### PostgreSQL note

PostgreSQL is intentionally disabled for query execution in the current MVP. It can be saved in config (for future use) but `database_run_query` returns an unsupported notice for it.
