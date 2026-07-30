# Vehicle Tracker (V2) — household vehicle management

Electron desktop app (v3.2.0) tracking fuel, maintenance, service schedules, insurance, tires, fluids, expenses and documents per vehicle. Successor to the old "D-Max Tracker" — the old `E:\AI Projects\Vehicle App` folder is legacy, do not touch it.

## The UI is the Driver's Log
One screen, no sidebar: hero (vehicle + odometer + next due) › lens bar (ALL / FUEL / SERVICE / TIRES / FLUIDS / INSURANCE / DOCS / STATS) › the **spine**, a date-ordered timeline with the projected "road ahead" above TODAY. Everything else opens as a bottom sheet. Design contract: `mockups/phase0-drivers-log.html` + `mockups/REDESIGN-SPEC.md` — match those tokens rather than inventing new ones. **Colour rule: chroma only for due/overdue; healthy stays neutral.** Notes were dropped in v3.0.

## Commands (use npm.cmd in PowerShell)
- `npm run dev` — hot-reload dev; `npm run dev:debug` adds remote debugging on port 9222
- `npm run dist:win` — icon + build + NSIS installer into `dist/`
- `npm run icon` — regenerate `resources/icon.ico` from `resources/logo.svg`

## Stack
Electron 31 + electron-vite 2 + React 18 (HashRouter, one route), Tailwind + a couple of Radix primitives, `date-fns`, `sonner`. Charts are hand-rolled SVG/divs, forms are plain `useState` — the old page stack (13 routes, shadcn primitives, recharts, react-hook-form, zod) was deleted in v3.1. **Database: sql.js** (in-memory SQLite persisted with synchronous `fs.writeFileSync` after every mutation) at `%AppData%\Roaming\vehicle-tracker\dmax-tracker.db` — yes, the DB filename still carries the legacy "dmax" name; renaming it requires a migration path for existing installs.

## Layout
- `electron/main/` — `index.ts` (entry), `db.ts` (sql.js wrapper + migrations), `backups.ts`, `notifications.ts`, `updater.ts`, `photos.ts` (shared photo-file unlink), `handlers/` (15 domain IPC handlers), `presets/` (service intervals per drivetrain)
- `electron/preload/index.ts` — `window.api.*` bridge
- `src/components/shell/` — the whole UI: `AppShell` (state + sheets), `Hero`, `LensBar`, `Spine`, `Sheet`, `LogForm` (add **and** edit), `ManagementSheets` (intervals, garage, backups, settings, odometer, tire set), `Stats`, `SearchSheet`, `Photos`, `HelpSheet`
- `src/styles/tokens.css` + `shell.css` — design tokens and every shell style; `src/{hooks,lib,types}`

## Release / update
- electron-builder publish target: GitHub releases on **`kkhinds/vehicle-tracker`** (the code repo itself, NOT a separate `-releases` repo).
- **Releases are automatic.** Bump `version` in package.json, push to `main`, and `.github/workflows/release.yml` builds the Windows installer on a runner and publishes it live, then tags the commit. A push that doesn't change the version stops at the `check` job. Latest release: v3.2.0. Write the user-facing notes in `release-notes/v<version>.md` before pushing the bump — the workflow attaches them; without the file the release body is empty.
- The installer name is pinned by `build.win.artifactName` to `Vehicle-Tracker-Setup-${version}.${ext}` — it must match the `url:` in `latest.yml` or the updater 404s. The auto-updater checks 5s after launch, downloads, installs on quit.
- Building locally still works (`npm run dist:win`) but needs the winCodeSign workaround — see Gotchas.

## Data & backups
- Backups: `%AppData%\Roaming\vehicle-tracker\backups\` or custom dir (`backup_dir` in settings table); `vehicle-tracker-YYYY-MM-DD-HHMMSS.db`; frequency on_open/daily/weekly/manual (default daily, keep 10). Restore takes a pre-restore snapshot first.
- Photos: `{userData}/photos/{category}/` (fuel, maintenance, insurance, documents, tires); the picker copies the file on pick, so the form unlinks anything picked then cancelled. Removing an attachment from a saved record unlinks it via `replaceChildPaths`/`deletePhotoFiles`.

## Gotchas
- `db.ts` has a custom sql.js locator that walks parent `node_modules` (worktree support) — verify boot after `npm install` or moving worktrees.
- Splash screen is forced to ≥3s (MIN_SPLASH_MS).
- Sync DB writes mean big backup/restore operations briefly block.
- Stale legacy references: `D-Max Tracker.lnk` in the root, "dmax-dev" paths in `.claude/settings.local.json`.
- Timeline rows carry display text, not the stored row — anything needing real fields (edit form, attachments) refetches the record from its own table.
- Deleting the active vehicle makes the backend pick a new current one, and that choice lives in **settings** — refresh settings, not just vehicles.
- `electron-builder` can't unpack winCodeSign on this machine: build with `win.signAndEditExecutable:false` and stamp the exe with a standalone rcedit in `afterPack`.
