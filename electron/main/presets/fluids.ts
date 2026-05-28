// Fluid types tracked between full services + per-fluid threshold defaults.
//
// "Normal" consumption is hard to define generally, so each fluid carries
// a `warnPerThousandKm` value (mL or sensible unit per 1000 km of driving).
// If the rolling consumption rate exceeds this, the dashboard flags it.
//
// `relevance` filters which fluids are shown for a given drivetrain — the
// average car owner doesn't want to see DEF on a petrol sedan or oil on an EV.

export type Drivetrain = 'petrol-na' | 'petrol-turbo' | 'diesel' | 'hybrid' | 'ev'

export interface FluidPreset {
  key: string
  label: string
  unit: 'ml' | 'L' | 'oz'  // default unit shown in the form
  /** Drivetrains where this fluid applies. Use 'all' for universally relevant. */
  relevance: Drivetrain[] | 'all'
  /**
   * Threshold (in the preset's `unit`) per 1000 km of driving. If consumption
   * exceeds this, the dashboard flags the fluid as needing attention.
   */
  warnPerThousandKm: number
  /** Plain-language explanation of what excessive use of this fluid means. */
  meaning: string
}

export const FLUID_PRESETS: FluidPreset[] = [
  {
    key: 'engine-oil',
    label: 'Engine Oil',
    unit: 'ml',
    relevance: ['petrol-na', 'petrol-turbo', 'diesel', 'hybrid'],
    warnPerThousandKm: 300,  // ~0.3 L/1000 km is the OEM tolerance for many modern engines
    meaning:
      "Engines that burn oil between changes signal worn piston rings, valve seals, or " +
      "PCV problems. A small top-up is normal; >0.3 L per 1,000 km warrants a compression " +
      "test before it becomes a $3,000 engine job.",
  },
  {
    key: 'coolant',
    label: 'Coolant / Antifreeze',
    unit: 'ml',
    relevance: ['petrol-na', 'petrol-turbo', 'diesel', 'hybrid'],
    warnPerThousandKm: 50,
    meaning:
      "A sealed cooling system shouldn't lose fluid. Persistent top-ups mean a leak — " +
      "usually a hose, water pump, or worst case, head gasket. Catch it early.",
  },
  {
    key: 'brake-fluid',
    label: 'Brake Fluid',
    unit: 'ml',
    relevance: 'all',
    warnPerThousandKm: 20,
    meaning:
      "Brake fluid level drops naturally as pads wear (the calipers extend further). " +
      "But if you're topping up faster than ~20 mL per 1,000 km, suspect a leak in the " +
      "lines or a caliper — both are safety-critical.",
  },
  {
    key: 'washer-fluid',
    label: 'Washer Fluid',
    unit: 'ml',
    relevance: 'all',
    warnPerThousandKm: 99999,  // no upper alert — purely user-controlled
    meaning:
      "Use as much as you need. We just track it for trip planning.",
  },
  {
    key: 'def-adblue',
    label: 'DEF / AdBlue',
    unit: 'L',
    relevance: ['diesel'],
    warnPerThousandKm: 1.5,
    meaning:
      "Modern diesels inject DEF to reduce NOx emissions. Typical consumption is " +
      "~1.0 L per 1,000 km. Significantly higher use can mean a leaking injector or " +
      "a software issue causing over-dosing.",
  },
  {
    key: 'transmission-fluid',
    label: 'Transmission Fluid',
    unit: 'ml',
    relevance: ['petrol-na', 'petrol-turbo', 'diesel', 'hybrid'],
    warnPerThousandKm: 30,
    meaning:
      "Sealed transmissions shouldn't need top-ups. If you're adding ATF, suspect a " +
      "leak at the pan gasket or cooler lines — running low destroys clutches.",
  },
  {
    key: 'power-steering',
    label: 'Power Steering Fluid',
    unit: 'ml',
    relevance: ['petrol-na', 'petrol-turbo', 'diesel'],
    warnPerThousandKm: 30,
    meaning:
      "Most modern cars have electric power steering and don't use fluid. For " +
      "hydraulic systems, leaks usually come from the high-pressure hose or rack.",
  },
  {
    key: 'inverter-coolant',
    label: 'Inverter / HV Coolant',
    unit: 'ml',
    relevance: ['hybrid', 'ev'],
    warnPerThousandKm: 30,
    meaning:
      "Hybrids and EVs have a separate cooling loop for the high-voltage battery and " +
      "inverter. Any loss here can shorten the $10,000+ battery's life — investigate any " +
      "top-up immediately.",
  },
  {
    key: 'other',
    label: 'Other',
    unit: 'ml',
    relevance: 'all',
    warnPerThousandKm: 99999,
    meaning: 'Catch-all for fluids not in this list (gear oil, hydraulic clutch, etc.).',
  },
]

export function getFluidsForDrivetrain(drivetrain: string): FluidPreset[] {
  return FLUID_PRESETS.filter(
    f => f.relevance === 'all' || (f.relevance as string[]).includes(drivetrain)
  )
}

export function findFluidPreset(key: string): FluidPreset | undefined {
  return FLUID_PRESETS.find(f => f.key === key)
}
