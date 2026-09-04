import {
  audienceAllows,
  summarizeUsagePurposes,
  type UsagePurposeCohort,
  type UsagePurposeBucket,
  storyIsActive,
  presentPostAccess,
  resolveCrewAudience,
  type SharingCrew,
  type SharingCrewCreateInput,
  type PostAudience,
} from "@moveall/contracts";
import type {
  ContentReport,
  ContentReportCreateInput,
  ConsentState,
  ConsentUpdateInput,
  DirectMessage,
  FeedPost,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  ModerationReportUpdateInput,
  OnboardingInput,
  OnboardingProfile,
  PostCreateInput,
  PushDeviceRegistrationInput,
  PostShareResult,
  PostUpdateInput,
  ProfileUpdateInput,
  PublicUser,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput,
  SportType,
  UserNotification,
  WorkoutSession,
  WorkoutSessionCreateInput,
  WorkoutSessionUpdateInput,
} from "@moveall/contracts";
import { Pool, type QueryResultRow } from "pg";
import type {
  AppStore,
  StoredAuthSession,
  StoredMediaObject,
  StoredPushDevice,
  User,
} from "../domain/store.js";

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string;
  avatar_data_uri: string | null;
  password_hash: string | null;
  created_at: Date;
};

type RoutineRow = QueryResultRow & {
  id: string;
  user_id: string;
  title: string;
  sport: SportType;
  days_of_week: number[];
  items: Routine["items"];
  sort_order: number;
  created_at: Date;
};

type WorkoutRow = QueryResultRow & {
  id: string;
  user_id: string;
  sport: SportType;
  started_at: Date;
  ended_at: Date;
  perceived_exertion: number;
  notes: string | null;
  metrics: Record<string, number>;
  route_points: WorkoutSession["routePoints"];
  source: "manual" | "wearable";
  created_at: Date;
};

type PostRow = QueryResultRow & {
  id: string;
  user_id: string;
  display_name: string;
  avatar_data_uri: string | null;
  sport: SportType;
  content: string;
  workout_session_id: string | null;
  media_id: string | null;
  media_object_path: string | null;
  content_type: "post" | "story";
  audience: PostAudience;
  comment_audience: PostAudience;
  like_count: number;
  share_count?: number;
  archived_at: Date | null;
  created_at: Date;
};

type MessageRow = QueryResultRow & {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: Date;
};

type CommentRow = QueryResultRow & {
  mentions?: import("@moveall/contracts").CommentMention[];
  id: string;
  user_id: string;
  display_name: string;
  avatar_data_uri: string | null;
  post_id: string;
  content: string;
  created_at: Date;
  parent_comment_id: string | null;
  like_count: number;
  liked_by_me: boolean;
};

type KnowledgeFeedbackRow = QueryResultRow & {
  id: string;
  article_id: string;
  user_id: string;
  display_name: string;
  content: string;
  context: string | null;
  created_at: Date;
};

type AuthSessionRow = QueryResultRow & {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

type ConsentRow = QueryResultRow & {
  terms_version: string;
  privacy_version: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  health_data_accepted: boolean;
  location_accepted: boolean;
  media_accepted: boolean;
  marketing_accepted: boolean;
  accepted_at: Date;
};

type OnboardingRow = QueryResultRow & {
  usage_purpose: OnboardingProfile["usagePurpose"];
  usage_purpose_recorded_at: Date | null;
  usage_purpose_question_version: number | null;
  primary_sports: OnboardingProfile["primarySports"];
  activity_level: OnboardingProfile["activityLevel"];
  goals: OnboardingProfile["goals"];
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  neighborhood_verified_at: Date | null;
  completed_at: Date;
};

type MediaObjectRow = QueryResultRow & {
  id: string;
  user_id: string;
  provider: "supabase" | "r2";
  bucket: string;
  object_path: string;
  kind: StoredMediaObject["kind"];
  content_type: string;
  byte_size: string | number;
  status: StoredMediaObject["status"];
  created_at: Date;
};

type ContentReportRow = QueryResultRow & {
  id: string;
  reporter_id: string;
  target_type: ContentReport["targetType"];
  target_id: string;
  reason: ContentReport["reason"];
  details: string | null;
  status: ContentReport["status"];
  resolution_note: string | null;
  created_at: Date;
  updated_at: Date;
};

type NotificationRow = QueryResultRow & {
  id: string;
  kind: UserNotification["kind"];
  title: string;
  body: string;
  actor_id: string | null;
  resource_type: UserNotification["resourceType"] | null;
  resource_id: string | null;
  read_at: Date | null;
  created_at: Date;
};

type PushDeviceRow = QueryResultRow & {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android";
  device_name: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PostgresStore implements AppStore {
  private readonly pool: Pool;

  constructor(
    databaseUrl: string,
    options: { maxConnections: number; ssl: boolean; sslCa?: string } = {
      maxConnections: 5,
      ssl: true,
    },
  ) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: options.maxConnections,
      ssl: options.ssl
        ? { rejectUnauthorized: true, ...(options.sslCa ? { ca: options.sslCa } : {}) }
        : false,
      application_name: "groov-api",
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 10_000,
    });
  }

  async healthCheck(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT id, email, display_name, avatar_data_uri, password_hash, created_at FROM users WHERE id = $1",
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapUser(row) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT id, email, display_name, avatar_data_uri, password_hash, created_at FROM users WHERE email = $1",
      [email],
    );
    const row = result.rows[0];
    return row ? this.mapUser(row) : null;
  }

  async isDisplayNameTaken(displayName: string, excludingUserId: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM users WHERE lower(display_name) = lower($1) AND id <> $2",
      [displayName, excludingUserId],
    );
    return result.rowCount === 1;
  }

  async updateUserProfile(userId: string, input: ProfileUpdateInput): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      "UPDATE users SET display_name = COALESCE($2, display_name), avatar_data_uri = CASE WHEN $3::boolean THEN $4 ELSE avatar_data_uri END WHERE id = $1 RETURNING id, email, display_name, avatar_data_uri, password_hash, created_at",
      [
        userId,
        input.displayName ?? null,
        input.avatarDataUri !== undefined,
        input.avatarDataUri ?? null,
      ],
    );
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  async createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const result = await this.pool.query<UserRow>(
      "INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name, avatar_data_uri, password_hash, created_at",
      [input.email, input.displayName, input.passwordHash],
    );
    return this.mapUser(result.rows[0]!);
  }

  async findOrCreateOAuthUser(input: {
    provider: "google" | "apple" | "kakao" | "naver";
    subject: string;
    email: string;
    displayName: string;
  }): Promise<User> {
    const existingIdentity = await this.pool.query<UserRow>(
      "SELECT u.id, u.email, u.display_name, u.avatar_data_uri, u.password_hash, u.created_at FROM oauth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = $1 AND i.subject = $2",
      [input.provider, input.subject],
    );
    if (existingIdentity.rows[0]) return this.mapUser(existingIdentity.rows[0]);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let user = await client.query<UserRow>(
        "SELECT id, email, display_name, avatar_data_uri, password_hash, created_at FROM users WHERE email = $1 FOR UPDATE",
        [input.email],
      );
      if (!user.rows[0]) {
        user = await client.query<UserRow>(
          "INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, NULL) RETURNING id, email, display_name, avatar_data_uri, password_hash, created_at",
          [input.email, input.displayName],
        );
      }
      await client.query(
        "INSERT INTO oauth_identities (provider, subject, user_id, email) VALUES ($1, $2, $3, $4) ON CONFLICT (provider, subject) DO NOTHING",
        [input.provider, input.subject, user.rows[0]!.id, input.email],
      );
      const linked = await client.query<UserRow>(
        "SELECT u.id, u.email, u.display_name, u.avatar_data_uri, u.password_hash, u.created_at FROM oauth_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = $1 AND i.subject = $2",
        [input.provider, input.subject],
      );
      await client.query("COMMIT");
      return this.mapUser(linked.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1 RETURNING id",
        [userId, passwordHash],
      );
      await client.query(
        "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [userId],
      );
      await client.query("COMMIT");
      return result.rowCount === 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteUserAccount(userId: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [userId]);
    return result.rowCount === 1;
  }

  async createAuthSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<StoredAuthSession> {
    const result = await this.pool.query<AuthSessionRow>(
      "INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3) RETURNING *",
      [input.userId, input.refreshTokenHash, input.expiresAt],
    );
    return this.mapAuthSession(result.rows[0]!);
  }

  async findAuthSessionById(sessionId: string): Promise<StoredAuthSession | null> {
    const result = await this.pool.query<AuthSessionRow>(
      "SELECT * FROM auth_sessions WHERE id = $1",
      [sessionId],
    );
    return result.rows[0] ? this.mapAuthSession(result.rows[0]) : null;
  }

  async findAuthSessionByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<StoredAuthSession | null> {
    const result = await this.pool.query<AuthSessionRow>(
      "SELECT * FROM auth_sessions WHERE refresh_token_hash = $1",
      [refreshTokenHash],
    );
    return result.rows[0] ? this.mapAuthSession(result.rows[0]) : null;
  }

  async rotateAuthSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<StoredAuthSession | null> {
    const result = await this.pool.query<AuthSessionRow>(
      "UPDATE auth_sessions SET refresh_token_hash = $2, expires_at = $3, last_seen_at = now() WHERE id = $1 AND revoked_at IS NULL AND expires_at > now() RETURNING *",
      [input.sessionId, input.refreshTokenHash, input.expiresAt],
    );
    return result.rows[0] ? this.mapAuthSession(result.rows[0]) : null;
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    await this.pool.query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
      [sessionId],
    );
  }

  async listAuthSessions(userId: string): Promise<StoredAuthSession[]> {
    const result = await this.pool.query<AuthSessionRow>(
      "SELECT * FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC",
      [userId],
    );
    return result.rows.map((row) => this.mapAuthSession(row));
  }

  async getConsent(userId: string): Promise<ConsentState | null> {
    const result = await this.pool.query<ConsentRow>(
      "SELECT terms_version, privacy_version, terms_accepted, privacy_accepted, health_data_accepted, location_accepted, media_accepted, marketing_accepted, accepted_at FROM user_consents WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ? this.mapConsent(result.rows[0]) : null;
  }

  async saveConsent(userId: string, input: ConsentUpdateInput): Promise<ConsentState> {
    const result = await this.pool.query<ConsentRow>(
      "INSERT INTO user_consents (user_id, terms_version, privacy_version, terms_accepted, privacy_accepted, health_data_accepted, location_accepted, media_accepted, marketing_accepted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id) DO UPDATE SET terms_version = EXCLUDED.terms_version, privacy_version = EXCLUDED.privacy_version, terms_accepted = EXCLUDED.terms_accepted, privacy_accepted = EXCLUDED.privacy_accepted, health_data_accepted = EXCLUDED.health_data_accepted, location_accepted = EXCLUDED.location_accepted, media_accepted = EXCLUDED.media_accepted, marketing_accepted = EXCLUDED.marketing_accepted, accepted_at = now(), updated_at = now() RETURNING terms_version, privacy_version, terms_accepted, privacy_accepted, health_data_accepted, location_accepted, media_accepted, marketing_accepted, accepted_at",
      [
        userId,
        input.termsVersion,
        input.privacyVersion,
        input.termsAccepted,
        input.privacyAccepted,
        input.healthDataAccepted,
        input.locationAccepted,
        input.mediaAccepted,
        input.marketingAccepted,
      ],
    );
    return this.mapConsent(result.rows[0]!);
  }

  async getOnboarding(userId: string): Promise<OnboardingProfile | null> {
    const result = await this.pool.query<OnboardingRow>(
      "SELECT * FROM user_onboarding WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ? this.mapOnboarding(result.rows[0]) : null;
  }

  async saveOnboarding(userId: string, input: OnboardingInput): Promise<OnboardingProfile> {
    const result = await this.pool.query<OnboardingRow>(
      `INSERT INTO user_onboarding (user_id, primary_sports, activity_level, goals, neighborhood, latitude, longitude, neighborhood_verified_at, usage_purpose, usage_purpose_recorded_at, usage_purpose_question_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $10::boolean THEN now() END,CASE WHEN $10::boolean THEN 1 END)
       ON CONFLICT (user_id) DO UPDATE SET primary_sports = EXCLUDED.primary_sports, activity_level = EXCLUDED.activity_level, goals = EXCLUDED.goals,
         neighborhood = EXCLUDED.neighborhood, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, neighborhood_verified_at = EXCLUDED.neighborhood_verified_at,
         usage_purpose = CASE WHEN user_onboarding.usage_purpose_recorded_at IS NOT NULL THEN user_onboarding.usage_purpose ELSE EXCLUDED.usage_purpose END,
         usage_purpose_recorded_at = COALESCE(user_onboarding.usage_purpose_recorded_at, EXCLUDED.usage_purpose_recorded_at),
         usage_purpose_question_version = COALESCE(user_onboarding.usage_purpose_question_version, EXCLUDED.usage_purpose_question_version),
         completed_at = now(), updated_at = now() RETURNING *`,
      [
        userId,
        input.primarySports,
        input.activityLevel,
        input.goals,
        input.neighborhood?.neighborhood ?? null,
        input.neighborhood?.latitude ?? null,
        input.neighborhood?.longitude ?? null,
        input.neighborhood?.verifiedAt ?? null,
        input.usagePurpose ?? null,
        input.usagePurpose !== undefined,
      ],
    );
    return this.mapOnboarding(result.rows[0]!);
  }

  async usagePurposeSummary(cohort: UsagePurposeCohort, excludedEmails: string[]) {
    const result = await this.pool.query<UsagePurposeBucket & QueryResultRow>(
      `SELECT o.usage_purpose AS purpose, (o.usage_purpose_recorded_at IS NOT NULL) AS collected,
         (lower(u.email) = ANY($3::text[])) AS excluded, count(*)::int AS count
       FROM users u LEFT JOIN user_onboarding o ON o.user_id = u.id
       WHERE ($1::timestamptz IS NULL OR u.created_at >= $1) AND ($2::timestamptz IS NULL OR u.created_at < $2)
       GROUP BY 1, 2, 3`,
      [
        cohort.registeredFrom ?? null,
        cohort.registeredBefore ?? null,
        excludedEmails.map((email) => email.toLowerCase()),
      ],
    );
    return summarizeUsagePurposes(result.rows, cohort);
  }

  async createMediaObject(
    input: Omit<StoredMediaObject, "id" | "status" | "createdAt">,
  ): Promise<StoredMediaObject> {
    const result = await this.pool.query<MediaObjectRow>(
      "INSERT INTO media_objects (user_id, provider, bucket, object_path, kind, content_type, byte_size) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [
        input.userId,
        input.provider,
        input.bucket,
        input.objectPath,
        input.kind,
        input.contentType,
        input.byteSize,
      ],
    );
    return this.mapMediaObject(result.rows[0]!);
  }

  async markMediaObjectAvailable(
    userId: string,
    mediaId: string,
  ): Promise<StoredMediaObject | null> {
    const result = await this.pool.query<MediaObjectRow>(
      "UPDATE media_objects SET status = 'available', available_at = now() WHERE id = $2 AND user_id = $1 AND status = 'pending' RETURNING *",
      [userId, mediaId],
    );
    return result.rows[0] ? this.mapMediaObject(result.rows[0]) : null;
  }

  async findMediaObject(userId: string, mediaId: string): Promise<StoredMediaObject | null> {
    const result = await this.pool.query<MediaObjectRow>(
      "SELECT * FROM media_objects WHERE user_id = $1 AND id = $2",
      [userId, mediaId],
    );
    return result.rows[0] ? this.mapMediaObject(result.rows[0]) : null;
  }

  async listMediaObjects(userId: string): Promise<StoredMediaObject[]> {
    const result = await this.pool.query<MediaObjectRow>(
      "SELECT * FROM media_objects WHERE user_id = $1 AND status <> 'deleted' ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map((row) => this.mapMediaObject(row));
  }

  async createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE routines SET sort_order = sort_order + 1 WHERE user_id = $1", [
        userId,
      ]);
      const result = await client.query<RoutineRow>(
        "INSERT INTO routines (user_id, title, sport, days_of_week, items, sort_order) VALUES ($1, $2, $3, $4, $5::jsonb, 0) RETURNING *",
        [userId, input.title, input.sport, input.daysOfWeek, JSON.stringify(input.items)],
      );
      await client.query("COMMIT");
      return this.mapRoutine(result.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRoutines(userId: string): Promise<Routine[]> {
    const result = await this.pool.query<RoutineRow>(
      "SELECT * FROM routines WHERE user_id = $1 ORDER BY sort_order ASC, created_at DESC",
      [userId],
    );
    return result.rows.map((row) => this.mapRoutine(row));
  }

  async updateRoutine(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine | null> {
    const result = await this.pool.query<RoutineRow>(
      "UPDATE routines SET title = $3, sport = $4, days_of_week = $5, items = $6::jsonb WHERE user_id = $1 AND id = $2 RETURNING *",
      [userId, routineId, input.title, input.sport, input.daysOfWeek, JSON.stringify(input.items)],
    );
    return result.rows[0] ? this.mapRoutine(result.rows[0]) : null;
  }

  async deleteRoutine(userId: string, routineId: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM routines WHERE user_id = $1 AND id = $2", [
      userId,
      routineId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async reorderRoutines(userId: string, routineIds: string[]): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const owned = await client.query<{ id: string }>(
        "SELECT id FROM routines WHERE user_id = $1 FOR UPDATE",
        [userId],
      );
      if (
        owned.rows.length !== routineIds.length ||
        routineIds.some((id) => !owned.rows.some((routine) => routine.id === id))
      ) {
        await client.query("ROLLBACK");
        return false;
      }
      for (const [sortOrder, routineId] of routineIds.entries()) {
        await client.query("UPDATE routines SET sort_order = $3 WHERE user_id = $1 AND id = $2", [
          userId,
          routineId,
          sortOrder,
        ]);
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createWorkoutSession(
    userId: string,
    input: WorkoutSessionCreateInput,
  ): Promise<WorkoutSession> {
    const result = await this.pool.query<WorkoutRow>(
      "INSERT INTO workout_sessions (user_id, sport, started_at, ended_at, perceived_exertion, notes, metrics, source, route_points) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb) RETURNING *",
      [
        userId,
        input.sport,
        input.startedAt,
        input.endedAt,
        input.perceivedExertion,
        input.notes ?? null,
        JSON.stringify(input.metrics),
        input.source,
        JSON.stringify(input.routePoints ?? []),
      ],
    );
    return this.mapWorkout(result.rows[0]!);
  }

  async listWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
    const result = await this.pool.query<WorkoutRow>(
      "SELECT * FROM workout_sessions WHERE user_id = $1 ORDER BY started_at DESC",
      [userId],
    );
    return result.rows.map((row) => this.mapWorkout(row));
  }

  async updateWorkoutSession(
    userId: string,
    workoutId: string,
    input: WorkoutSessionUpdateInput,
  ): Promise<WorkoutSession | null> {
    const hasNotes = Object.prototype.hasOwnProperty.call(input, "notes");
    const result = await this.pool.query<WorkoutRow>(
      "UPDATE workout_sessions SET notes = CASE WHEN $3::boolean THEN $4 ELSE notes END, perceived_exertion = COALESCE($5, perceived_exertion), metrics = COALESCE($6::jsonb, metrics) WHERE user_id = $1 AND id = $2 RETURNING *",
      [
        userId,
        workoutId,
        hasNotes,
        input.notes ?? null,
        input.perceivedExertion ?? null,
        input.metrics === undefined ? null : JSON.stringify(input.metrics),
      ],
    );
    const row = result.rows[0];
    return row ? this.mapWorkout(row) : null;
  }

  async deleteWorkoutSession(userId: string, workoutId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM workout_sessions WHERE user_id = $1 AND id = $2 RETURNING id",
      [userId, workoutId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listSharingCrews(userId: string): Promise<SharingCrew[]> {
    const result = await this.pool.query<SharingCrew & QueryResultRow>(
      'SELECT id, user_id AS "userId", name, member_ids AS "memberIds" FROM sharing_crews WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows;
  }
  async createSharingCrew(
    userId: string,
    input: SharingCrewCreateInput,
  ): Promise<SharingCrew | null> {
    const ids = [...new Set(input.memberIds)];
    const eligible = await this.pool.query(
      "SELECT id FROM users WHERE id = ANY($1::uuid[]) AND id <> $2 AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $2 AND blocked_id = users.id) OR (blocker_id = users.id AND blocked_id = $2))",
      [ids, userId],
    );
    if (eligible.rows.length !== ids.length) return null;
    const result = await this.pool.query<SharingCrew & QueryResultRow>(
      'INSERT INTO sharing_crews (user_id, name, member_ids) VALUES ($1, $2, $3) RETURNING id, user_id AS "userId", name, member_ids AS "memberIds"',
      [userId, input.name, ids],
    );
    return result.rows[0] ?? null;
  }
  private async postRelation(authorId: string, viewerId?: string) {
    const [viewerFollowsAuthor, authorFollowsViewer] = viewerId
      ? await Promise.all([
          this.isFollowing(viewerId, authorId),
          this.isFollowing(authorId, viewerId),
        ])
      : [false, false];
    return { authorId, viewerId, viewerFollowsAuthor, authorFollowsViewer };
  }
  private async postVisible(row: PostRow, viewerId?: string) {
    return (
      !row.archived_at &&
      storyIsActive(this.mapPost(row, [])) &&
      (await this.canViewContent(row.user_id, viewerId)) &&
      audienceAllows(row.audience, await this.postRelation(row.user_id, viewerId))
    );
  }
  private async presentPost(row: PostRow, comments: CommentRow[], viewerId?: string) {
    const liked = viewerId
      ? await this.pool.query("SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2", [
          row.id,
          viewerId,
        ])
      : null;
    return presentPostAccess(
      { ...this.mapPost(row, comments), likedByMe: Boolean(liked?.rowCount) },
      await this.postRelation(row.user_id, viewerId),
    );
  }

  async createPost(
    userId: string,
    authorDisplayName: string,
    input: PostCreateInput,
  ): Promise<FeedPost | null> {
    const result = await this.pool.query<PostRow>(
      "WITH inserted AS (INSERT INTO posts (user_id, sport, content, workout_session_id, media_id, content_type, audience, comment_audience) SELECT $1, $2, $3, $4, $5, $6, $8::jsonb, $9::jsonb WHERE ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM workout_sessions WHERE id = $4 AND user_id = $1)) AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM media_objects WHERE id = $5 AND user_id = $1 AND status = 'available')) RETURNING *) SELECT i.id, i.user_id, $7::text AS display_name, u.avatar_data_uri, i.sport, i.content, i.workout_session_id, i.media_id, mo.object_path AS media_object_path, i.content_type, i.audience, i.comment_audience, i.like_count, i.archived_at, i.created_at FROM inserted i JOIN users u ON u.id = i.user_id LEFT JOIN media_objects mo ON mo.id = i.media_id",
      [
        userId,
        input.sport,
        input.content,
        input.workoutSessionId ?? null,
        input.mediaId ?? null,
        input.contentType ?? "post",
        authorDisplayName,
        JSON.stringify(resolveCrewAudience(input.audience, await this.listSharingCrews(userId))),
        JSON.stringify(
          resolveCrewAudience(input.commentAudience, await this.listSharingCrews(userId)),
        ),
      ],
    );
    const row = result.rows[0];
    return row ? this.presentPost(row, [], userId) : null;
  }

  async listFeed(viewerId?: string, postId?: string): Promise<FeedPost[]> {
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.media_id, mo.object_path AS media_object_path, p.content_type, p.audience, p.comment_audience, p.like_count, (SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id = p.id) AS share_count, p.archived_at, p.created_at FROM posts p JOIN users u ON u.id = p.user_id LEFT JOIN media_objects mo ON mo.id = p.media_id WHERE ($2::uuid IS NULL OR p.id = $2) AND p.moderation_status = 'visible' AND p.archived_at IS NULL AND ($1::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $1))) ORDER BY p.created_at DESC LIMIT 100",
      [viewerId ?? null, postId ?? null],
    );
    if (posts.rows.length === 0) return [];
    const visibility = await Promise.all(
      posts.rows.map((post) => this.postVisible(post, viewerId)),
    );
    posts.rows = posts.rows.filter((_, index) => visibility[index]);
    const comments = await this.listPostComments(
      posts.rows.map((post) => post.id),
      viewerId,
    );

    return Promise.all(
      posts.rows.map((post) =>
        this.presentPost(
          post,
          comments.filter((comment) => comment.post_id === post.id),
          viewerId,
        ),
      ),
    );
  }

  async listPostsByUser(userId: string, viewerId = userId): Promise<FeedPost[]> {
    if (!(await this.canViewContent(userId, viewerId))) return [];
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.media_id, mo.object_path AS media_object_path, p.content_type, p.audience, p.comment_audience, p.like_count, (SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id = p.id) AS share_count, p.archived_at, p.created_at FROM posts p JOIN users u ON u.id = p.user_id LEFT JOIN media_objects mo ON mo.id = p.media_id WHERE p.user_id = $1 AND p.moderation_status = 'visible' AND p.archived_at IS NULL ORDER BY p.created_at DESC LIMIT 100",
      [userId],
    );
    if (posts.rows.length === 0) return [];
    const visibility = await Promise.all(
      posts.rows.map((post) => this.postVisible(post, viewerId)),
    );
    posts.rows = posts.rows.filter((_, index) => visibility[index]);
    const comments = await this.listPostComments(
      posts.rows.map((post) => post.id),
      viewerId,
    );
    return Promise.all(
      posts.rows.map((post) =>
        this.presentPost(
          post,
          comments.filter((comment) => comment.post_id === post.id),
          viewerId,
        ),
      ),
    );
  }

  async listArchivedPostsByUser(userId: string): Promise<FeedPost[]> {
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.media_id, mo.object_path AS media_object_path, p.content_type, p.audience, p.comment_audience, p.like_count, (SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id = p.id) AS share_count, p.archived_at, p.created_at FROM posts p JOIN users u ON u.id = p.user_id LEFT JOIN media_objects mo ON mo.id = p.media_id WHERE p.user_id = $1 AND p.archived_at IS NOT NULL ORDER BY p.archived_at DESC LIMIT 100",
      [userId],
    );
    if (posts.rows.length === 0) return [];
    const comments = await this.listPostComments(
      posts.rows.map((post) => post.id),
      userId,
    );
    return posts.rows.map((post) =>
      this.mapPost(
        post,
        comments.filter((comment) => comment.post_id === post.id),
      ),
    );
  }

  async updatePost(
    userId: string,
    postId: string,
    input: PostUpdateInput,
  ): Promise<FeedPost | null> {
    const result = await this.pool.query<PostRow>(
      "UPDATE posts p SET content = $3 FROM users u WHERE p.id = $2 AND p.user_id = $1 AND u.id = p.user_id RETURNING p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.media_id, (SELECT object_path FROM media_objects WHERE id = p.media_id) AS media_object_path, p.content_type, p.audience, p.comment_audience, p.like_count, p.archived_at, p.created_at",
      [userId, postId, input.content],
    );
    return result.rows[0] ? this.mapPost(result.rows[0], []) : null;
  }

  async setPostArchived(
    userId: string,
    postId: string,
    archived: boolean,
  ): Promise<FeedPost | null> {
    const result = await this.pool.query<PostRow>(
      "UPDATE posts p SET archived_at = CASE WHEN $3::boolean THEN now() ELSE NULL END FROM users u WHERE p.id = $2 AND p.user_id = $1 AND u.id = p.user_id RETURNING p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.media_id, (SELECT object_path FROM media_objects WHERE id = p.media_id) AS media_object_path, p.content_type, p.audience, p.comment_audience, p.like_count, p.archived_at, p.created_at",
      [userId, postId, archived],
    );
    return result.rows[0] ? this.mapPost(result.rows[0], []) : null;
  }

  async deletePost(userId: string, postId: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM posts WHERE id = $2 AND user_id = $1", [
      userId,
      postId,
    ]);
    return result.rowCount === 1;
  }

  async followUser(followerId: string, followingId: string): Promise<boolean> {
    if (followerId === followingId) return false;
    const result = await this.pool.query(
      "INSERT INTO follows (follower_id, following_id) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM users WHERE id = $2) AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)) ON CONFLICT DO NOTHING RETURNING following_id",
      [followerId, followingId],
    );
    return result.rowCount === 1 || (await this.isFollowing(followerId, followingId));
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await this.pool.query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [
      followerId,
      followingId,
    ]);
  }

  async removeFollower(userId: string, followerId: string): Promise<void> {
    await this.pool.query("DELETE FROM follows WHERE follower_id = $2 AND following_id = $1", [
      userId,
      followerId,
    ]);
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (blockerId === blockedId) return false;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "INSERT INTO user_blocks (blocker_id, blocked_id) SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM users WHERE id = $2) ON CONFLICT DO NOTHING RETURNING blocked_id",
        [blockerId, blockedId],
      );
      await client.query(
        "DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)",
        [blockerId, blockedId],
      );
      await client.query("COMMIT");
      return result.rowCount === 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async canViewContent(ownerId: string, viewerId?: string): Promise<boolean> {
    if (ownerId === viewerId) return true;
    const result = await this.pool.query(
      `SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM user_restrictions WHERE owner_id = $1 AND ($2::uuid IS NULL OR restricted_id = $2))
       AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1))`,
      [ownerId, viewerId ?? null],
    );
    return result.rowCount === 1;
  }

  async unblockUser(userId: string, targetId: string): Promise<void> {
    await this.pool.query("DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2", [
      userId,
      targetId,
    ]);
  }

  async restrictUser(userId: string, targetId: string, restricted: boolean): Promise<boolean> {
    if (userId === targetId || !(await this.findUserById(targetId))) return false;
    if (restricted)
      await this.pool.query(
        "INSERT INTO user_restrictions (owner_id, restricted_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, targetId],
      );
    else
      await this.pool.query(
        "DELETE FROM user_restrictions WHERE owner_id = $1 AND restricted_id = $2",
        [userId, targetId],
      );
    return true;
  }

  async saveSocialPrivacy(
    userId: string,
    privacy: import("@moveall/contracts").SocialPrivacy,
  ): Promise<void> {
    await this.pool.query(
      "INSERT INTO social_privacy (user_id, hide_followers, hide_following) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET hide_followers = EXCLUDED.hide_followers, hide_following = EXCLUDED.hide_following",
      [userId, privacy.hideFollowers, privacy.hideFollowing],
    );
  }

  async safetySummary(userId: string): Promise<import("@moveall/contracts").SafetySummary> {
    const [privacy, blocked, restricted] = await Promise.all([
      this.pool.query(
        'SELECT hide_followers AS "hideFollowers", hide_following AS "hideFollowing" FROM social_privacy WHERE user_id = $1',
        [userId],
      ),
      this.pool.query<PublicUser>(
        'SELECT u.id, u.display_name AS "displayName" FROM user_blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1',
        [userId],
      ),
      this.pool.query<PublicUser>(
        'SELECT u.id, u.display_name AS "displayName" FROM user_restrictions r JOIN users u ON u.id = r.restricted_id WHERE r.owner_id = $1',
        [userId],
      ),
    ]);
    return {
      hideFollowers: false,
      hideFollowing: false,
      ...privacy.rows[0],
      blocked: blocked.rows,
      restricted: restricted.rows,
    };
  }

  async createContentReport(
    reporterId: string,
    input: ContentReportCreateInput,
  ): Promise<ContentReport> {
    const result = await this.pool.query<ContentReportRow>(
      "INSERT INTO content_reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (reporter_id, target_type, target_id) DO UPDATE SET reason = EXCLUDED.reason, details = EXCLUDED.details, status = 'open', resolution_note = NULL, updated_at = now() RETURNING *",
      [reporterId, input.targetType, input.targetId, input.reason, input.details ?? null],
    );
    return this.mapContentReport(result.rows[0]!);
  }

  async listContentReports(): Promise<ContentReport[]> {
    const result = await this.pool.query<ContentReportRow>(
      "SELECT * FROM content_reports ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, created_at DESC LIMIT 500",
    );
    return result.rows.map((row) => this.mapContentReport(row));
  }

  async updateContentReport(
    reportId: string,
    input: ModerationReportUpdateInput,
  ): Promise<ContentReport | null> {
    const result = await this.pool.query<ContentReportRow>(
      "UPDATE content_reports SET status = $2, resolution_note = $3, updated_at = now() WHERE id = $1 RETURNING *",
      [reportId, input.status, input.resolutionNote ?? null],
    );
    return result.rows[0] ? this.mapContentReport(result.rows[0]) : null;
  }

  async createNotification(
    userId: string,
    input: Omit<UserNotification, "id" | "readAt" | "createdAt">,
  ): Promise<UserNotification> {
    const result = await this.pool.query<NotificationRow>(
      "INSERT INTO notifications (user_id, kind, title, body, actor_id, resource_type, resource_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, kind, title, body, actor_id, resource_type, resource_id, read_at, created_at",
      [
        userId,
        input.kind,
        input.title,
        input.body,
        input.actorId ?? null,
        input.resourceType ?? null,
        input.resourceId ?? null,
      ],
    );
    return this.mapNotification(result.rows[0]!);
  }

  async listNotifications(userId: string): Promise<UserNotification[]> {
    const result = await this.pool.query<NotificationRow>(
      "SELECT id, kind, title, body, actor_id, resource_type, resource_id, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
      [userId],
    );
    return result.rows.map((row) => this.mapNotification(row));
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<UserNotification | null> {
    const result = await this.pool.query<NotificationRow>(
      "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2 RETURNING id, kind, title, body, actor_id, resource_type, resource_id, read_at, created_at",
      [notificationId, userId],
    );
    return result.rows[0] ? this.mapNotification(result.rows[0]) : null;
  }

  async registerPushDevice(
    userId: string,
    input: PushDeviceRegistrationInput,
  ): Promise<StoredPushDevice> {
    const result = await this.pool.query<PushDeviceRow>(
      "INSERT INTO push_devices (user_id, token, platform, device_name) VALUES ($1, $2, $3, $4) ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, device_name = EXCLUDED.device_name, updated_at = now() RETURNING id, user_id, token, platform, device_name, created_at, updated_at",
      [userId, input.token, input.platform, input.deviceName ?? null],
    );
    return this.mapPushDevice(result.rows[0]!);
  }

  async unregisterPushDevice(userId: string, token: string): Promise<void> {
    await this.pool.query("DELETE FROM push_devices WHERE user_id = $1 AND token = $2", [
      userId,
      token,
    ]);
  }

  async listPushDeviceTokens(userId: string): Promise<string[]> {
    const result = await this.pool.query<QueryResultRow & { token: string }>(
      "SELECT token FROM push_devices WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
    return result.rows.map((row) => row.token);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await this.pool.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2",
      [followerId, followingId],
    );
    return result.rowCount === 1;
  }

  async listFollowers(userId: string): Promise<PublicUser[]> {
    const result = await this.pool.query<QueryResultRow & PublicUser>(
      'SELECT u.id, u.display_name AS "displayName", u.avatar_data_uri AS "avatarDataUri" FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.following_id = $1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1)) ORDER BY f.created_at DESC',
      [userId],
    );
    return result.rows;
  }

  async listFollowing(userId: string): Promise<PublicUser[]> {
    const result = await this.pool.query<QueryResultRow & PublicUser>(
      'SELECT u.id, u.display_name AS "displayName", u.avatar_data_uri AS "avatarDataUri" FROM follows f JOIN users u ON u.id = f.following_id WHERE f.follower_id = $1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1)) ORDER BY f.created_at DESC',
      [userId],
    );
    return result.rows;
  }

  async listMessages(userId: string, peerId: string): Promise<DirectMessage[]> {
    const blocked = await this.pool.query(
      "SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)",
      [userId, peerId],
    );
    if (blocked.rowCount) return [];
    const result = await this.pool.query<MessageRow>(
      "SELECT id, sender_id, recipient_id, content, created_at FROM direct_messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY created_at DESC LIMIT 200",
      [userId, peerId],
    );
    const shares = await this.pool.query<MessageRow & { shared_post: DirectMessage["sharedPost"] }>(
      `SELECT 'share:' || ps.post_id || ':' || ps.sharer_id || ':' || ps.recipient_id AS id,
        ps.sharer_id AS sender_id, ps.recipient_id, ps.created_at, '피드를 공유했습니다.' AS content,
        CASE WHEN p.moderation_status = 'visible' AND p.archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM user_restrictions r WHERE r.owner_id = p.user_id AND r.restricted_id = $1)
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $1))
        THEN json_build_object('id', p.id, 'authorDisplayName', u.display_name, 'sport', p.sport, 'content', p.content)
        ELSE NULL END AS shared_post
        FROM post_shares ps JOIN posts p ON p.id = ps.post_id JOIN users u ON u.id = p.user_id
        WHERE (ps.sharer_id = $1 AND ps.recipient_id = $2) OR (ps.sharer_id = $2 AND ps.recipient_id = $1)
        ORDER BY ps.created_at DESC LIMIT 200`,
      [userId, peerId],
    );
    const allowedShares = await Promise.all(
      shares.rows.map(async (row) => ({
        ...row,
        shared_post:
          row.shared_post && (await this.listFeed(userId, row.shared_post.id))[0]
            ? row.shared_post
            : null,
      })),
    );
    return [
      ...result.rows.map((row) => this.mapMessage(row)),
      ...allowedShares.map((row) => ({
        ...this.mapMessage(row),
        sharedPost: row.shared_post ?? null,
      })),
    ]
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .slice(-200);
  }

  async createMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<DirectMessage | null> {
    const result = await this.pool.query<MessageRow>(
      "INSERT INTO direct_messages (sender_id, recipient_id, content) SELECT $1, $2, $3 WHERE $1 <> $2 AND EXISTS (SELECT 1 FROM users WHERE id = $2) AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)) RETURNING id, sender_id, recipient_id, content, created_at",
      [senderId, recipientId, content],
    );
    return result.rows[0] ? this.mapMessage(result.rows[0]) : null;
  }

  async createComment(
    userId: string,
    authorDisplayName: string,
    postId: string,
    content: string,
    parentCommentId?: string,
    mentions: import("@moveall/contracts").CommentMention[] = [],
  ): Promise<FeedPost["comments"][number] | null> {
    if (!(await this.listFeed(userId, postId))[0]?.canComment) return null;
    const result = await this.pool.query<CommentRow>(
      `INSERT INTO comments (post_id, user_id, content, parent_comment_id, mentions)
       SELECT p.id, $2, $3, $5::uuid, $6::jsonb FROM posts p
       WHERE p.id = $1 AND p.archived_at IS NULL AND p.moderation_status = 'visible'
         AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
           (b.blocker_id = $2 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $2))
         AND ($5::uuid IS NULL OR EXISTS (
           SELECT 1 FROM comments c WHERE c.id = $5 AND c.post_id = p.id
             AND c.parent_comment_id IS NULL AND c.moderation_status = 'visible'
             AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
               (b.blocker_id = $2 AND b.blocked_id = c.user_id) OR (b.blocker_id = c.user_id AND b.blocked_id = $2))))
       RETURNING id, user_id, $4::text AS display_name,
         (SELECT avatar_data_uri FROM users WHERE id = $2) AS avatar_data_uri,
         post_id, content, created_at, parent_comment_id, mentions, 0 AS like_count, false AS liked_by_me`,
      [
        postId,
        userId,
        content,
        authorDisplayName,
        parentCommentId ?? null,
        JSON.stringify(mentions),
      ],
    );
    const row = result.rows[0];
    return row ? this.mapComment(row) : null;
  }

  async setCommentLiked(userId: string, postId: string, commentId: string, liked: boolean) {
    if (
      !(await this.listFeed(userId, postId))[0]?.comments.some(
        (comment) => comment.id === commentId,
      )
    )
      return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Lock the comment to serialize likes and keep counts consistent with the returned state.
      const target = await client.query<CommentRow>(
        `SELECT c.*, u.display_name, u.avatar_data_uri FROM comments c
         JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id
         LEFT JOIN comments parent ON parent.id = c.parent_comment_id
         WHERE c.id = $1 AND p.id = $2 AND p.archived_at IS NULL
           AND p.moderation_status = 'visible' AND c.moderation_status = 'visible'
           AND (c.parent_comment_id IS NULL OR parent.moderation_status = 'visible')
           AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
             (b.blocker_id = $3 AND b.blocked_id IN (p.user_id, c.user_id, parent.user_id)) OR
             (b.blocked_id = $3 AND b.blocker_id IN (p.user_id, c.user_id, parent.user_id)))
         FOR UPDATE OF c`,
        [commentId, postId, userId],
      );
      const row = target.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return null;
      }
      if (liked) {
        await client.query(
          "INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [commentId, userId],
        );
      } else {
        await client.query("DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2", [
          commentId,
          userId,
        ]);
      }
      const count = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM comment_likes WHERE comment_id = $1",
        [commentId],
      );
      await client.query("COMMIT");
      return this.mapComment({ ...row, like_count: count.rows[0]!.count, liked_by_me: liked });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async listPostComments(postIds: string[], viewerId?: string): Promise<CommentRow[]> {
    const result = await this.pool.query<CommentRow>(
      `SELECT c.id, c.user_id, u.display_name, u.avatar_data_uri, c.post_id, c.content, c.mentions,
         c.created_at, c.parent_comment_id,
         (SELECT count(*)::int FROM comment_likes l WHERE l.comment_id = c.id) AS like_count,
         EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = $2) AS liked_by_me
       FROM comments c JOIN users u ON u.id = c.user_id
       LEFT JOIN comments parent ON parent.id = c.parent_comment_id
       WHERE c.post_id = ANY($1::uuid[]) AND c.moderation_status = 'visible'
         AND NOT EXISTS (SELECT 1 FROM user_restrictions r WHERE r.owner_id IN (c.user_id, parent.user_id) AND ($2::uuid IS NULL OR r.restricted_id = $2))
         AND (c.parent_comment_id IS NULL OR parent.moderation_status = 'visible')
         AND ($2::uuid IS NULL OR NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
           (b.blocker_id = $2 AND b.blocked_id IN (c.user_id, parent.user_id)) OR
           (b.blocked_id = $2 AND b.blocker_id IN (c.user_id, parent.user_id))))
       ORDER BY c.created_at ASC, c.id ASC`,
      [postIds, viewerId ?? null],
    );
    return result.rows;
  }

  async shareFrequency(userId: string): Promise<import("@moveall/contracts").ShareFrequency[]> {
    const result = await this.pool.query<{ userId: string; count: number; lastSharedAt: Date }>(
      'SELECT recipient_id AS "userId", count(*)::int AS count, max(created_at) AS "lastSharedAt" FROM post_shares WHERE sharer_id = $1 GROUP BY recipient_id',
      [userId],
    );
    return result.rows.map((row) => ({ ...row, lastSharedAt: row.lastSharedAt.toISOString() }));
  }

  async setPostLiked(
    userId: string,
    postId: string,
    liked: boolean,
  ): Promise<import("@moveall/contracts").PostLikeState | null> {
    if (!(await this.listFeed(userId, postId))[0]) return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const target = await client.query(
        "SELECT id FROM posts WHERE id = $1 AND archived_at IS NULL FOR UPDATE",
        [postId],
      );
      if (!target.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }
      const change = liked
        ? await client.query(
            "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [postId, userId],
          )
        : await client.query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [
            postId,
            userId,
          ]);
      const updated = await client.query<{ like_count: number }>(
        "UPDATE posts SET like_count = GREATEST(0, like_count + $2) WHERE id = $1 RETURNING like_count",
        [postId, change.rowCount ? (liked ? 1 : -1) : 0],
      );
      await client.query("COMMIT");
      return { liked, changed: Boolean(change.rowCount), likeCount: updated.rows[0]!.like_count };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async sharePost(
    userId: string,
    postId: string,
    selectedIds: string[],
  ): Promise<PostShareResult | null> {
    const visiblePost = (await this.listFeed(userId, postId))[0];
    if (
      !visiblePost ||
      (
        await Promise.all(
          selectedIds.map(async (id) => Boolean((await this.listFeed(id, postId))[0])),
        )
      ).some((visible) => !visible)
    )
      return null;
    const recipientIds = [...new Set(selectedIds)];
    if (!recipientIds.length) return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const source = await client.query<{ user_id: string }>(
        `SELECT p.user_id FROM posts p WHERE p.id = $2 AND p.moderation_status = 'visible' AND p.archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = $1)) FOR SHARE OF p`,
        [userId, postId],
      );
      if (!source.rows[0]) {
        await client.query("ROLLBACK");
        return null;
      }
      const eligible = await client.query<{ following_id: string }>(
        `SELECT f.following_id FROM follows f WHERE f.follower_id = $1 AND f.following_id = ANY($2::uuid[]) AND f.following_id <> $1
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
            (b.blocker_id = ANY(ARRAY[$1::uuid, $3::uuid]) AND b.blocked_id = f.following_id)
            OR (b.blocker_id = f.following_id AND b.blocked_id = ANY(ARRAY[$1::uuid, $3::uuid])))`,
        [userId, recipientIds, source.rows[0].user_id],
      );
      if (eligible.rows.length !== recipientIds.length) {
        await client.query("ROLLBACK");
        return null;
      }
      // One durable delivery per recipient; retries never duplicate a Tap Talk card.
      const sent = await client.query<{ recipient_id: string }>(
        "INSERT INTO post_shares (post_id, sharer_id, recipient_id) SELECT $2, $1, id FROM unnest($3::uuid[]) AS target(id) ON CONFLICT DO NOTHING RETURNING recipient_id",
        [userId, postId, recipientIds],
      );
      const count = await client.query<{ count: number }>(
        "SELECT count(DISTINCT sharer_id)::int AS count FROM post_shares WHERE post_id = $1",
        [postId],
      );
      await client.query("COMMIT");
      const sentIds = sent.rows.map((row) => row.recipient_id);
      return {
        shareCount: count.rows[0]?.count ?? 0,
        recipientCount: sentIds.length,
        recipientIds: sentIds,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listKnowledgeFeedback(articleId: string): Promise<KnowledgeFeedback[]> {
    const result = await this.pool.query<KnowledgeFeedbackRow>(
      "SELECT f.id, f.article_id, f.user_id, u.display_name, f.content, f.context, f.created_at FROM knowledge_feedback f JOIN users u ON u.id = f.user_id WHERE f.article_id = $1 AND f.moderation_status = 'visible' ORDER BY f.created_at DESC LIMIT 100",
      [articleId],
    );
    return result.rows.map((row) => this.mapKnowledgeFeedback(row));
  }

  async createKnowledgeFeedback(
    userId: string,
    authorDisplayName: string,
    articleId: string,
    input: KnowledgeFeedbackCreateInput,
  ): Promise<KnowledgeFeedback> {
    const result = await this.pool.query<KnowledgeFeedbackRow>(
      "INSERT INTO knowledge_feedback (article_id, user_id, content, context) VALUES ($1, $2, $3, $4) RETURNING id, article_id, user_id, $5::text AS display_name, content, context, created_at",
      [articleId, userId, input.content, input.context ?? null, authorDisplayName],
    );
    return this.mapKnowledgeFeedback(result.rows[0]!);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private mapUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarDataUri: row.avatar_data_uri,
      passwordHash: row.password_hash,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapAuthSession(row: AuthSessionRow): StoredAuthSession {
    return {
      id: row.id,
      userId: row.user_id,
      refreshTokenHash: row.refresh_token_hash,
      expiresAt: row.expires_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      revokedAt: row.revoked_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapConsent(row: ConsentRow): ConsentState {
    return {
      termsVersion: row.terms_version,
      privacyVersion: row.privacy_version,
      termsAccepted: row.terms_accepted as true,
      privacyAccepted: row.privacy_accepted as true,
      healthDataAccepted: row.health_data_accepted,
      locationAccepted: row.location_accepted,
      mediaAccepted: row.media_accepted,
      marketingAccepted: row.marketing_accepted,
      acceptedAt: row.accepted_at.toISOString(),
    };
  }

  private mapOnboarding(row: OnboardingRow): OnboardingProfile {
    return {
      ...(row.usage_purpose_recorded_at
        ? {
            usagePurpose: row.usage_purpose ?? null,
            usagePurposeRecordedAt: row.usage_purpose_recorded_at.toISOString(),
            usagePurposeQuestionVersion: row.usage_purpose_question_version ?? 1,
          }
        : {}),
      primarySports: row.primary_sports,
      activityLevel: row.activity_level,
      goals: row.goals,
      ...(row.neighborhood &&
      row.latitude !== null &&
      row.longitude !== null &&
      row.neighborhood_verified_at
        ? {
            neighborhood: {
              neighborhood: row.neighborhood,
              latitude: row.latitude,
              longitude: row.longitude,
              verifiedAt: row.neighborhood_verified_at.toISOString(),
            },
          }
        : {}),
      completedAt: row.completed_at.toISOString(),
    };
  }

  private mapMediaObject(row: MediaObjectRow): StoredMediaObject {
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      bucket: row.bucket,
      objectPath: row.object_path,
      kind: row.kind,
      contentType: row.content_type,
      byteSize: Number(row.byte_size),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapRoutine(row: RoutineRow): Routine {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      sport: row.sport,
      daysOfWeek: row.days_of_week,
      items: row.items,
      sortOrder: row.sort_order,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapWorkout(row: WorkoutRow): WorkoutSession {
    return {
      id: row.id,
      userId: row.user_id,
      sport: row.sport,
      startedAt: row.started_at.toISOString(),
      endedAt: row.ended_at.toISOString(),
      perceivedExertion: row.perceived_exertion,
      ...(row.notes ? { notes: row.notes } : {}),
      metrics: row.metrics,
      routePoints: row.route_points ?? [],
      source: row.source,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapPost(row: PostRow, comments: CommentRow[]): FeedPost {
    return {
      id: row.id,
      userId: row.user_id,
      authorDisplayName: row.display_name,
      ...(row.avatar_data_uri ? { authorAvatarDataUri: row.avatar_data_uri } : {}),
      sport: row.sport,
      content: row.content,
      contentType: row.content_type,
      audience: row.audience ?? { scope: "public" },
      commentAudience: row.comment_audience ?? { scope: "public" },
      likeCount: row.like_count,
      shareCount: Number(row.share_count ?? 0),
      ...(row.workout_session_id ? { workoutSessionId: row.workout_session_id } : {}),
      ...(row.media_id ? { mediaId: row.media_id } : {}),
      ...(row.media_object_path ? { mediaObjectPath: row.media_object_path } : {}),
      createdAt: row.created_at.toISOString(),
      ...(row.archived_at ? { archivedAt: row.archived_at.toISOString() } : {}),
      comments: comments.map((comment) => this.mapComment(comment)),
    };
  }

  private mapComment(row: CommentRow): FeedPost["comments"][number] {
    return {
      mentions: row.mentions ?? [],
      id: row.id,
      userId: row.user_id,
      authorDisplayName: row.display_name,
      ...(row.avatar_data_uri ? { authorAvatarDataUri: row.avatar_data_uri } : {}),
      content: row.content,
      ...(row.parent_comment_id ? { parentCommentId: row.parent_comment_id } : {}),
      likeCount: Number(row.like_count ?? 0),
      likedByMe: Boolean(row.liked_by_me),
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapKnowledgeFeedback(row: KnowledgeFeedbackRow): KnowledgeFeedback {
    return {
      id: row.id,
      articleId: row.article_id,
      userId: row.user_id,
      authorDisplayName: row.display_name,
      content: row.content,
      ...(row.context ? { context: row.context } : {}),
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapMessage(row: MessageRow): DirectMessage {
    return {
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      content: row.content,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapContentReport(row: ContentReportRow): ContentReport {
    return {
      id: row.id,
      reporterId: row.reporter_id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      ...(row.details ? { details: row.details } : {}),
      status: row.status,
      ...(row.resolution_note ? { resolutionNote: row.resolution_note } : {}),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapNotification(row: NotificationRow): UserNotification {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      ...(row.actor_id ? { actorId: row.actor_id } : {}),
      ...(row.resource_type ? { resourceType: row.resource_type } : {}),
      ...(row.resource_id ? { resourceId: row.resource_id } : {}),
      ...(row.read_at ? { readAt: row.read_at.toISOString() } : {}),
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapPushDevice(row: PushDeviceRow): StoredPushDevice {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      platform: row.platform,
      ...(row.device_name ? { deviceName: row.device_name } : {}),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
