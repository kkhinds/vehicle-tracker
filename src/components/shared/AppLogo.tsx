interface AppLogoProps {
  className?: string
  size?: number
}

/**
 * App-wide brand mark. Inlined SVG so it scales crisply and matches the dark
 * theme without round-tripping through an <img> tag. The file at
 * `resources/logo.svg` is the source of truth — keep this in sync when the
 * design changes.
 */
export default function AppLogo({ className, size = 36 }: AppLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vt-bg-inline" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="vt-body-inline" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#vt-bg-inline)" />
      <path
        d="M 7 42 L 7 36 Q 7 35 8 35 L 11 35 Q 13 31 17 28 L 24 24 Q 27 23 30 23 L 41 23 Q 45 24 48 28 L 53 34 L 56 35 Q 57 35 57 36 L 57 42 L 51 42 Q 51 38 47 38 Q 43 38 43 42 L 21 42 Q 21 38 17 38 Q 13 38 13 42 Z"
        fill="url(#vt-body-inline)"
      />
      <path
        d="M 31 26 L 31 33 L 19 33 Q 18 33 18.5 32 L 23 28 Q 26 26 28 26 Z"
        fill="#1e3a8a"
      />
      <path
        d="M 33 26 L 41 26 Q 43 26 45 28 L 49 33 L 33 33 Z"
        fill="#1e3a8a"
      />
      <circle cx="17" cy="44" r="6" fill="#0f172a" />
      <circle cx="17" cy="44" r="3" fill="#94a3b8" />
      <circle cx="17" cy="44" r="1" fill="#0f172a" />
      <circle cx="47" cy="44" r="6" fill="#0f172a" />
      <circle cx="47" cy="44" r="3" fill="#94a3b8" />
      <circle cx="47" cy="44" r="1" fill="#0f172a" />
      <circle cx="50" cy="17" r="9" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
      <path
        d="M 46 17 L 49 20 L 54 14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
