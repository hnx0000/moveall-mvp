import type {
  FeedPost,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  PostCreateInput,
  Routine,
  RoutineCreateInput,
  SportType,
  WorkoutSession,
  WorkoutSessionCreateInput,
} from "@moveall/contracts";
import { Pool, type QueryResultRow } from "pg";
import type { AppStore, User } from "../domain/store.js";

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: Date;
};

type RoutineRow = QueryResultRow & {
  id: string;
  user_id: string;
  title: string;
  sport: SportType;
  days_of_week: number[];
  items: Routine["items"];
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
  sport: SportType;
  content: string;
  workout_session_id: string | null;
  created_at: Date;
};

type CommentRow = QueryResultRow & {
  id: string;
  user_id: string;
  display_name: string;
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
      "SELECT id, email, display_name, password_hash, created_at FROM users WHERE id = $1",
      [id],
    );
    const row = result.rows[0];
    return row ? this.mapUser(row) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      "SELECT id, email, display_name, password_hash, created_at FROM users WHERE email = $1",
      [email],
    );
    const row = result.rows[0];
    return row ? this.mapUser(row) : null;
  }

  async createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const result = await this.pool.query<UserRow>(
      "INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name, password_hash, created_at",
      [input.email, input.displayName, input.passwordHash],
    );
    return this.mapUser(result.rows[0]!);
  }

  async createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine> {
    const result = await this.pool.query<RoutineRow>(
      "INSERT INTO routines (user_id, title, sport, days_of_week, items) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *",
      [userId, input.title, input.sport, input.daysOfWeek, JSON.stringify(input.items)],
    );
    return this.mapRoutine(result.rows[0]!);
  }

  async listRoutines(userId: string): Promise<Routine[]> {
    const result = await this.pool.query<RoutineRow>(
      "SELECT * FROM routines WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map((row) => this.mapRoutine(row));
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

  async createPost(
    userId: string,
    authorDisplayName: string,
    input: PostCreateInput,
  ): Promise<FeedPost | null> {
    const result = await this.pool.query<PostRow>(
      "INSERT INTO posts (user_id, sport, content, workout_session_id) SELECT $1, $2, $3, $4 WHERE $4::uuid IS NULL OR EXISTS (SELECT 1 FROM workout_sessions WHERE id = $4 AND user_id = $1) RETURNING id, user_id, $5::text AS display_name, sport, content, workout_session_id, created_at",
      [userId, input.sport, input.content, input.workoutSessionId ?? null, authorDisplayName],
    );
    const row = result.rows[0];
    return row ? this.mapPost(row, []) : null;
  }

  async listFeed(): Promise<FeedPost[]> {
    const posts = await this.pool.query<PostRow>(
      "SELECT p.id, p.user_id, u.display_name, p.sport, p.content, p.workout_session_id, p.created_at FROM posts p JOIN users u ON u.id = p.user_id WHERE p.moderation_status = 'visible' ORDER BY p.created_at DESC LIMIT 100",
    );
    if (posts.rows.length === 0) return [];

    const comments = await this.pool.query<CommentRow>(
      "SELECT c.id, c.user_id, u.display_name, c.post_id, c.content, c.created_at FROM comments c JOIN users u ON u.id = c.user_id WHERE c.moderation_status = 'visible' AND c.post_id = ANY($1::uuid[]) ORDER BY c.created_at ASC",
      [posts.rows.map((post) => post.id)],
    );

    return posts.rows.map((post) =>
      this.mapPost(
        post,
        comments.rows.filter((comment) => comment.post_id === post.id),
      ),
    );
  }

  async createComment(
    userId: string,
    authorDisplayName: string,
    postId: string,
    content: string,
  ): Promise<FeedPost["comments"][number] | null> {
    const result = await this.pool.query<CommentRow>(
      "INSERT INTO comments (post_id, user_id, content) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM posts WHERE id = $1) RETURNING id, user_id, $4::text AS display_name, post_id, content, created_at",
      [postId, userId, content, authorDisplayName],
    );
    const row = result.rows[0];
    return row ? this.mapComment(row) : null;
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
      sport: row.sport,
      content: row.content,
      ...(row.workout_session_id ? { workoutSessionId: row.workout_session_id } : {}),
      createdAt: row.created_at.toISOString(),
      comments: comments.map((comment) => this.mapComment(comment)),
    };
  }

  private mapComment(row: CommentRow): FeedPost["comments"][number] {
    return {
      id: row.id,
      userId: row.user_id,
      authorDisplayName: row.display_name,
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
}
