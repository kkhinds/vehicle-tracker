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
