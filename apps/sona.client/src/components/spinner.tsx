import type { ComponentProps, CSSProperties } from "react";

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps extends Omit<ComponentProps<"svg">, "children"> {
  size?: SpinnerSize;
  /** Announced to screen readers; also used as the SVG title. */
  label?: string;
}

interface SpinnerArcsProps {
  /** Centre of the icon in the host SVG's user units. */
  cx: number;
  cy: number;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "size-5",
  md: "size-9",
  lg: "size-56",
};

// Radii, stroke widths and opacities are lifted from public/icon-transparent.svg.
// `arc` is that icon's sweep as a percentage of the circumference (pathLength=100)
// and `rotate` is the angle of the path's first point — a bare <circle> starts its
// dash at 3 o'clock, so without it every ring would begin in the wrong place.
// Delays are positive and ripple outwards from the dot, so the first painted frame
// is the untouched logo and each ring sets off a beat after the one inside it.
const arcs = [
  { r: 7.44, width: 1, opacity: 0.35, arc: 25, rotate: -90, delay: "0ms" },
  { r: 11.7, width: 1, opacity: 1, arc: 33, rotate: -104.7, delay: "50ms" },
  { r: 15.8, width: 1, opacity: 0.35, arc: 42, rotate: -119.5, delay: "100ms" },
  { r: 21.5, width: 5, opacity: 1, arc: 50, rotate: -134.3, delay: "150ms" },
];

/**
 * The animated mark on its own, positioned at an arbitrary centre so it can stand
 * in for the icon wherever it appears — alone in `Spinner`, or as the "o" of the
 * wordmark in `AnimatedLogo`. Strokes use `currentColor`; set the colour on a parent.
 */
export function SpinnerArcs({ cx, cy }: SpinnerArcsProps) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx="3.35595" ry="3.42734" fill="currentColor" />
      {arcs.map(({ r, width, opacity, arc, rotate, delay }) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          pathLength={100}
          fill="none"
          stroke="currentColor"
          strokeOpacity={opacity}
          strokeWidth={width}
          strokeLinecap="round"
          transform={`rotate(${rotate} ${cx} ${cy})`}
          className="sona-spinner-arc"
          style={
            {
              "--sona-arc": arc,
              // Dash + gap must always total the full pathLength, otherwise the
              // keyframes' one-period offset shift is not a whole revolution and
              // the arc lands away from where it started.
              "--sona-gap": 100 - arc,
              animationDelay: delay,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

function Spinner({
  size = "md",
  label = "Loading",
  className = "",
  ...props
}: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 57 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label={label}
      className={`text-teal-500 ${sizeStyles[size]} ${className}`}
      {...props}
    >
      <SpinnerArcs cx={28.4981} cy={28.998} />
    </svg>
  );
}

export default Spinner;
