# Proj-Eye

Proj-Eye is a project-first AI operations desktop app built with Tauri 2, React, TypeScript, Zustand, and Tailwind CSS v4.

## Current Status

The repo now includes a real native MVP path on top of the local-first fallback:

- Project, server, database, and AI provider CRUD flows
- Native JSON config persistence
- Secure storage that prefers the system keyring and falls back to the encrypted vault when needed
- Real remote project connect and command execution through the system `ssh` client
- Remote log refresh support for `file`, `command`, `docker`, `pm2`, and `journald` sources
- Real MySQL readonly queries and Redis whitelist commands
- Native AI provider proxy calls for OpenAI, Anthropic, and Gemini
- Terminal tabs, command input, logs panel, database panel, and AI command confirmation in the workspace
- PostgreSQL reserved as a visible placeholder, not an active query driver

## Prerequisites

- Node.js 20+
- npm 10+
- Rust toolchain with Cargo
- Tauri desktop prerequisites for your OS

On Windows, make sure Visual Studio Build Tools with MSVC are installed. The repo includes helper scripts that bootstrap `vcvars64.bat` and Cargo for the current shell.

## Commands

```bash
npm install
npm run dev
npm run build
```

Native desktop checks on Windows:

```bash
npm run cargo:check:windows
npm run cargo:clippy:windows
npm run tauri:info:windows
npm run tauri:build:windows
```

Desktop development on Windows:

```bash
npm run tauri:dev:windows
```

## Product Spec

The initial product document lives in [`document-version1.md`](document-version1.md).
