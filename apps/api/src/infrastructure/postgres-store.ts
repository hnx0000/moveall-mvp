import type {
  DirectMessage,
  FeedPost,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  PostCreateInput,
  PostShareResult,
  PostUpdateInput,
  ProfileUpdateInput,
  PublicUser,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput,
  SportType,
  WorkoutSession,
  WorkoutSessionCreateInput,
  WorkoutSessionUpdateInput,
} from "@moveall/contracts";
import { Pool, type QueryResultRow } from "pg";
import type { AppStore, User } from "../domain/store.js";

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
  content_type: "post" | "story";
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
  id: string;
  user_id: string;
  display_name: string;
  avatar_data_uri: string | null;
  post_id: string;
  content: string;
  created_at: Date;
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

export class PostgresStore implements AppStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
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
    provider: "google";
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
      "INSERT INTO workout_sessions (user_id, sport, started_at, ended_at, perceived_exertion, notes, metrics, source) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) RETURNING *",
      [
        userId,
        input.sport,
        input.startedAt,
        input.endedAt,
        input.perceivedExertion,
        input.notes ?? null,
        JSON.stringify(input.metrics),
        input.source,
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

  async createPost(
    userId: string,
    authorDisplayName: string,
    input: PostCreateInput,
  ): Promise<FeedPost | null> {
    const result = await this.pool.query<PostRow>(
      "INSERT INTO posts (user_id, sport, content, workout_session_id, content_type) SELECT $1, $2, $3, $4, $5 WHERE $4::uuid IS NULL OR EXISTS (SELECT 1 FROM workout_sessions WHERE id = $4 AND user_id = $1) RETURNING id, user_id, $6::text AS display_name, (SELECT avatar_data_uri FROM users WHERE id = $1) AS avatar_data_uri, sport, content, workout_session_id, content_type, like_count, archived_at, created_at",
      [
        userId,
        input.sport,
        input.content,
        input.workoutSessionId ?? null,
        input.contentType ?? "post",
        authorDisplayName,
      ],
    );
    const row = result.rows[0];
    return row ? this.mapPost(row, []) : null;
  }

  async listFeed(): Promise<FeedPost[]> {
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.content_type, p.like_count, (SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id = p.id) AS share_count, p.archived_at, p.created_at FROM posts p JOIN users u ON u.id = p.user_id WHERE p.moderation_status = 'visible' AND p.archived_at IS NULL ORDER BY p.created_at DESC LIMIT 100",
    );
    if (posts.rows.length === 0) return [];

    const comments = await this.pool.query<CommentRow>(
      "SELECT c.id, c.user_id, u.display_name, u.avatar_data_uri, c.post_id, c.content, c.created_at FROM comments c JOIN users u ON u.id = c.user_id WHERE c.moderation_status = 'visible' AND c.post_id = ANY($1::uuid[]) ORDER BY c.created_at ASC",
      [posts.rows.map((post) => post.id)],
    );

    return posts.rows.map((post) =>
      this.mapPost(
        post,
        comments.rows.filter((comment) => comment.post_id === post.id),
      ),
    );
  }

  async listPostsByUser(userId: string): Promise<FeedPost[]> {
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.content_type, p.like_count, (SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id = p.id) AS share_count, p.archived_at, p.created_at FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 AND p.moderation_status = 'visible' AND p.archived_at IS NULL ORDER BY p.created_at DESC LIMIT 100",
      [userId],
    );
    if (posts.rows.length === 0) return [];
    const comments = await this.pool.query<CommentRow>(
      "SELECT c.id, c.user_id, u.display_name, u.avatar_data_uri, c.post_id, c.content, c.created_at FROM comments c JOIN users u ON u.id = c.user_id WHERE c.moderation_status = 'visible' AND c.post_id = ANY($1::uuid[]) ORDER BY c.created_at ASC",
      [posts.rows.map((post) => post.id)],
    );
    return posts.rows.map((post) =>
      this.mapPost(
        post,
        comments.rows.filter((comment) => comment.post_id === post.id),
      ),
    );
  }

  async listArchivedPostsByUser(userId: string): Promise<FeedPost[]> {
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.content_type, p.like_count, (SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id = p.id) AS share_count, p.archived_at, p.created_at FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 AND p.archived_at IS NOT NULL ORDER BY p.archived_at DESC LIMIT 100",
      [userId],
    );
    if (posts.rows.length === 0) return [];
    const comments = await this.pool.query<CommentRow>(
      "SELECT c.id, c.user_id, u.display_name, u.avatar_data_uri, c.post_id, c.content, c.created_at FROM comments c JOIN users u ON u.id = c.user_id WHERE c.moderation_status = 'visible' AND c.post_id = ANY($1::uuid[]) ORDER BY c.created_at ASC",
      [posts.rows.map((post) => post.id)],
    );
    return posts.rows.map((post) =>
      this.mapPost(
        post,
        comments.rows.filter((comment) => comment.post_id === post.id),
      ),
    );
  }

  async updatePost(
    userId: string,
    postId: string,
    input: PostUpdateInput,
  ): Promise<FeedPost | null> {
    const result = await this.pool.query<PostRow>(
      "UPDATE posts p SET content = $3 FROM users u WHERE p.id = $2 AND p.user_id = $1 AND u.id = p.user_id RETURNING p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.content_type, p.like_count, p.archived_at, p.created_at",
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
      "UPDATE posts p SET archived_at = CASE WHEN $3::boolean THEN now() ELSE NULL END FROM users u WHERE p.id = $2 AND p.user_id = $1 AND u.id = p.user_id RETURNING p.id, p.user_id, u.display_name, u.avatar_data_uri, p.sport, p.content, p.workout_session_id, p.content_type, p.like_count, p.archived_at, p.created_at",
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
    const result = await this.pool.query<MessageRow>(
      "SELECT id, sender_id, recipient_id, content, created_at FROM direct_messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY created_at ASC LIMIT 200",
      [userId, peerId],
    );
    return result.rows.map((row) => this.mapMessage(row));
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
  ): Promise<FeedPost["comments"][number] | null> {
    const result = await this.pool.query<CommentRow>(
      "INSERT INTO comments (post_id, user_id, content) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM posts WHERE id = $1) RETURNING id, user_id, $4::text AS display_name, (SELECT avatar_data_uri FROM users WHERE id = $2) AS avatar_data_uri, post_id, content, created_at",
      [postId, userId, content, authorDisplayName],
    );
    const row = result.rows[0];
    return row ? this.mapComment(row) : null;
  }

  async sharePost(userId: string, postId: string): Promise<PostShareResult | null> {
    const exists = await this.pool.query(
      "SELECT 1 FROM posts WHERE id = $1 AND moderation_status = 'visible'",
      [postId],
    );
    if ((exists.rowCount ?? 0) === 0) return null;

    await this.pool.query(
      "INSERT INTO post_shares (post_id, sharer_id, recipient_id) SELECT $2, $1, following_id FROM follows WHERE follower_id = $1 AND following_id <> $1 ON CONFLICT DO NOTHING",
      [userId, postId],
    );
    const counts = await this.pool.query<QueryResultRow & PostShareResult>(
      'SELECT count(DISTINCT sharer_id)::int AS "shareCount", count(*) FILTER (WHERE sharer_id = $1)::int AS "recipientCount" FROM post_shares WHERE post_id = $2',
      [userId, postId],
    );
    return counts.rows[0] ?? { shareCount: 0, recipientCount: 0 };
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
      likeCount: row.like_count,
      shareCount: Number(row.share_count ?? 0),
      ...(row.workout_session_id ? { workoutSessionId: row.workout_session_id } : {}),
      createdAt: row.created_at.toISOString(),
      ...(row.archived_at ? { archivedAt: row.archived_at.toISOString() } : {}),
      comments: comments.map((comment) => this.mapComment(comment)),
    };
  }

  private mapComment(row: CommentRow): FeedPost["comments"][number] {
    return {
      id: row.id,
      userId: row.user_id,
      authorDisplayName: row.display_name,
      ...(row.avatar_data_uri ? { authorAvatarDataUri: row.avatar_data_uri } : {}),
      content: row.content,
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
}
