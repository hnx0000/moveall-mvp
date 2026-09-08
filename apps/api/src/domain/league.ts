import {
  calculateLeaguePoints,
  currentLeagueSeason,
  leagueRange,
  type LeagueQuery,
  type LeaguePlayerStanding,
  type LeagueRegionStanding,
  type LeagueSnapshot,
  type OnboardingProfile,
  type WorkoutSession,
} from "@moveall/contracts";

const verificationMs = 30 * 24 * 60 * 60 * 1000;
const outdoorRoundTripSports = new Set(["running", "hiking", "cycling"]);

export type LeagueEligibility =
  | "eligible"
  | "verification-expired"
  | "verification-after-workout"
  | "route-missing"
  | "route-outside-region";

export type LeagueEntry = {
  workoutId: string;
  userId: string;
  regionKey: string;
  regionName: string;
  province: string | null;
  sport: WorkoutSession["sport"];
  startedAt: string;
  points: number;
  eligibility: LeagueEligibility;
  scoredAt: string;
};

export type LeagueMember = {
  userId: string;
  displayName: string;
  regionKey: string;
  regionName: string;
  province: string | null;
  verifiedAt: string;
};

export type LeagueActivity = {
  userId: string;
  sport: WorkoutSession["sport"];
  startedAt: string;
};

export function leagueRegionIdentity(profile: OnboardingProfile) {
  const neighborhood = profile.neighborhood;
  if (!neighborhood) return null;
  const regionName = neighborhood.district?.trim() || neighborhood.neighborhood.trim();
  const fallbackLocation = `${neighborhood.latitude.toFixed(1)},${neighborhood.longitude.toFixed(1)}`;
  const regionKey = (neighborhood.regionCode?.trim() || `${regionName}@${fallbackLocation}`)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR");
  return { regionKey, regionName, province: neighborhood.province?.trim() ?? null };
}

export function leagueVerificationStatus(profile: OnboardingProfile | null, now = new Date()) {
  if (!profile?.neighborhood) return "missing" as const;
  const verifiedAt = Date.parse(profile.neighborhood.verifiedAt);
  return Number.isFinite(verifiedAt) &&
    verifiedAt <= now.getTime() + 5 * 60 * 1000 &&
    now.getTime() - verifiedAt < verificationMs
    ? ("verified" as const)
    : ("expired" as const);
}

export function createLeagueEntry(
  userId: string,
  workout: WorkoutSession,
  profile: OnboardingProfile | null,
): LeagueEntry | null {
  if (!profile?.neighborhood) return null;
  const identity = leagueRegionIdentity(profile);
  if (!identity) return null;
  const verifiedAt = Date.parse(profile.neighborhood.verifiedAt);
  const workoutAt = Date.parse(workout.startedAt);
  let eligibility: LeagueEligibility = "eligible";
  if (
    !Number.isFinite(verifiedAt) ||
    !Number.isFinite(workoutAt) ||
    workoutAt - verifiedAt >= verificationMs
  ) {
    eligibility = "verification-expired";
  } else if (workoutAt < verifiedAt - 5 * 60 * 1000) {
    eligibility = "verification-after-workout";
  } else if (outdoorRoundTripSports.has(workout.sport)) {
    const route = (workout.routePoints ?? []).filter(
      (point) => point.accuracy === null || point.accuracy === undefined || point.accuracy <= 50,
    );
    if (route.length < 2) {
      eligibility = "route-missing";
    } else {
      const home = {
        latitude: profile.neighborhood.latitude,
        longitude: profile.neighborhood.longitude,
      };
      const startsAtHome = haversineKm(home, route[0]!) <= 5;
      const endsAtHome = haversineKm(home, route.at(-1)!) <= 5;
      if (!startsAtHome || !endsAtHome) eligibility = "route-outside-region";
    }
  }
  return {
    workoutId: workout.id,
    userId,
    ...identity,
    sport: workout.sport,
    startedAt: workout.startedAt,
    points: eligibility === "eligible" ? calculateLeaguePoints(workout) : 0,
    eligibility,
    scoredAt: new Date().toISOString(),
  };
}

export function buildLeagueSnapshot(input: {
  viewerId: string;
  viewerProfile: OnboardingProfile | null;
  query: LeagueQuery;
  members: LeagueMember[];
  entries: LeagueEntry[];
  activities: LeagueActivity[];
  now?: Date;
}): LeagueSnapshot {
  const now = input.now ?? new Date();
  const season = currentLeagueSeason(now);
  const range = leagueRange(input.query.period, now);
  const start = Date.parse(range.startAt);
  const end = Date.parse(range.endAt);
  const memberByUser = new Map(input.members.map((member) => [member.userId, member]));
  const matchingActivity = (activity: LeagueActivity) =>
    Date.parse(activity.startedAt) >= start &&
    Date.parse(activity.startedAt) < end &&
    (input.query.mode === "activity" || activity.sport === input.query.mode);
  const eligibleEntries = input.entries.filter(
    (entry) =>
      entry.eligibility === "eligible" &&
      entry.points > 0 &&
      Date.parse(entry.startedAt) >= start &&
      Date.parse(entry.startedAt) < end &&
      (input.query.mode === "activity" || entry.sport === input.query.mode),
  );

  const regionKeys = new Set([
    ...input.members.map((member) => member.regionKey),
    ...eligibleEntries.map((entry) => entry.regionKey),
  ]);
  const playersByRegion = new Map<string, LeaguePlayerStanding[]>();
  const regions = [...regionKeys].map((regionKey) => {
    const regionMembers = input.members.filter((member) => member.regionKey === regionKey);
    const regionEntries = eligibleEntries.filter((entry) => entry.regionKey === regionKey);
    const pointsByUser = new Map<string, { points: number; activityCount: number }>();
    for (const entry of regionEntries) {
      const total = pointsByUser.get(entry.userId) ?? { points: 0, activityCount: 0 };
      total.points += entry.points;
      total.activityCount += 1;
      pointsByUser.set(entry.userId, total);
    }
    const rawPlayers = [...pointsByUser]
      .map(([userId, total]) => ({
        userId,
        displayName:
          input.members.find((member) => member.userId === userId)?.displayName ?? "GROOV 사용자",
        points: total.points,
        activityCount: total.activityCount,
      }))
      .sort((left, right) => right.points - left.points || left.userId.localeCompare(right.userId));
    const players: LeaguePlayerStanding[] = rawPlayers.map((player, index) => ({
      ...player,
      rank: index + 1,
      mine: player.userId === input.viewerId,
    }));
    playersByRegion.set(regionKey, players);
    const activeUserIds = new Set(
      input.activities
        .filter(
          (activity) =>
            memberByUser.get(activity.userId)?.regionKey === regionKey &&
            matchingActivity(activity),
        )
        .map((activity) => activity.userId),
    );
    const participantCount = pointsByUser.size;
    const memberCount = regionMembers.length;
    return {
      regionKey,
      regionName:
        regionMembers[0]?.regionName ??
        input.entries.find((entry) => entry.regionKey === regionKey)?.regionName ??
        "확인되지 않은 지역",
      province:
        regionMembers[0]?.province ??
        input.entries.find((entry) => entry.regionKey === regionKey)?.province ??
        null,
      rank: 0,
      points: regionEntries.reduce((total, entry) => total + entry.points, 0),
      activityCount: regionEntries.length,
      memberCount,
      activeMemberCount: activeUserIds.size,
      participantCount,
      participationRate:
        memberCount > 0
          ? Math.min(100, Math.round((participantCount / memberCount) * 1_000) / 10)
          : 0,
      leader: players[0] ?? null,
    } satisfies LeagueRegionStanding;
  });
  regions.sort(
    (left, right) =>
      right.points - left.points ||
      right.participantCount - left.participantCount ||
      left.regionKey.localeCompare(right.regionKey),
  );
  regions.forEach((region, index) => {
    region.rank = index + 1;
  });

  const viewerIdentity = input.viewerProfile ? leagueRegionIdentity(input.viewerProfile) : null;
  const verification = leagueVerificationStatus(input.viewerProfile, now);
  const viewerPlayers = viewerIdentity ? (playersByRegion.get(viewerIdentity.regionKey) ?? []) : [];
  const viewerStanding = viewerPlayers.find((player) => player.userId === input.viewerId);
  const targetRegionKey = input.query.regionKey ?? viewerIdentity?.regionKey;
  const players = targetRegionKey ? (playersByRegion.get(targetRegionKey) ?? []) : [];
  const selectedRegion = targetRegionKey
    ? (regions.find((region) => region.regionKey === targetRegionKey) ?? null)
    : null;
  const expiresAt = input.viewerProfile?.neighborhood
    ? new Date(
        Date.parse(input.viewerProfile.neighborhood.verifiedAt) + verificationMs,
      ).toISOString()
    : null;
  const latestScore = eligibleEntries.reduce(
    (latest, entry) => Math.max(latest, Date.parse(entry.scoredAt) || 0),
    0,
  );
  return {
    query: input.query,
    season,
    range,
    generatedAt: now.toISOString(),
    revision: `${latestScore}-${eligibleEntries.length}-${input.members.length}`,
    viewer: {
      verification,
      regionKey: viewerIdentity?.regionKey ?? null,
      regionName: viewerIdentity?.regionName ?? null,
      verificationExpiresAt: expiresAt,
      rank: viewerStanding?.rank ?? null,
      points: viewerStanding?.points ?? 0,
      activityCount: viewerStanding?.activityCount ?? 0,
    },
    region: selectedRegion,
    regions,
    players,
  };
}

function haversineKm(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(rad(right.latitude - left.latitude) / 2) ** 2 +
    Math.cos(rad(left.latitude)) *
      Math.cos(rad(right.latitude)) *
      Math.sin(rad(right.longitude - left.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
