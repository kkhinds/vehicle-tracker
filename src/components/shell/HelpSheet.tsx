import { useEffect, useState } from 'react'

/**
 * In-app help. Written for the Driver's Log layout — lenses, the spine, the log
 * button — not the old sidebar app.
 */
export default function HelpSheet() {
  const [version, setVersion] = useState('')
  useEffect(() => { window.api.app.getVersion().then(setVersion) }, [])

  return (
    <div className="dl-help">
      <section>
        <h3>The idea</h3>
        <p>
          One vehicle, one timeline. Everything you log — fuel, servicing, tires, fluids,
          insurance, documents — lands on the same line, newest first. Above the glowing
          TODAY marker is the road ahead: what's coming and roughly when.
        </p>
      </section>

      <section>
        <h3>Logging something</h3>
        <p>
          Hit <b>+ LOG</b>, bottom right. It opens on the type you're most likely to want:
          fuel from the main view, or whatever lens you're in.
        </p>
        <ul>
          <li>Station and price carry over from your last fill-up.</li>
          <li>Price and total work each other out. Type the litres and what you paid and the
            price per litre follows; type a price per litre instead and the total follows.</li>
          <li>Under them, the national pump price for your fuel, for comparison. If what you
            typed is more than 20% off it, the app says so — usually a slipped decimal.</li>
          <li>Leave <b>Full</b> selected when you filled the tank. Economy is measured between
            full tanks, so partial fills still count toward the litres but don't end the span.</li>
          <li>Attach a receipt, an invoice or a PDF — the file is copied into the app, so
            moving the original later doesn't break anything.</li>
          <li>Enter saves. Esc closes.</li>
        </ul>
      </section>

      <section>
        <h3>Changing something you logged</h3>
        <p>
          Click any entry on the timeline. The sheet shows what was recorded, its
          attachments, and buttons to edit or delete it. Editing reopens the same form
          with the stored values — fields the form doesn't show are left alone. Delete
          asks twice.
        </p>
        <p>
          Tire inspections and rotations are the exception: log a fresh one rather than
          editing an old reading.
        </p>
      </section>

      <section>
        <h3>Finding an old entry</h3>
        <p>
          <b>Ctrl K</b> searches everything logged against the current vehicle — station,
          shop, part, month, amount. Every word has to match, so "sol june" narrows it down.
        </p>
      </section>

      <section>
        <h3>Your garage</h3>
        <p>
          <b>+ Garage</b> under the vehicle name lists every vehicle and takes new ones. A
          new vehicle starts with the service intervals its drivetrain needs. Archiving
          hides a vehicle without touching its history; deleting takes everything logged
          against it.
        </p>
      </section>

      <section>
        <h3>Lenses</h3>
        <p>
          The row under the vehicle name filters the timeline. FUEL shows fill-ups,
          SERVICE shows work done and what's due, and so on. Each lens has its own summary
          and its own add button. STATS is the exception — it replaces the timeline with
          spend, cost per km (or mile) and the CSV export.
        </p>
      </section>

      <section>
        <h3>The road ahead</h3>
        <p>
          Services are due by distance, by time, or whichever comes first. Where an interval
          is distance-based, the date shown is an estimate — marked <b>EST</b> — worked out
          from how much you actually drive. Only items genuinely due or overdue get colour;
          everything else stays quiet on purpose, so a warning means something.
        </p>
        <p>
          Open <b>Service intervals</b> from the SERVICE lens to change a period, correct the
          last-done reading, add one of your own, or tick one off at today's odometer. The
          TIRES lens has the same link for the fitted set.
        </p>
      </section>

      <section>
        <h3>The odometer</h3>
        <p>
          The big number is the vehicle's current reading. It moves up on its own as you log
          entries. Click it to correct a wrong one — a correction you type wins over what's
          been logged and won't get undone by deleting a record later.
        </p>
      </section>

      <section>
        <h3>Your data</h3>
        <p>
          Everything sits in one file on this PC, and none of it leaves. The app makes two
          outbound requests and neither one sends anything of yours: it checks GitHub for a
          new version, and on every launch it reads the current pump price — from the
          Barbados Government Information Service, which announces prices the day they take
          effect, falling back to globalpetrolprices.com. Both are just downloads, and the
          app works offline without them — <b>Settings</b> has a Check now for the price.
        </p>
        <p>
          Backups run on a schedule and keep the last several copies; <b>Settings → Backups</b>
          has back up now, restore, and export, and lists every snapshot on disk. Restoring
          snapshots what you have first, then restarts the app.
        </p>
        <p>
          Keep one copy somewhere other than this machine — a USB drive, or point the backup
          folder at a synced folder. A dead drive shouldn't take your history with it.
        </p>
      </section>

      <section>
        <h3>Reminders</h3>
        <p>
          The app raises a system notification before services, insurance renewals and
          document expiries come due, and again as they get closer. It checks on launch, so
          leaving it running means earlier warning. Turn them off in Settings.
        </p>
      </section>

      <section>
        <h3>Keyboard</h3>
        <ul>
          <li><span className="mono">Ctrl K</span> — search the log</li>
          <li><span className="mono">Esc</span> — close a sheet</li>
          <li><span className="mono">Enter</span> — save the open form</li>
          <li><span className="mono">Ctrl R</span> — reload · <span className="mono">F12</span> — dev tools</li>
          <li><span className="mono">Ctrl +/−/0</span> — zoom</li>
        </ul>
      </section>

      <p className="dl-microcopy">
        Vehicle Tracker {version || '…'} · Built by Kemar Hinds
      </p>
    </div>
  )
}
