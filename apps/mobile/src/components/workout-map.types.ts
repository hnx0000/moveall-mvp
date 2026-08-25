export type MapPoint = {
  latitude: number;
  longitude: number;
};

export type MapPlace = MapPoint & {
  id: string;
  name: string;
  description: string;
};

export type WorkoutMapProps = {
  points: MapPoint[];
  currentPoint: MapPoint | undefined;
  primaryColor: string;
  isSample: boolean;
  onReady?: () => void;
  places?: MapPlace[];
  plannedPoints?: MapPoint[];
  onPointPress?: (point: MapPoint) => void;
  badgeLabel?: string;
  compact?: boolean;
  height?: number;
  minimal?: boolean;
  staticMode?: boolean;
  showBadge?: boolean;
  backgroundColor?: string;
};
