import { Circle, Path, Svg } from "react-native-svg";

type TapIconProps = {
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function TapShareIcon({ color, size = 24, strokeWidth = 2 }: TapIconProps) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M20.3 15.5A9 9 0 1 0 15.5 20.3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M16.6 14.1A5 5 0 1 0 14.1 16.6"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle cx="12" cy="12" fill={color} r="1.2" />
      <Path
        d="m20.7 20.7-7.5-7.5"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth + 0.2}
      />
    </Svg>
  );
}

export function TapTalkIcon({ color, size = 24, strokeWidth = 2 }: TapIconProps) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 28 24" width={(size * 28) / 24}>
      <Path
        d="M12.2 10.8A5.7 5.7 0 1 0 9.2 15.1"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M9.8 9.9A3 3 0 1 0 8.1 12.3"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle cx="7" cy="7" fill={color} r="1" />
      <Path
        d="m12.7 12.7-4.8-4.8"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth + 0.15}
      />
      <Path
        d="M14 5h7.3a3.2 3.2 0 0 1 3.2 3.2v4.4a3.2 3.2 0 0 1-3.2 3.2h-2.2l-3.7 2.8v-2.8H14"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
