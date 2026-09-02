import type { WorkoutRoutePoint } from "@moveall/contracts";
import type { XY } from "./record-studio-model";
export type StudioMapProps = {
  points: WorkoutRoutePoint[];
  labels: boolean;
  onSnapshot: (uri: string, projectedPoints: XY[]) => void;
  onError: (message: string) => void;
};
