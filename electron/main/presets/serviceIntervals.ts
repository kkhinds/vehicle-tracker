// Drivetrain-aware service interval presets.
//
// Each preset includes a plain-language `consequence_of_skipping` written for
// non-mechanic owners — explains WHY the service matters and what it costs to ignore.
//
// `category_key` is the auto-link tag used to match a maintenance log entry back
// to its interval (see handlers/maintenance.ts).

export interface IntervalPreset {
  name: string
  category_key: string
  interval_km: number
  consequence_of_skipping: string
}

const SHARED_BRAKE_FLUID: IntervalPreset = {
  name: 'Brake Fluid',
  category_key: 'brake-fluid',
  interval_km: 40000,
  consequence_of_skipping:
    'Brake fluid absorbs water over time. When it boils under hard braking, the pedal goes soft and you can lose stopping power — a $60 fluid flush prevents thousands in collision damage.',
}

const SHARED_COOLANT: IntervalPreset = {
  name: 'Coolant Flush',
  category_key: 'coolant',
  interval_km: 80000,
  consequence_of_skipping:
    "Old coolant goes acidic and eats the inside of your radiator, water pump and head gasket. Skipping leads to overheating and engine damage that can total a car. The flush is cheap; a blown head gasket isn't.",
}

const SHARED_CABIN_FILTER: IntervalPreset = {
  name: 'Cabin Air Filter',
  category_key: 'cabin-filter',
  interval_km: 20000,
  consequence_of_skipping:
    'A clogged cabin filter restricts AC airflow, lets pollen and exhaust into the cabin, and overworks the blower motor. $20 part, 5-minute job — replace when the AC feels weaker than usual.',
}

const SHARED_WIPERS: IntervalPreset = {
  name: 'Wiper Blades',
  category_key: 'wipers',
  interval_km: 20000,
  consequence_of_skipping:
    "Worn wipers smear instead of clearing — at night in heavy rain that's a real safety risk. Replace any time they streak or chatter; the rubber typically gives up in 12-18 months in the tropics.",
}

const SHARED_TIRE_ROTATION: IntervalPreset = {
  name: 'Tire Rotation',
  category_key: 'tire-rotation',
  interval_km: 10000,
  consequence_of_skipping:
    "Tires wear faster on the drive axle. Rotating front-to-back evens out wear and adds tens of thousands of kilometres to the set's life. Skipping it = buying tires a year sooner.",
}

const SHARED_ALIGNMENT: IntervalPreset = {
  name: 'Wheel Alignment Check',
  category_key: 'alignment',
  interval_km: 20000,
  consequence_of_skipping:
    "Out-of-alignment wheels scrub tire tread off in thousands of kilometres and pull the steering wheel. If the car pulls or you see uneven shoulder wear, get it checked — it's much cheaper than the tires.",
}

const PETROL_OIL: IntervalPreset = {
  name: 'Oil and Filter Change',
  category_key: 'oil-change',
  interval_km: 8000,
  consequence_of_skipping:
    "Engine oil gets dirty and loses lubrication ability. Run it too long and metal-on-metal wear eats your bearings, leading to engine rebuilds or replacement ($3,000+). One of the few services where being early costs almost nothing and being late costs everything.",
}

const PETROL_AIR_FILTER: IntervalPreset = {
  name: 'Engine Air Filter',
  category_key: 'air-filter',
  interval_km: 30000,
  consequence_of_skipping:
    "A clogged air filter starves the engine, hurts fuel economy by up to 10%, and lets fine dust through to scratch the cylinder walls. $25 part. Replace sooner if you drive on dusty roads.",
}

const PETROL_SPARK_PLUGS: IntervalPreset = {
  name: 'Spark Plugs',
  category_key: 'spark-plugs',
  interval_km: 60000,
  consequence_of_skipping:
    "Worn plugs cause misfires, rough idle, hard starts, and unburnt fuel destroys the catalytic converter ($800-2,000 to replace). The plugs themselves are $40-100 a set.",
}

const PETROL_AUX_BELT: IntervalPreset = {
  name: 'Drive Belt (Serpentine)',
  category_key: 'aux-belt',
  interval_km: 80000,
  consequence_of_skipping:
    'The serpentine belt drives the alternator, water pump, and power steering. If it snaps you lose all three at once and risk overheating within minutes. Replace at the first sign of cracks or squealing.',
}

const PETROL_NA: IntervalPreset[] = [
  PETROL_OIL,
  PETROL_AIR_FILTER,
  SHARED_TIRE_ROTATION,
  SHARED_BRAKE_FLUID,
  SHARED_COOLANT,
  SHARED_CABIN_FILTER,
  SHARED_WIPERS,
  SHARED_ALIGNMENT,
  PETROL_SPARK_PLUGS,
  PETROL_AUX_BELT,
  {
    name: 'Transmission Fluid (Automatic)',
    category_key: 'transmission-fluid',
    interval_km: 60000,
    consequence_of_skipping:
      "Burnt transmission fluid causes hard shifts and eventually a slipping transmission — rebuilds run $2,500-5,000. The fluid change is $150-300. Some 'sealed for life' transmissions still benefit from a service at 80-100k km.",
  },
  {
    name: 'Timing Belt',
    category_key: 'timing-belt',
    interval_km: 100000,
    consequence_of_skipping:
      "If your engine uses a timing belt (not a chain) and it snaps on an interference engine, the pistons and valves collide — instant total loss of the engine. Treat this interval as a hard deadline. Skip only if your engine uses a chain.",
  },
]

const PETROL_TURBO: IntervalPreset[] = [
  { ...PETROL_OIL, interval_km: 7000, consequence_of_skipping:
      "Turbocharged engines run hotter and shear oil faster than NA engines. Cheap oil or extended intervals cook the turbo bearings — turbo rebuilds are $1,500-3,000. Use the manufacturer-spec full synthetic, change early." },
  PETROL_AIR_FILTER,
  SHARED_TIRE_ROTATION,
  SHARED_BRAKE_FLUID,
  SHARED_COOLANT,
  SHARED_CABIN_FILTER,
  SHARED_WIPERS,
  SHARED_ALIGNMENT,
  PETROL_SPARK_PLUGS,
  PETROL_AUX_BELT,
  {
    name: 'Transmission Fluid (Automatic)',
    category_key: 'transmission-fluid',
    interval_km: 60000,
    consequence_of_skipping:
      "Burnt transmission fluid causes hard shifts and eventually a slipping transmission — rebuilds run $2,500-5,000. The fluid change is $150-300.",
  },
  {
    name: 'Turbo Inspection (Hoses, Intercooler)',
    category_key: 'turbo-inspect',
    interval_km: 60000,
    consequence_of_skipping:
      "Cracked turbo hoses leak boost (= poor power, high fuel use) and let unfiltered air into the engine. A 5-minute visual every 60k catches problems before they become $2,000 repairs.",
  },
]

const DIESEL_DMAX: IntervalPreset[] = [
  {
    name: 'Oil and Filter Change',
    category_key: 'oil-change',
    interval_km: 10000,
    consequence_of_skipping:
      "Diesels generate soot that contaminates oil faster than petrol. Skip oil changes and the turbo bearings and injectors suffer first — a single injector is $400-800; rebuilding a turbo is $2,000+. Use only diesel-spec oil meeting your manufacturer's standard.",
  },
  {
    name: 'Fuel Filter Water Separator Drain',
    category_key: 'fuel-water-drain',
    interval_km: 10000,
    consequence_of_skipping:
      "Diesel fuel collects water from condensation. Water in your injectors rusts them from the inside — a single injector replacement on a common-rail diesel is $400-800 plus labour. Two minutes to drain, zero cost.",
  },
  {
    name: 'Air Filter Inspection / Replace',
    category_key: 'air-filter',
    interval_km: 30000,
    consequence_of_skipping:
      "A clogged air filter on a diesel turbo means thick black smoke, lost power, and dust slipping past to score the cylinder walls. Halve the interval in dusty conditions.",
  },
  {
    name: 'Valve Clearance (Tappet) Check',
    category_key: 'valve-clearance',
    interval_km: 40000,
    consequence_of_skipping:
      "Valves that aren't seating properly cause loss of compression, hard starts, and eventually burnt valves needing a head rebuild ($2,500+). A clearance check is a $100-200 service.",
  },
  {
    name: 'Fuel Filter Replacement',
    category_key: 'fuel-filter',
    interval_km: 40000,
    consequence_of_skipping:
      "A clogged fuel filter starves the high-pressure pump and injectors, causing hard starts and loss of power. Worst case: pump failure ($1,500+) or contaminated injectors. The filter is $60.",
  },
  SHARED_BRAKE_FLUID,
  {
    name: 'Transfer Case Oil',
    category_key: 'transfer-case-oil',
    interval_km: 40000,
    consequence_of_skipping:
      "On 4WD vehicles, transfer case oil shears and gets contaminated. Run it dry/dirty and the gears whine, then fail — a transfer case rebuild is $1,500-3,000.",
  },
  {
    name: 'Differential Oil (Front & Rear)',
    category_key: 'diff-oil',
    interval_km: 40000,
    consequence_of_skipping:
      "Differential oil protects the ring and pinion gears that transfer power to the wheels. Skip the change and metal shavings circulate, chewing teeth off the gears — a diff rebuild is $800-2,000.",
  },
  {
    name: 'Glow Plugs',
    category_key: 'glow-plugs',
    interval_km: 60000,
    consequence_of_skipping:
      "Glow plugs preheat the diesel for cold starts. Worn ones mean hard starts, white smoke, and rough idle until warm. A failed plug can also crack and drop pieces into the cylinder — a worst-case nightmare.",
  },
  {
    name: 'Automatic Transmission Fluid',
    category_key: 'transmission-fluid',
    interval_km: 60000,
    consequence_of_skipping:
      "Burnt ATF causes hard shifts and eventual transmission failure. Rebuilds run $2,500-5,000 — the fluid change is $150-300.",
  },
  {
    name: 'Drive Belt (Auxiliary / Serpentine)',
    category_key: 'aux-belt',
    interval_km: 80000,
    consequence_of_skipping:
      "The serpentine belt drives the alternator and water pump. If it snaps you lose battery charging and engine cooling at the same time. Inspect for cracks at every service.",
  },
  SHARED_COOLANT,
  {
    name: 'DPF (Diesel Particulate Filter) Inspect',
    category_key: 'dpf-inspect',
    interval_km: 80000,
    consequence_of_skipping:
      "A clogged DPF strangles the engine, triggers limp mode, and can cost $2,000-4,000 to replace. Short trips and stop-go traffic clog it faster — drive at highway speed for 20+ minutes regularly to let it regenerate.",
  },
  {
    name: 'Timing Chain & Tensioner Inspection',
    category_key: 'timing-chain',
    interval_km: 150000,
    consequence_of_skipping:
      "Chains last longer than belts but tensioners and guides wear. A failing chain rattles on cold start — get it inspected at that point or risk catastrophic engine damage.",
  },
  SHARED_TIRE_ROTATION,
  SHARED_CABIN_FILTER,
  SHARED_WIPERS,
  SHARED_ALIGNMENT,
]

const HYBRID: IntervalPreset[] = [
  { ...PETROL_OIL, interval_km: 10000, consequence_of_skipping:
      "Hybrid engines run cooler and shut off frequently, so oil can last longer — but follow your manufacturer's spec. Skipping still causes the same damage as on a regular petrol engine." },
  PETROL_AIR_FILTER,
  SHARED_TIRE_ROTATION,
  SHARED_BRAKE_FLUID,
  SHARED_COOLANT,
  {
    name: 'Inverter / Hybrid Battery Coolant',
    category_key: 'inverter-coolant',
    interval_km: 100000,
    consequence_of_skipping:
      "Hybrids have a separate cooling loop for the high-voltage battery and inverter. Skipping leads to overheating events that can shorten the $3,000-8,000 hybrid battery's life.",
  },
  SHARED_CABIN_FILTER,
  SHARED_WIPERS,
  SHARED_ALIGNMENT,
  PETROL_SPARK_PLUGS,
  {
    name: '12V Auxiliary Battery',
    category_key: '12v-battery',
    interval_km: 50000,
    consequence_of_skipping:
      "Hybrids still have a small 12V battery that wakes the system. When it dies the car won't 'READY' — and replacement is more involved than a normal car. Test annually after year 3.",
  },
  {
    name: 'Brake Inspection (Hybrid Regen)',
    category_key: 'brake-inspect',
    interval_km: 40000,
    consequence_of_skipping:
      "Regenerative braking means the friction pads last 2-3x longer than a normal car, but they can also seize and corrode from disuse. Inspect even if they look fine — surface rust ruins them.",
  },
]

const EV: IntervalPreset[] = [
  SHARED_TIRE_ROTATION,
  SHARED_ALIGNMENT,
  SHARED_BRAKE_FLUID,
  {
    name: 'Battery Coolant',
    category_key: 'battery-coolant',
    interval_km: 100000,
    consequence_of_skipping:
      "EV battery coolant keeps the cells at a safe temperature. Skipping the fluid change can shorten battery life by years — and the battery is the most expensive component in the car ($10,000+).",
  },
  SHARED_CABIN_FILTER,
  SHARED_WIPERS,
  {
    name: 'Brake Inspection (Regen)',
    category_key: 'brake-inspect',
    interval_km: 40000,
    consequence_of_skipping:
      "EVs use regenerative braking heavily, so pads last forever but can corrode from disuse. Inspect even if they look fine.",
  },
  {
    name: 'Gearbox (Reduction Gear) Fluid',
    category_key: 'gearbox-fluid',
    interval_km: 100000,
    consequence_of_skipping:
      "EVs have a single-speed reduction gear, not a traditional transmission. The fluid still wears and protects the gears — skip it and you risk an expensive driveline repair.",
  },
  {
    name: '12V Auxiliary Battery',
    category_key: '12v-battery',
    interval_km: 50000,
    consequence_of_skipping:
      "EVs have a small 12V battery for the electronics. When it dies the car won't power on — test annually after year 3.",
  },
  {
    name: 'Tire Replacement Check',
    category_key: 'tire-check',
    interval_km: 30000,
    consequence_of_skipping:
      "EVs are heavy and have instant torque — they go through tires faster than petrol cars. Check tread depth every 30,000 km even if rotated.",
  },
]

export function getPresetsForDrivetrain(drivetrain: string): IntervalPreset[] {
  switch (drivetrain) {
    case 'petrol-na': return PETROL_NA
    case 'petrol-turbo': return PETROL_TURBO
    case 'diesel': return DIESEL_DMAX
    case 'hybrid': return HYBRID
    case 'ev': return EV
    default: return PETROL_NA
  }
}

// Map maintenance categories / free-text → category_key for auto-linking.
// Used by the maintenance handler to suggest "mark interval X done?".
export const MAINTENANCE_TO_INTERVAL_KEY: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\boil(\s|-)?change\b|\boil\s+and\s+filter\b/i, key: 'oil-change' },
  { pattern: /\btyre\s+rotation\b|\btire\s+rotation\b/i, key: 'tire-rotation' },
  { pattern: /\bbrake\s+fluid\b/i, key: 'brake-fluid' },
  { pattern: /\bbrake\b/i, key: 'brake-inspect' },
  { pattern: /\bair\s+filter\b/i, key: 'air-filter' },
  { pattern: /\bcabin\s+(air\s+)?filter\b/i, key: 'cabin-filter' },
  { pattern: /\bfuel\s+filter\b/i, key: 'fuel-filter' },
  { pattern: /\bwater\s+separator\b|\bfuel\s+(water|drain)\b/i, key: 'fuel-water-drain' },
  { pattern: /\bspark\s+plug/i, key: 'spark-plugs' },
  { pattern: /\bglow\s+plug/i, key: 'glow-plugs' },
  { pattern: /\bcoolant\b|\bantifreeze\b/i, key: 'coolant' },
  { pattern: /\btransmission\s+fluid\b|\batf\b/i, key: 'transmission-fluid' },
  { pattern: /\btiming\s+belt\b/i, key: 'timing-belt' },
  { pattern: /\btiming\s+chain\b/i, key: 'timing-chain' },
  { pattern: /\bdpf\b|\bparticulate\s+filter\b/i, key: 'dpf-inspect' },
  { pattern: /\btransfer\s+case\b/i, key: 'transfer-case-oil' },
  { pattern: /\bdiff(erential)?\s+oil\b/i, key: 'diff-oil' },
  { pattern: /\bvalve\s+clearance\b|\btappet\b/i, key: 'valve-clearance' },
  { pattern: /\bserpentine\b|\bdrive\s+belt\b|\baux(iliary)?\s+belt\b/i, key: 'aux-belt' },
  { pattern: /\bturbo\b/i, key: 'turbo-inspect' },
  { pattern: /\bwiper/i, key: 'wipers' },
  { pattern: /\balignment\b/i, key: 'alignment' },
  { pattern: /\b12v\b|\baux(iliary)?\s+battery\b/i, key: '12v-battery' },
  { pattern: /\binverter\b/i, key: 'inverter-coolant' },
  { pattern: /\bbattery\s+coolant\b/i, key: 'battery-coolant' },
  { pattern: /\breduction\s+gear\b|\bgearbox\s+fluid\b/i, key: 'gearbox-fluid' },
]

export function detectIntervalKey(category: string, description: string): string | null {
  const haystack = `${category} ${description}`
  for (const { pattern, key } of MAINTENANCE_TO_INTERVAL_KEY) {
    if (pattern.test(haystack)) return key
  }
  return null
}
