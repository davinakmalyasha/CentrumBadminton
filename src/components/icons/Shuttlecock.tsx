/**
 * Minimal shuttlecock mark (lucide has no badminton icon).
 * Stroke-based to match lucide's visual language.
 */
export default function Shuttlecock({
  className,
  strokeWidth = 2,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="18" r="2.4" fill="currentColor" stroke="none" />
      <path d="M8.1 15.9 19 5" />
      <path d="M9.4 17.2 20.2 6.4" />
      <path d="M6.8 14.6 17.6 3.8" />
      <path d="M19 5l1.2 1.4-2.6-2.6L19 5z" fill="currentColor" stroke="none" />
    </svg>
  );
}
