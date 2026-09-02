export const REFRESH_PULL_THRESHOLD = 64;

/** Only a downward, vertical gesture that starts at the top can refresh. */
export class PullToRefreshGesture {
  private origin: { x: number; y: number } | null = null;
  private direction: "pending" | "vertical" | "rejected" = "pending";
  distance = 0;

  get active() {
    return this.origin !== null && this.direction === "vertical";
  }

  get ready() {
    return this.active && this.distance >= REFRESH_PULL_THRESHOLD;
  }

  start(x: number, y: number, scrollTop: number) {
    this.end(true);
    if (scrollTop > 1) return;
    this.origin = { x, y };
  }

  move(x: number, y: number, scrollTop: number) {
    if (!this.origin || this.direction === "rejected") return;
    if (scrollTop > 1) {
      this.direction = "rejected";
      this.distance = 0;
      return;
    }
    const dx = x - this.origin.x;
    const dy = y - this.origin.y;
    if (this.direction === "pending") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      this.direction = dy > 0 && dy > Math.abs(dx) * 1.25 ? "vertical" : "rejected";
    }
    this.distance = this.active ? Math.min(92, Math.max(0, dy * 0.5)) : 0;
  }

  end(cancelled = false) {
    const refresh = !cancelled && this.ready;
    this.origin = null;
    this.direction = "pending";
    this.distance = 0;
    return refresh;
  }
}
