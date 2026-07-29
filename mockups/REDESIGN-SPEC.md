# Vehicle Tracker redesign — spec (locked decisions + direction briefs)

Date: 2026-07-29. Owner: Kemar Hinds.

## Locked decisions
- **Foundation:** keep existing main-process backend (sql.js DB, IPC handlers, backups, notifications, updater). Redesign = new renderer only. Existing installs auto-update into the new UI.
- **New feature in scope:** household overview (all vehicles at a glance, most-urgent item per vehicle). Everything else = existing features re-laid-out.
- **Theme:** dark-first cockpit. Functional light mode kept, designed after the dark direction is approved.
- **No sidebar.** Hard requirement.

## Research anchors (from web research, 2026-07-29)
- Dark grey beats pure black for glance legibility (ustwo cluster research). Panels one step lighter, flat depth — no glassmorphism on content.
- Exception coloring: all-OK is dim/muted; only due/overdue items get chroma (F1 telemetry practice).
- Mono/tabular numerals for all data ("technical" signal); humanist grotesk for UI text — square "techy" fonts measurably hurt glanceability.
- Bars and LED tick-strips over radial gauges. One brand accent maximum (Tesla model).
- Navigation without sidebar: tiles-as-nav with shared-element morph (bento), or timeline-as-spine with filter lenses. Always keep a visible nav surface; cmd-K palette is a supplement, never the only path.
- Motion: spring physics, staggered reveals, shared-element transitions (Framer Motion layoutId / View Transitions API). Forms are overlays/sheets, never destinations.

## Direction A — MISSION CONTROL (`mission-control.html`)
Garage as telemetry wall. One bento board is the whole app; tiles are live modules and the navigation. Click tile → morphs fullscreen; Esc → back to board. Tiles resize by urgency (overdue grows, healthy collapses to slivers). Household = vehicle cards strip on top; switching swaps the board context.
- Tokens: bg #14181D, panel #1A1F26, line #2A313B, text #E9EDF2, dim #8A94A3, accent voltage-blue #57A0FF, amber #FFB020, red #FF5252, green #39D98A.
- Type: Space Grotesk (display) / Inter (UI) / IBM Plex Mono (all numerals).
- Signature: the breathing status wall — urgency-driven tile sizes + LED tick-strips per service interval (km + months dual track).

## Direction B — DRIVER'S LOG (`drivers-log.html`)
The vehicle's life as a road. Cinematic hero (vehicle name, live count-up odometer, next-due line), then one chronological spine: ROAD AHEAD (projected dues as km/date markers) above a glowing TODAY marker, history below. Lens pills filter the spine (F1 page-cycling); odometer minimap on the right edge scrubs the life; radial "+" FAB for quick log. Card click → bottom sheet.
- Tokens: bg #0A0E14, panel #111722, line #1E2735, text #EDF1F7, dim #7E8A9C, accent gauge-amber #FFAA2B, red #FF3B30, green #2BD98F.
- Type: Barlow Condensed (display — derived from highway signage) / Barlow (UI) / JetBrains Mono (numerals).
- Signature: the road-ahead projection — future dues rendered as markers on the same spine as history, TODAY as the glowing position marker.

## Sample data (frozen; ties out across both mockups)
- D-Max 2022 Isuzu, odometer 15,148 km. Oil last 12,260 km / 18 May 2026, 10,000 km + 6 mo interval → due 22,260 km (in 7,112) or 18 Nov 2026 (112 d). Cabin filter due in 4,852 km. July fuel: 24 Jul 42.3 L $182.31 (odo 15,102) + 08 Jul 40.1 L $172.83 (odo 14,671) = $355.14 July spend. Avg 10.2 km/L. Insurance ICBL $2,340/yr renews 15 Mar 2027 (229 d). Road tax expires 12 Aug 2026 (14 d, amber). Registration 30 Sep 2026 (63 d). Tires Dunlop AT25, 6.5 mm min tread, 8,400 km on set.
- Swift 2019 Suzuki, 84,210 km, brake fluid OVERDUE by 320 km (red) — makes household glance meaningful.

## Next gates
1. Owner clicks both mockups, picks a direction (or hybrid), annotates.
2. Winner becomes Phase 0 reference: expand to every screen incl. light mode, all numbers tying out.
3. Phased build on existing backend (shell → board/spine + modules → forms → charts → polish), each phase verified in the running app.

## Phase 0 reference (2026-07-29)
Direction B chosen by owner. `phase0-drivers-log.html` is the design contract:
every lens (ALL/FUEL/SERVICE/TIRES/FLUIDS/INSURANCE/DOCS/NOTES/STATS) with
context strips, road-ahead + history spine, sheets (detail, quick-log, settings,
garage/household), light mode via [data-theme], empty state, reduced-motion.
Tokens + sample data frozen — port verbatim into the renderer build.

## v2 — after 4-agent design audit (2026-07-29)
Audited by four parallel agents: visual craft, UX/daily workflow, accessibility
(computed contrast), IA/feature-parity vs the real 13-page app. ~50 findings.
Applied:

**Axis + data (both visual and IA agents flagged; my sample data was wrong)**
- Spine is now **date-primary, km-annotation**. History verified strictly
  date-descending AND km-descending (was inverted: 14,900/10 JUN sat above
  14,262/19 JUN). Tires "8,400 km on set" → 2,888 (12,260 fitted → 15,148 now).
  Donut retied: Fuel $2,140·42% / Insurance $2,340·46% / Service $590·12%.
- Road-ahead items carry projected dates ("EST FEB 27") from driving rate.

**Exception coloring restored (the spec's own locked rule, which v1 violated)**
- Amber only on genuinely due/overdue items. Not-yet-due road-ahead entries,
  meter fills, chart series and "all OK" values are now neutral (dim/faint).
- Charts use luminance steps, never accent — accent means "due", one meaning.

**Lost capabilities restored — 4 new sheets**
- `intervals` (18 rows, km+months, edit/mark-done/add custom), `tireset`
  (inspections, rotations, retire & fit new), `backups` (frequency, keep-N,
  folder, back up now, **restore**, export CSV), `odo` (odometer correction).
- Quick-log seg extended to 7 types (adds Tires/Insurance/Doc); every lens strip
  has its own `+` action; STATS gained quarters/years + Export CSV.
- Fuel form gained the **full/partial tank toggle** (drives the economy math),
  auto-total, station prefill, photo attach; odometer field no longer prefills
  the current reading (invited duplicate-km corruption) — placeholder + validation.

**Navigation / daily use**
- Radial FAB deleted — all three arms opened the same sheet. One tap = log,
  fuel preselected (the weekly action).
- Minimap deleted — fake instrumentation (aria-hidden, hardcoded positions,
  no scroll wiring).
- Vehicle chip added to the sticky lens bar (hero scrolls away; wrong-vehicle
  logging is the top data risk in a household app). Sheet titles name the vehicle.
- Month headers group the spine ("JULY 2026 · 2 fill-ups · $355.14") and survive
  lens filtering — shown only when entries remain beneath them. "Load earlier".
- Save shows an Undo toast; deletes ask twice.

**Accessibility — every pair now ≥4.5:1 in both themes (measured, not eyeballed)**
- Light theme was failing: accent 3.03:1, white-on-accent 3.03:1, faint 2.40:1.
  Now `--accent:#A15D00` (4.67), `--faint:#5F6C7D` (4.86), green/red retuned.
  Dark `--faint` 2.58 → `#78879E` (4.59). Measured in-page: dark text 17.06,
  dim 5.13, faint 4.59, accent 10.16; light 14.9 / 5.68 / 4.86 / 4.67.
- Sheets use `inert` + focus move + focus restore (real trap, verified); hidden
  sheets/controls no longer sit in the tab order.
- Lens bar is a tablist with `aria-selected`; entries carry sr-only date/km
  context; charts have text alternatives; status never hue-only ("due soon"
  text, sr-only "attention needed" on the Swift alert dot).
- Input focus ring no longer clobbered by `outline:none`.

**Typography/spacing**
- Type scale collapsed to 11/12/13/14/16/21/25/38/58 (was ~19 sizes incl.
  fractional); tracking to three tokens. Hero has one focal point — odometer
  dropped 54→38px, weight 700→500.
- One content column: hero, lens bar and spine share a left edge (`.shell`).
- Road SVG: single vanishing point, masked into the horizon, infinite animation
  removed. "⌘K" → "Ctrl K" (Windows app).

Verified in-page before commit: timeline monotonic on both axes; lens filter
incl. road-ahead + month headers + empty copy per lens; ROAD AHEAD label hides
when empty; focus trap and restore; contrast in both themes; screenshots of
dark ALL, light SERVICE, intervals sheet.

**Deferred to the build (not mockup problems):** windowed rendering for 3+ years
of entries, real ⌘K search, per-type edit forms, drivetrain presets in the
add-interval flow. Decide explicitly: note "pinning" needs a DB column — it is
NOT in the current schema.
