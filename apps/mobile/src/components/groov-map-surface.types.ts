export type MapSurfaceProps = {
  kind: "course" | "ranking";
  compact?: boolean;
  state: Record<string, unknown>;
  onMessage: (type: string, payload: Record<string, unknown>) => Promise<unknown>;
};
