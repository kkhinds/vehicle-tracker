import { useState } from 'react'
import {
  HelpCircle, LayoutDashboard, Fuel, Wrench, Calendar, CircleDot, Droplet,
  Shield, FileBadge2, PieChart, FileText, Car, Settings as SettingsIcon,
  Database, Bell, RefreshCw, Rocket, Lightbulb,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// A section = one card on the page and one quick-jump chip at the top.
interface Section {
  id: string
  icon: typeof HelpCircle
  title: string
  blurb: string
  body: React.ReactNode
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
)

const Point = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <li className="text-sm text-muted-foreground leading-relaxed">
    <span className="font-medium text-foreground">{label}</span> {children}
  </li>
)

const sections: Section[] = [
  {
    id: 'start',
    icon: Rocket,
    title: 'How it works',
    blurb: 'The short version of the workflow.',
    body: (
      <div className="space-y-3">
        <P>Vehicle Tracker keeps the running history of your vehicles in one place: fuel, servicing, tires, fluids, insurance, documents, and costs. Here's the loop:</P>
        <ol className="list-decimal space-y-1.5 pl-5">
          <Point label="Add your vehicle.">Open <strong>My Vehicles</strong> and add each car, van, or truck. Set the drivetrain (diesel, petrol, hybrid, EV) so the service schedule fits.</Point>
          <Point label="Log things as they happen.">Every fill-up, service, tire check, or renewal goes on its own page. It takes a few seconds each time.</Point>
          <Point label="Watch the Dashboard.">It rolls everything up: what's due, what you've spent, and anything that needs attention.</Point>
          <Point label="Let reminders do the chasing.">The app warns you before insurance renewals, services, and document expiries come up.</Point>
        </ol>
        <P>You've got more than one vehicle? Switch between them from the name at the top of the sidebar. Each one keeps its own history and schedule.</P>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    blurb: 'Everything at a glance.',
    body: (
      <div className="space-y-2">
        <P>The Dashboard is a read-only summary of the vehicle you've got selected. It shows the current odometer, what's due soon, recent spend, and any warnings (low tread, a fluid you keep topping up, an expiring document).</P>
        <P>You don't add data here. Use the pages in the sidebar for that, then come back to see the picture.</P>
      </div>
    ),
  },
  {
    id: 'fuel',
    icon: Fuel,
    title: 'Fuel Log',
    blurb: 'Fill-ups and fuel economy.',
    body: (
      <div className="space-y-2">
        <P>Log each fill-up with the date, odometer, litres, and price. A couple of things save you time:</P>
        <ul className="list-disc space-y-1.5 pl-5">
          <Point label="Cost auto-fills.">Type the total or the price per litre and the other one works itself out from the litres.</Point>
          <Point label="Full-tank economy.">Tick "full tank" and the app works out km per litre between full fills. Partial fills are skipped so the numbers stay honest.</Point>
          <Point label="Odometer stays current.">If a fill-up's reading is higher than what the vehicle had, it updates the vehicle's odometer for you.</Point>
        </ul>
        <P>You can attach a receipt photo to any entry.</P>
      </div>
    ),
  },
  {
    id: 'maintenance',
    icon: Wrench,
    title: 'Maintenance',
    blurb: 'Work done on the vehicle.',
    body: (
      <div className="space-y-2">
        <P>Record any work: oil change, brakes, a new battery, whatever. Add the cost, the shop, parts replaced, and photos.</P>
        <P>If what you logged matches a service on the schedule (say an oil change), the app offers to mark that schedule item done at the same time. One click, no double entry.</P>
      </div>
    ),
  },
  {
    id: 'schedule',
    icon: Calendar,
    title: 'Service Schedule',
    blurb: 'What\'s due, and when.',
    body: (
      <div className="space-y-2">
        <P>Each vehicle starts with a set of service intervals picked for its drivetrain. The list shows how close each one is by distance, so you can see what's coming.</P>
        <ul className="list-disc space-y-1.5 pl-5">
          <Point label="Mark done.">When you finish a service, mark it done at the odometer and date. The next due point moves along.</Point>
          <Point label="Add your own.">Got a job the presets don't cover? Add a custom interval.</Point>
          <Point label="Why it matters.">Each item can tell you what happens if you skip it, so you can judge what's worth doing now.</Point>
        </ul>
      </div>
    ),
  },
  {
    id: 'tires',
    icon: CircleDot,
    title: 'Tires',
    blurb: 'Sets, inspections, rotations.',
    body: (
      <div className="space-y-2">
        <P>Track a tire set from fitting to retirement: brand, size, install date and odometer, and recommended pressures.</P>
        <ul className="list-disc space-y-1.5 pl-5">
          <Point label="Inspections.">Log tread depth for each corner and the pressures. Low tread flags a warning so you catch it early. Leave a corner blank if you didn't measure it.</Point>
          <Point label="Rotations.">Record when and how you rotated them.</Point>
          <Point label="Retire a set.">When you swap tires, retire the old set. Its history stays for reference.</Point>
        </ul>
      </div>
    ),
  },
  {
    id: 'fluids',
    icon: Droplet,
    title: 'Fluids',
    blurb: 'Top-ups between services.',
    body: (
      <div className="space-y-2">
        <P>Log top-ups for coolant, brake fluid, washer, and the rest. If you're adding the same fluid often, the app flags it, since steady consumption can point to a leak or a worn part.</P>
      </div>
    ),
  },
  {
    id: 'insurance',
    icon: Shield,
    title: 'Insurance',
    blurb: 'Policies and renewals.',
    body: (
      <div className="space-y-2">
        <P>Store each policy: provider, number, premium, and the start and renewal dates. The renewal date drives a reminder so you're not caught out.</P>
        <P>When a policy lapses or you switch, mark it inactive. It stays on record without cluttering the active view.</P>
      </div>
    ),
  },
  {
    id: 'documents',
    icon: FileBadge2,
    title: 'Documents',
    blurb: 'Anything with an expiry.',
    body: (
      <div className="space-y-2">
        <P>Keep registration, licence, warranties, and roadside cover here. Add the expiry and the app tracks the status: OK, due soon, or overdue, plus a reminder before it lapses.</P>
        <P>Some things don't expire. Tick "doesn't expire" and the app stops nagging about a renewal that isn't coming. Attach a photo or scan of the paperwork if you want it handy.</P>
      </div>
    ),
  },
  {
    id: 'expenses',
    icon: PieChart,
    title: 'Expenses',
    blurb: 'Totals, charts, and export.',
    body: (
      <div className="space-y-2">
        <P>See what a vehicle costs you across fuel, maintenance, insurance, and documents. Pick a date range to focus on a month, a year, or the whole run.</P>
        <P>Need it in a spreadsheet? Export to CSV. Each export gets its own timestamped file, so you won't overwrite an earlier one.</P>
      </div>
    ),
  },
  {
    id: 'notes',
    icon: FileText,
    title: 'Notes',
    blurb: 'Free text and attachments.',
    body: (
      <div className="space-y-2">
        <P>Jot down anything that doesn't fit the other pages: a mechanic's number, tire pressures you like, where you parked. Attach files, and search when you need something back.</P>
        <P>A note can belong to one vehicle, or be global so it shows up no matter which vehicle you're viewing.</P>
      </div>
    ),
  },
  {
    id: 'vehicles',
    icon: Car,
    title: 'My Vehicles',
    blurb: 'Add, switch, archive, remove.',
    body: (
      <div className="space-y-2">
        <P>Add and edit your vehicles here. Switch the active one from the name at the top of the sidebar. Archive a vehicle you've sold to hide it without losing the history.</P>
        <P>Deleting a vehicle is permanent. It removes that vehicle's records and photos from your PC. You can't delete the last active vehicle, since the app needs at least one.</P>
      </div>
    ),
  },
  {
    id: 'settings',
    icon: SettingsIcon,
    title: 'Settings',
    blurb: 'Units, theme, backups, updates.',
    body: (
      <div className="space-y-2">
        <P>Settings holds the app-wide preferences:</P>
        <ul className="list-disc space-y-1.5 pl-5">
          <Point label="Units and display.">Distance in km or miles, your currency, and light or dark theme.</Point>
          <Point label="Backups & Data.">Frequency, how many to keep, and buttons to back up now, export, restore, or pick a different backup folder. More on this below.</Point>
          <Point label="Software Update.">Check for a new version and install it. More below.</Point>
          <Point label="Notifications.">Send a test reminder or turn reminders off.</Point>
        </ul>
      </div>
    ),
  },
  {
    id: 'backups',
    icon: Database,
    title: 'Your data & backups',
    blurb: 'Where it lives and how it\'s protected.',
    body: (
      <div className="space-y-2">
        <P>Everything you log sits in a single database file on this PC. Nothing is uploaded or synced to the cloud, so your records are yours.</P>
        <ul className="list-disc space-y-1.5 pl-5">
          <Point label="Automatic backups.">A snapshot is taken on a schedule (daily by default) and the last 10 are kept. Change the frequency and count in Settings.</Point>
          <Point label="Restore safely.">Before a restore replaces your data, the app snapshots what's there now, so you can roll back if you picked the wrong file.</Point>
          <Point label="Keep a copy off the PC.">Export to a USB drive, or point the backup folder at a synced folder like OneDrive, so a dead drive doesn't take your history with it.</Point>
        </ul>
      </div>
    ),
  },
  {
    id: 'reminders',
    icon: Bell,
    title: 'Reminders',
    blurb: 'Nudges before things lapse.',
    body: (
      <div className="space-y-2">
        <P>The app raises a system notification before insurance renewals, service intervals, and document expiries. It checks when it starts up, so leaving it to run means you get the heads-up in good time.</P>
        <P>Send a test notification or turn them off in Settings.</P>
      </div>
    ),
  },
  {
    id: 'updates',
    icon: RefreshCw,
    title: 'Updates',
    blurb: 'How new versions arrive.',
    body: (
      <div className="space-y-2">
        <P>Vehicle Tracker updates itself. It checks for a new version shortly after launch, downloads it in the background, and asks you to restart when it's ready. You can also check by hand under <strong>Settings → Software Update</strong>.</P>
        <P>The version you're on shows at the bottom of the sidebar.</P>
      </div>
    ),
  },
  {
    id: 'tips',
    icon: Lightbulb,
    title: 'Tips',
    blurb: 'Small things that help.',
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <Point label="Switch vehicles fast.">Click the vehicle name at the top of the sidebar.</Point>
        <Point label="Skip double entry.">Log a service under Maintenance and let it mark the schedule item done.</Point>
        <Point label="Tax time.">Export expenses to CSV for whatever range you need.</Point>
        <Point label="Guard your history.">Keep at least one backup somewhere other than this PC.</Point>
      </ul>
    ),
  },
]

export default function Help() {
  const [active, setActive] = useState<string>('start')

  function jump(id: string) {
    setActive(id)
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Help</h1>
          <p className="text-sm text-muted-foreground">How the app works, page by page.</p>
        </div>
      </div>

      {/* Quick-jump chips */}
      <div className="flex flex-wrap gap-2">
        {sections.map(s => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              className={
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                (active === s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground')
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {s.title}
            </button>
          )
        })}
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-4 pb-10">
        {sections.map(s => {
          const Icon = s.icon
          return (
            <Card key={s.id} id={`help-${s.id}`} className="scroll-mt-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  {s.title}
                </CardTitle>
                <CardDescription>{s.blurb}</CardDescription>
              </CardHeader>
              <CardContent>{s.body}</CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
