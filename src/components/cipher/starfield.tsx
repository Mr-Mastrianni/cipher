/**
 * A fixed field of stars, as one SVG data URI, tinted by the theme.
 *
 * Deterministic on purpose: the positions come from a seeded generator at
 * module scope, so the server and the browser draw exactly the same sky. A
 * canvas would need an effect and a loop for something that never moves; a
 * background image costs nothing and cannot flicker.
 *
 * The dots are drawn as a mask rather than a picture, so the field takes its
 * colour from `--c-star`: warm dust in Noir, ink on paper in Ivory. The theme
 * changes without a re-render, and the server and client still agree.
 */

function build(): string {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let dots = "";
  for (let i = 0; i < 170; i++) {
    const x = (rnd() * 1000).toFixed(1);
    const y = (rnd() * 640).toFixed(1);
    const r = rnd() < 0.86 ? 0.7 : 1.3;
    const o = (0.1 + rnd() * 0.5).toFixed(2);
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMin slice">${dots}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const STARFIELD = build();
const FADE = "linear-gradient(to bottom, #000 0%, #000 55%, transparent 92%)";

export function Starfield({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        maskImage: FADE,
        WebkitMaskImage: FADE,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "var(--c-star)",
          maskImage: STARFIELD,
          WebkitMaskImage: STARFIELD,
          maskSize: "1000px 640px",
          WebkitMaskSize: "1000px 640px",
          maskRepeat: "repeat",
          WebkitMaskRepeat: "repeat",
        }}
      />
    </div>
  );
}
