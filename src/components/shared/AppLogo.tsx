interface AppLogoProps {
  className?: string
  size?: number
}

/**
 * App-wide brand mark. Served from /logo.svg (resources/logo.svg via Vite's
 * publicDir). Source of truth: resources/logo.svg.
 */
export default function AppLogo({ className, size = 36 }: AppLogoProps) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
    />
  )
}
