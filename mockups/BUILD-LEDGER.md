# Driver's Log rebuild — progress ledger

Branch: `redesign/v3`. Target: v3.0.0. Backend (sql.js DB, IPC handlers, backups,
notifications, updater) is kept as-is; this replaces the renderer only.

Design contract: `mockups/phase0-drivers-log.html` (approved after 4-agent audit).
Port its tokens verbatim. Decisions taken at the gate:
- Note **pinning is out of scope** (would need a schema column for a nice-to-have).
- **STATS stays a separate view**, not a spine filter.

## Phases
| # | Phase | Ends with | State |
|---|---|---|---|
| 1 | Shell | tokens, fonts, hero, lens bar, theme, real vehicle/odometer from IPC | done |
| 2 | Spine | all record types on one timeline, lens filter, month grouping, road ahead | done |
| 3 | Forms | 7-type quick-log, detail sheet, validation, two-step delete | done (edit + photos deferred) |
| 4 | Management | intervals, tire set, garage, backups, settings, odometer correction | done |
| 5 | Stats | charts, quarters/years, CSV export | next |
| 6 | Ship | motion polish, a11y pass, help, v3.0.0 release | — |

## Phase 1 tasks
- [x] Branch + bundle fonts locally (`@fontsource/*`) — the old app pulled Inter
      from the Google CDN, so it had no typeface offline. Fixed as part of this.
- [x] `src/styles/tokens.css` — colours, type scale, tracking, spacing from the mockup
- [x] Theme: `data-theme` on `<html>`, persisted through the existing settings handler
- [x] `Hero` — vehicle name/plate, odometer count-up (reduced-motion safe), next-due line
- [x] `LensBar` — tablist semantics, vehicle chip, no horizontal overflow
- [x] `AppShell` — replaces the sidebar layout; lens state; wires vehicles/settings IPC
- [x] Verify in the running app at 1280 and 900 wide, both themes

## Backend work identified (later phases, small)
- Projected due-dates for road ahead (derive from driving rate) — Phase 2
- Household overview query (all vehicles, most urgent item) — Phase 4
