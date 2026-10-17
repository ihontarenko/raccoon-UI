/*
 * Closeness — how near a result is to its question, from the numbers the search returned. Blue is
 * within what the profile admits, red is beyond its cut-off; the words beside every picture say the
 * same, so colour is never the only signal.
 *
 * ⚠️ THE STROKE WIDTH IS CHOSEN IN TYPESCRIPT. The CSS Module this replaced set it from a class on
 * the <svg> (`.waveLarge .resultWave`); here each path is told its own width, because two
 * declarations of `stroke-width` on one path would be settled by stylesheet order.
 */
const AXIS = "stroke-line [stroke-width:1]";
const WAVE = "fill-none [stroke-linecap:round]";
const QUESTION = "stroke-muted [stroke-dasharray:2_2.5]";

interface PhaseWaveProperties {
  /** The angle between the query vector and the result vector, in degrees: 0 is the same direction. */
  angleDegrees: number;
  /** Beyond the profile's cut-off: drawn in the refusing colour. */
  beyondCutOff?: boolean;
  size?: "small" | "large";
  /** What the picture says, for anyone who cannot see it. */
  description: string;
}

const PERIOD = 28;

/**
 * Two waves — the question's and the result's — offset by the angle between their vectors. Two sine
 * waves offset by an angle θ correlate by exactly cos θ, which is the cosine similarity the search
 * measured; so the same meaning draws one wave over the other, an unrelated one a quarter period off,
 * and an opposite one a mirror. The pair drifts together, which keeps the offset constant; under
 * reduced motion it stands still.
 */
export function PhaseWave({ angleDegrees, beyondCutOff = false, size = "small", description }: PhaseWaveProperties) {
  const width = size === "small" ? 72 : 168;
  const height = size === "small" ? 22 : 44;
  const amplitude = height / 2 - 3;
  const middle = height / 2;
  const phase = (angleDegrees * Math.PI) / 180;
  const stroke = size === "large" ? "[stroke-width:2]" : "[stroke-width:1.6]";
  const pathOf = (offset: number) => {
    const points: string[] = [];
    // One period wider than the frame, so drifting by a whole period is seamless.
    for (let x = 0; x <= width + PERIOD; x += 1) {
      const y = middle - amplitude * Math.sin((2 * Math.PI * x) / PERIOD - offset);
      points.push(`${x === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(2)}`);
    }
    return points.join(" ");
  };
  return (
    <svg
      className="block flex-none overflow-hidden"
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: `calc(${width}px * var(--ui-scale))`, height: `calc(${height}px * var(--ui-scale))` }}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <line x1="0" x2={width} y1={middle} y2={middle} className={AXIS} />
      {/* The pair drifts as one, so the offset between the two waves stays exactly the angle. */}
      <g className="animate-drift motion-reduce:animate-none">
        <path d={pathOf(0)} className={`${WAVE} ${QUESTION} ${stroke}`} />
        <path
          d={pathOf(phase)}
          className={`${WAVE} ${beyondCutOff ? "stroke-deny" : "stroke-allow"} ${stroke}`}
        />
      </g>
    </svg>
  );
}
