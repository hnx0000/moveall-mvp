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
    <Svg fill="none" height={size} viewBox="0 0 32 24" width={(size * 32) / 24}>
      <Path
        d="M12.2 16.2A6 6 0 1 1 12.2 7.8"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M10.1 14.1A3 3 0 1 1 10.1 9.9"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Circle cx="8" cy="12" fill={color} r="0.9" />
      <Path
        d="m13.3 17.3-4.2-4.2"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth + 0.15}
      />
      <Path
        d="M18 5h9a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-4 3v-3h-2a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
