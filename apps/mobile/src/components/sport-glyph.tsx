import type { SportType } from "@moveall/contracts";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type SportGlyphProps = {
  sport: SportType;
  size?: number;
  color?: string;
};

export function SportGlyph({ sport, size = 38, color = "#FFFFFF" }: SportGlyphProps) {
  const common = {
    fill: "none",
    stroke: color,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 3.2,
  };

  return (
    <Svg accessibilityElementsHidden height={size} viewBox="0 0 48 48" width={size}>
      {sport === "running" ? (
        <>
          <Circle cx="30.5" cy="7.5" fill={color} r="4.5" />
          <Path d="M26 15 20 25l8 6 3 12" {...common} strokeWidth="6" />
          <Path d="m23 18-8-2-6 8" {...common} strokeWidth="6" />
          <Path d="M27 31 19 42 8 35" {...common} strokeWidth="6" />
          <Path d="m28 16 7 9 9-5" {...common} strokeWidth="6" />
        </>
      ) : null}

      {sport === "hiking" ? <Path d="M4 35 18 13l9 13 6-8 11 17" {...common} /> : null}

      {sport === "cycling" ? (
        <>
          <Circle cx="10" cy="35" r="7" {...common} />
          <Circle cx="38" cy="35" r="7" {...common} />
          <Circle cx="26" cy="10" fill={color} r="3.2" />
          <Path d="m24 16-7 7 7 6 6-10 7 5" {...common} />
          <Path d="m17 23-7 12h14l-7-12Zm7 6 7 6h7" {...common} />
        </>
      ) : null}

      {sport === "strength" ? (
        <>
          <Path d="M11 24h26" {...common} />
          <Rect height="22" rx="3" width="7" x="9" y="13" {...common} />
          <Rect height="28" rx="3" width="7" x="16" y="10" {...common} />
          <Rect height="28" rx="3" width="7" x="25" y="10" {...common} />
          <Rect height="22" rx="3" width="7" x="32" y="13" {...common} />
          <Path d="M5 19v10m38-10v10" {...common} />
        </>
      ) : null}

      {sport === "swimming" ? (
        <>
          <Circle cx="34" cy="15" r="5" {...common} />
          <Path d="m6 23 8-6 7 6-8 5" {...common} />
          <Path d="M3 31c4 0 4 3 8 3s4-3 8-3 4 3 8 3 4-3 8-3 4 3 8 3" {...common} />
          <Path d="M3 39c4 0 4 3 8 3s4-3 8-3 4 3 8 3 4-3 8-3 4 3 8 3" {...common} />
        </>
      ) : null}

      {sport === "diving" ? (
        <>
          <Path
            d="M5 20c0-6 4-10 10-10h12c4 0 7 3 7 7v3c0 6-4 10-10 10h-3l-4-5-4 5h-2c-4 0-6-4-6-10Z"
            {...common}
          />
          <Path d="M34 16h6v15c0 7-5 12-12 12-5 0-9-2-11-6" {...common} />
          <Path d="M40 11V6h4v5" {...common} />
        </>
      ) : null}
    </Svg>
  );
}
