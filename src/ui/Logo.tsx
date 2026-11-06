/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
/** One Place's own mark: a speech bubble whose outline is split in four colors. Same drawing as public/favicon.svg. Decorative: give the label to the surrounding element. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      strokeWidth="6.5"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path stroke="#4285f4" d="M5 20V17A12 12 0 0 1 17 5H24.3" />
      <path stroke="#ea4335" d="M24 5H31A12 12 0 0 1 43 17V20.3" />
      <path stroke="#fbbc04" d="M43 20V23A12 12 0 0 1 31 35H23.7" />
      <path stroke="#34a853" d="M24 35H21L11.5 43V33.67A12 12 0 0 1 5 23V19.7" />
    </svg>
  )
}
