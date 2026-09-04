type Tap = { x: number; y: number; time: number };

/** Per-photo gesture state: scrolling, holding and separate taps must not like a post. */
export class FeedLikeGesture {
  private down: Tap | null = null;
  private previousTap: Tap | null = null;
  private chainTap: Tap | null = null;
  private moved = false;
  private lastPulse = -Infinity;
  private level = 0;

  get pressing() {
    return this.down !== null;
  }

  start(x: number, y: number, time: number) {
    if (![x, y, time].every(Number.isFinite)) {
      this.cancel();
      return;
    }
    this.down = { x, y, time };
    this.moved = false;
  }

  move(x: number, y: number) {
    if (this.down && Math.hypot(x - this.down.x, y - this.down.y) > 12) {
      this.moved = true;
      this.previousTap = null;
      this.chainTap = null;
    }
  }

  end(x: number, y: number, time: number) {
    const down = this.down;
    this.down = null;
    if (
      !down ||
      ![x, y, time].every(Number.isFinite) ||
      this.moved ||
      time < down.time ||
      time - down.time > 450 ||
      Math.hypot(x - down.x, y - down.y) > 12
    ) {
      this.previousTap = null;
      this.chainTap = null;
      return false;
    }
    const chain = this.chainTap;
    if (
      chain &&
      time >= chain.time &&
      time - chain.time < 650 &&
      Math.hypot(x - chain.x, y - chain.y) < 44
    ) {
      this.chainTap = { x, y, time };
      return true;
    }
    this.chainTap = null;
    const previous = this.previousTap;
    if (
      previous &&
      time >= previous.time &&
      time - previous.time < 300 &&
      Math.hypot(x - previous.x, y - previous.y) < 44
    ) {
      this.previousTap = null;
      this.chainTap = { x, y, time };
      return true;
    }
    this.previousTap = { x, y, time };
    return false;
  }

  nextPulse(time: number) {
    this.level =
      time >= this.lastPulse && time - this.lastPulse < 1650 ? Math.min(this.level + 1, 5) : 1;
    this.lastPulse = time;
    return this.level;
  }

  cancel() {
    this.down = null;
    this.previousTap = null;
    this.chainTap = null;
    this.moved = false;
  }

  reset() {
    this.cancel();
    this.lastPulse = -Infinity;
    this.level = 0;
  }
}

/** RN Web reports screenReaderEnabled=true for everyone; never use it to bypass pointer taps. */
export function isAccessibleLikeActivation({
  web,
  screenReader,
  pressing,
  key,
  detail,
  pointerType,
}: {
  web: boolean;
  screenReader: boolean;
  pressing: boolean;
  key?: string | undefined;
  detail?: number | undefined;
  pointerType?: string | undefined;
}) {
  if (!web) return screenReader;
  return (
    key === "Enter" ||
    key === " " ||
    key === "Spacebar" ||
    (!pressing && detail === 0 && !pointerType)
  );
}

export function setPostLiked(current: string[], postId: string, liked: boolean) {
  if (liked) return current.includes(postId) ? current : [...current, postId];
  return current.includes(postId) ? current.filter((id) => id !== postId) : current;
}

export function likePulsePosition(width: number, height: number, x: number, y: number) {
  const unit = Math.min(width / 360, 1.18);
  const insetX = Math.min(width / 2, 62 * unit);
  const insetY = Math.min(height / 2, 72 * unit);
  return {
    x: Math.max(insetX, Math.min(width - insetX, x)),
    y: Math.max(insetY, Math.min(height - insetY, y)),
    unit,
  };
}
