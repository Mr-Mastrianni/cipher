/**
 * A fixed field of stars, as one SVG data URI.
 *
 * Deterministic on purpose: the positions come from a seeded generator at
 * module scope, so the server and the browser draw exactly the same sky. A
 * canvas would need an effect and a loop for something that never moves; a
 * background image costs nothing and cannot flicker.
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
    dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ece6da" opacity="${o}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMin slice">${dots}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const STARFIELD = build();

export function Starfield({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: STARFIELD,
        backgroundSize: "1000px 640px",
        backgroundRepeat: "repeat",
        maskImage: "linear-gradient(to bottom, #000 0%, #000 55%, transparent 92%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, #000 0%, #000 55%, transparent 92%)",
        pointerEvents: "none",
      }}
    />
  );
}
