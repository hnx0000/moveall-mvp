import { characters } from "@moveall/contracts";

// Presentation handles only: user IDs and saved relationships remain unchanged.
const handles: Record<string, string> = {
  ...Object.fromEntries(characters.map(person => [`demo-character-${person.id}`, person.handle])),
  "demo-friend-1": "minji_run",
  "demo-friend-2": "jun.pace",
  "demo-friend-3": "doyun_hike",
  "demo-friend-4": "yuna.fit",
  "demo-friend-private": "harin_blue",
  "demo-friend-6": "taeo_lift",
  "demo-friend-7": "seoa.studio",
  "demo-friend-8": "jiyoung_fit",
  "demo-friend-5": "nari.swim",
};

export function demoSocialName(userId: string, fallback: string): string {
  return handles[userId] ?? fallback;
}

export function demoSocialRegion(userId: string): string | undefined {
  // Fictional feed seed region, never a substitute for a real member's location.
  return handles[userId] ? "서울" : undefined;
}
