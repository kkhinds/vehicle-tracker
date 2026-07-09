# Vehicle Tracker (V2) — household vehicle management

Electron desktop app (v2.1.2) tracking fuel, maintenance, service schedules, insurance, tires, fluids, expenses, documents, and notes per vehicle, plus a Help page. Successor to the old "D-Max Tracker" — the old `E:\AI Projects\Vehicle App` folder is legacy, do not touch it.

## Commands (use npm.cmd in PowerShell)
- `npm run dev` — hot-reload dev; `npm run dev:debug` adds remote debugging on port 9222
- `npm run dist:win` — icon + build + NSIS installer into `dist/`
- `npm run icon` — regenerate `resources/icon.ico` from `resources/logo.svg`

## Stack
Electron 31 + electron-vite 2 + React 18 (HashRouter, 13 pages), Radix UI + Tailwind, react-hook-form + zod, recharts. **Database: sql.js** (in-memory SQLite persisted with synchronous `fs.writeFileSync` after every mutation) at `%AppData%\Roaming\vehicle-tracker\dmax-tracker.db` — yes, the DB filename still carries the legacy "dmax" name; renaming it requires a migration path for existing installs.

## Layout
- `electron/main/` — `index.ts` (entry), `db.ts` (sql.js wrapper + migrations), `backups.ts`, `notifications.ts`, `updater.ts`, `photos.ts` (shared photo-file unlink), `handlers/` (15 domain IPC handlers), `presets/` (service intervals per drivetrain)
- `electron/preload/index.ts` — `window.api.*` bridge
- `src/` — React renderer (pages/, components/{layout,shared,ui}, hooks/, lib/)

## Release / update — ⚠ different from the other apps
- electron-builder publish target: GitHub releases on **`kkhinds/vehicle-tracker`** (the code repo itself, NOT a separate `-releases` repo).
- **No GitHub Actions workflow exists.** Releases are manual: `npm run dist:win` locally, then create the GitHub release and attach `Vehicle-Tracker-Setup-<ver>.exe`, its `.blockmap`, and `latest.yml` from `dist/`. The installer name is hyphenated because `build.win.artifactName` is pinned to `Vehicle-Tracker-Setup-${version}.${ext}` — it must match the `url:` in `latest.yml` or the updater 404s. Releases are live (latest v2.1.2); the auto-updater checks 5s after launch, auto-downloads, installs on quit.
- `/release` skill applies, but with the manual local-build path until a CI workflow is added (copying Invoice App's `release.yml` is the intended fix).

## Data & backups
- Backups: `%AppData%\Roaming\vehicle-tracker\backups\` or custom dir (`backup_dir` in settings table); `vehicle-tracker-YYYY-MM-DD-HHMMSS.db`; frequency on_open/daily/weekly/manual (default daily, keep 10). Restore takes a pre-restore snapshot first.
- Photos: `{userData}/photos/{category}/` (fuel, maintenance, insurance, documents, tires, plus note attachments); unlinked from disk with their record via `deletePhotoFiles` in the delete handlers.

## Gotchas
- `db.ts` has a custom sql.js locator that walks parent `node_modules` (worktree support) — verify boot after `npm install` or moving worktrees.
- Splash screen is forced to ≥3s (MIN_SPLASH_MS).
- Sync DB writes mean big backup/restore operations briefly block.
- Stale legacy references: `D-Max Tracker.lnk` in the root, "dmax-dev" paths in `.claude/settings.local.json`.
