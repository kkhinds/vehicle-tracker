# Vehicle Tracker audit plan

Status: decisions answered, waiting for approval to start phase 0.
Codebase at time of writing: v3.4.4, about 8,700 lines of TypeScript (renderer 3,900, main process 4,800).

## Goal

Find out what makes the app harder to use than it needs to be, what's broken or fragile, and what's missing. Then fix it in reviewed batches. The single test for every recommendation is "does this make the everyday job simpler?" The everyday job is: log a fill-up, log a service, see what's due next.

## What already exists (so we don't redo it)

The v3 redesign went through a 4-agent design audit in July (visual craft, UX, accessibility, feature parity). It found about 50 issues and fixed them, as recorded in `mockups/REDESIGN-SPEC.md`. This audit re-checks that work against the shipped app rather than starting over. It also covers ground that audit never touched: data safety, security, code health, the release pipeline and missing features.

Things I already spotted while preparing this plan, to seed the auditors:

1. The notes IPC handler and preload bridge are still registered, although notes were dropped in v3.0 (`electron/main/handlers/notes.ts`, `electron/preload/index.ts:46`).
2. `WelcomeDialog` still uses the old shadcn `ui/dialog` primitive the rest of the app moved away from, so it looks and behaves unlike every other sheet.
3. The QA harness (`scripts/qa-harness.mjs`) walks the 13 routes from v2 that no longer exist.
4. There's no CI on pull requests. The only workflow is the release one, so typecheck and tests never run before merge.
5. The test suite is two files (fuel economy and fuel price parsing). Backups, restore, migrations and the timeline have no tests.
6. The redesign spec put a "household overview" (every vehicle at a glance, most urgent item first) in scope. It needs checking whether it was fully built.
7. The app is desktop only. Fill-ups happen at the pump, away from the PC, which is probably the biggest gap between how the app works and how it gets used.

## How the work is split

### Phase 0: setup (me, before any agent runs)

You can't audit a vehicle app with an empty database. Every screenshot so far shows "Nothing here yet".

1. Build a seed script (`scripts/seed-demo.mjs`) that creates a realistic database. It uses the frozen sample data from the redesign spec: D-Max 2022 at 15,148 km and a Swift 2019 with overdue brake fluid. It adds 18 months of fill-ups (including one missed fill-up), services, two tire sets, insurance, road tax and registration, plus a few photo attachments.
2. Replace the dead QA harness with one that drives the current UI: launch the app, open each lens and each sheet, run the core tasks, then save screenshots and console errors to `audit/evidence/`.
3. Add a PR check workflow (typecheck, tests, build) so every fix PR later gets checked automatically.

Each of these gets its own small PR.

### Phase 1: audit (8 read-only agents in parallel)

Each agent gets this plan, CLAUDE.md, the design contract, the seeded app and the harness. Each one writes its findings in the same format (see "Finding format" below) to `audit/findings/<track>.md`. None of them change code.

| # | Track | What it looks at |
|---|---|---|
| 1 | Everyday workflows | Walks the 12 core tasks in the running app, counting clicks, fields and decisions for each. Tasks: first launch to first fill-up, log fuel, log a service, mark an interval done, fix a wrong odometer, add a second vehicle, switch vehicles, renew insurance, attach a receipt, find an old record, back up and restore, read the monthly spend. Every point where you'd hesitate gets flagged. |
| 2 | Visual design | Allowed to propose layout changes, not only polish. The shipped app against `phase0-drivers-log.html`: token drift, the colour rule (colour only for due or overdue), type scale, spacing, dark and light themes, 900px and 1280px widths, empty and error states. |
| 3 | Accessibility | Re-measures contrast in both themes, keyboard paths through every sheet, focus handling, screen reader labels, reduced motion and 200% zoom. It checks that the July fixes still hold. |
| 4 | Data safety and correctness | Migrations, the synchronous writes, what happens if the app crashes mid-write, backup and restore round trips, odometer validation, the economy maths, deleting a vehicle, photo cleanup and the timeline sort order. |
| 5 | Security | Electron hardening (the main window has `sandbox: false`), IPC input validation, file handler paths (path traversal), the updater's trust chain, the outbound fuel price fetch, and what sits unencrypted on disk. |
| 6 | Code health | Dead code (notes, `ui/` leftovers, the old harness), the two biggest files (`ManagementSheets.tsx` at 797 lines and `LogForm.tsx` at 667), type safety at the IPC boundary, duplicated logic and test gaps. |
| 7 | Release and dev workflow | The release pipeline, PR checks, lockfile drift, the update path, the dev setup on Windows versus cloud. |
| 8 | Missing features | Compares the app against Fuelly, Drivvo, Simply Auto and LubeLogger (the self-hosted one), and checks it against the household overview the spec promised. Covers logging from a phone, recurring costs, cost per km, reminders, data export, receipt scanning and multiple currencies. For each idea it says who it's for, how much effort it is, and whether it adds steps for the everyday job. |

### Phase 2: verify and rank (fresh agents)

Self-review misses things, so a different agent checks every finding marked high or critical. It reproduces the finding in the running app or confirms it in the code, and it rejects anything it can't reproduce. Lower findings get spot checked.

Then one agent merges the eight files into a single report. It removes duplicates and sorts everything into four buckets:

1. **Fix now**: bugs, data risks, security issues.
2. **Simplify**: workflow and design changes that remove steps.
3. **Build**: new features worth adding.
4. **Skip**: ideas considered and rejected, with the reason.

Each item carries an effort size (S, M or L) and the evidence behind it.

Output: `audit/AUDIT-REPORT.md` in the repo, and a published page you can read on your phone.

### Phase 3: your decision (gate)

You go through the report and mark each item go, later or no. Nothing gets built without that mark. This is also where the big forks get decided, like phone logging.

### Phase 4: build (one agent per batch)

Approved items get grouped into batches of related changes, small enough for one PR each. Every batch goes through the same loop:

1. An implementer agent works in its own git worktree, so batches can't collide.
2. A separate reviewer agent reads the diff, looking for bugs and anything that breaks the design contract.
3. A verifier agent runs the seeded app through the harness and compares screenshots before and after.
4. CI goes green and a PR opens. You merge.

Batches that change behaviour you'd notice get release notes and a version bump. Pure internal cleanup doesn't. The order is fix now, then simplify, then build. Data and security fixes go first because they protect what's already logged.

## Finding format

Every agent writes findings like this, so the merge step is mechanical:

```
### [severity] Short title
Track: workflows | design | a11y | data | security | code | release | features
Where: file:line, or the screen and the steps to reach it
Evidence: screenshot path, measured value, or quoted code
Problem: what goes wrong, and for whom
Fix: the specific change
Effort: S (under an hour) | M (half a day) | L (more)
```

Severity scale. **Critical**: loses or corrupts data, or is a security hole. **High**: blocks or misleads a core task. **Medium**: friction you'd hit weekly. **Low**: polish.

## What "simple to use" means here

These targets are measured before and after, so the audit has numbers to beat rather than opinions:

1. **Log a fill-up**: taps and fields from app open to saved. Today it's two typed numbers plus the odometer (v3.4.4). The target is no worse, and fewer if possible.
2. **What's due**: visible without a click on launch, for every vehicle.
3. **First run**: from install to the first saved record, with no help text needed.
4. **Recover a mistake**: edit or undo any record in two taps or fewer.
5. **Zero dead ends**: no screen without a clear way forward or back.

## Cost and scale

Phase 1 is 8 agents and phase 2 is about 4 to 6. Phase 4 depends on how much you approve, roughly 3 agents per batch. That's above the default of 10 agents per workflow run, so I'd run the phases as separate workflows, one at a time, with a check-in after each.

## Decisions (answered by Kemar)

1. **Audience: household only.** Auditors skip code signing, multi-currency, region settings and polish aimed at strangers. The Barbados fuel price source stays as it is. The welcome flow only needs to work for family members.
2. **Design: open to rethinking.** The design track may propose replacing parts of the Driver's Log layout when something simpler exists. Each proposal needs a mockup or annotated screenshot, plus the task counts from the workflows track to show it really is simpler. The colour rule and the contrast floor stay fixed.
3. **Phone logging: evaluate it.** The features track scopes at least two options for logging at the pump. For each it gives the architecture, effort, how it syncs with the desktop database without conflicts, and the security exposure on the home network. You pick at the phase 3 gate.
