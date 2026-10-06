import { ImageResponse } from "next/og";

/**
 * The social card. Rendered at build/request time by `next/og`, so it uses no
 * binary asset and always matches the brand tokens.
 */
export const alt =
  "The Cipher — enter your coordinates, cross the threshold";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#c8912f";
const BONE = "#ede6d0";
const VOID = "#0b0b11";
const MUTED = "#8a8a9a";
const LINE = "#3a3a48";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 12%, #161622 0%, ${VOID} 62%)`,
          color: BONE,
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* concentric rings */}
        {[300, 220, 140].map((r, i) => (
          <div
            key={r}
            style={{
              position: "absolute",
              width: r * 2,
              height: r * 2,
              borderRadius: 9999,
              border: `1px solid ${
                [GOLD, "#7b61ff", "#2dd4bf"][i]
              }`,
              opacity: 0.35,
            }}
          />
        ))}

        <div
          style={{
            fontSize: 22,
            letterSpacing: 12,
            color: GOLD,
            textTransform: "uppercase",
          }}
        >
          The Cipher
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 62,
            letterSpacing: 2,
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Enter your coordinates. Cross the threshold.
        </div>

        <div
          style={{
            marginTop: 30,
            height: 1,
            width: 420,
            background: LINE,
          }}
        />

        <div
          style={{
            marginTop: 30,
            fontSize: 26,
            color: MUTED,
            fontFamily: "monospace",
            letterSpacing: 1,
          }}
        >
          KP chart · Human Design bodygraph · aura avatar
        </div>
      </div>
    ),
    size,
  );
}
