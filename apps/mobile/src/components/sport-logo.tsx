import { type SportType } from "@moveall/contracts";
import { Defs, Image as SvgImage, Mask, Rect, Svg } from "react-native-svg";
import sportLogoSheet from "../../assets/images/sport-logo-sheet.jpg";
import { useAppTheme } from "../theme-context";

const sportLogoIndex: Record<SportType, number> = {
  running: 0,
  hiking: 1,
  cycling: 2,
  strength: 3,
  swimming: 4,
  diving: 5,
};

const sourceCell = 362;
const cropSize = 350;
const centers: Record<SportType, { x: number; y: number }> = {
  running: { x: 199, y: 184 },
  hiking: { x: 209.5, y: 181 },
  cycling: { x: 205, y: 171.5 },
  strength: { x: 195, y: 194 },
  swimming: { x: 189.5, y: 181.5 },
  diving: { x: 179.5, y: 176.5 },
};

export function SportLogo({
  selected,
  sport,
  size = 48,
}: {
  selected: boolean;
  sport: SportType;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const maskId = `sport-logo-${sport}`;
  const center = centers[sport];
  const sourceX = sportLogoIndex[sport] * sourceCell + center.x;
  const activeWeightOffsets = selected
    ? [
        { x: 0, y: 0 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: -2 },
        { x: 0, y: 2 },
      ]
    : [{ x: 0, y: 0 }];

  if (sport === "strength") {
    const color = selected ? "#FFFFFF" : colors.ink;
    const strokeWidth = selected ? 1.2 : 0.85;
    const barHeight = selected ? 1.3 : 0.95;
    return (
      <Svg height={size} viewBox="0 0 28 28" width={size}>
        <Rect
          fill="none"
          height={8}
          rx={1.4}
          stroke={color}
          strokeWidth={strokeWidth}
          width={3}
          x={2}
          y={10}
        />
        <Rect
          fill="none"
          height={14}
          rx={1.8}
          stroke={color}
          strokeWidth={strokeWidth}
          width={4}
          x={5.5}
          y={7}
        />
        <Rect
          fill={color}
          height={barHeight}
          rx={barHeight / 2}
          width={9}
          x={9.5}
          y={14 - barHeight / 2}
        />
        <Rect
          fill="none"
          height={14}
          rx={1.8}
          stroke={color}
          strokeWidth={strokeWidth}
          width={4}
          x={18.5}
          y={7}
        />
        <Rect
          fill="none"
          height={8}
          rx={1.4}
          stroke={color}
          strokeWidth={strokeWidth}
          width={3}
          x={23}
          y={10}
        />
      </Svg>
    );
  }

  return (
    <Svg height={size} viewBox={`0 0 ${cropSize} ${cropSize}`} width={size}>
      <Defs>
        {activeWeightOffsets.map((offset, index) => (
          <Mask
            height={cropSize}
            id={`${maskId}-${index}`}
            key={`${offset.x}-${offset.y}`}
            maskContentUnits="userSpaceOnUse"
            maskUnits="userSpaceOnUse"
            width={cropSize}
            x={0}
            y={0}
          >
            <SvgImage
              height={sourceCell * 2}
              href={sportLogoSheet}
              preserveAspectRatio="none"
              width={sourceCell * 6}
              x={-(sourceX - cropSize / 2) + offset.x}
              y={-(center.y - cropSize / 2) + offset.y}
            />
            <Rect fill="#000000" height={30} width={cropSize} x={0} y={cropSize - 30} />
          </Mask>
        ))}
      </Defs>
      {activeWeightOffsets.map((offset, index) => (
        <Rect
          fill={selected ? "#FFFFFF" : colors.ink}
          height={cropSize}
          key={`${offset.x}-${offset.y}`}
          mask={`url(#${maskId}-${index})`}
          width={cropSize}
        />
      ))}
    </Svg>
  );
}
