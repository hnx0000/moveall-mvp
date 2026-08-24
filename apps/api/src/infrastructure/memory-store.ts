import { randomUUID } from "node:crypto";
import type {
  FeedPost,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  PostCreateInput,
  Routine,
  RoutineCreateInput,
  WorkoutSession,
  WorkoutSessionCreateInput,
} from "@moveall/contracts";
import type { AppStore, User } from "../domain/store.js";

export class MemoryStore implements AppStore {
  private readonly users = new Map<string, User>();
  private readonly routines: Routine[] = [];
  private readonly workouts: WorkoutSession[] = [];
  private readonly posts: FeedPost[] = [];
  private readonly knowledgeFeedback: KnowledgeFeedback[] = [];

  constructor(options: { seedDemo?: boolean } = {}) {
    if (options.seedDemo) this.seedDemoFeed();
  }

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const user: User = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine> {
    const routine: Routine = {
      id: randomUUID(),
      userId,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.routines.push(routine);
    return routine;
  }

  async listRoutines(userId: string): Promise<Routine[]> {
    return this.routines.filter((routine) => routine.userId === userId);
  }

  async createWorkoutSession(
    userId: string,
    input: WorkoutSessionCreateInput,
  ): Promise<WorkoutSession> {
    const workout: WorkoutSession = {
      id: randomUUID(),
      userId,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.workouts.push(workout);
    return workout;
  }

  async createPost(
    userId: string,
    authorDisplayName: string,
    input: PostCreateInput,
  ): Promise<FeedPost | null> {
    if (
      input.workoutSessionId &&
      !this.workouts.some(
        (workout) => workout.id === input.workoutSessionId && workout.userId === userId,
      )
    ) {
      return null;
    }

    const post: FeedPost = {
      id: randomUUID(),
      userId,
      authorDisplayName,
      ...input,
      createdAt: new Date().toISOString(),
      comments: [],
    };
    this.posts.unshift(post);
    return post;
  }

  async listFeed(): Promise<FeedPost[]> {
    return this.posts.map((post) => ({
      ...post,
      comments: post.comments.map((comment) => ({ ...comment })),
    }));
  }

  async createComment(
    userId: string,
    authorDisplayName: string,
    postId: string,
    content: string,
  ): Promise<FeedPost["comments"][number] | null> {
    const post = this.posts.find((candidate) => candidate.id === postId);
    if (!post) return null;

    const comment = {
      id: randomUUID(),
      userId,
      authorDisplayName,
      content,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    return comment;
  }

  async listKnowledgeFeedback(articleId: string): Promise<KnowledgeFeedback[]> {
    return this.knowledgeFeedback
      .filter((feedback) => feedback.articleId === articleId)
      .map((feedback) => ({ ...feedback }));
  }

  async createKnowledgeFeedback(
    userId: string,
    authorDisplayName: string,
    articleId: string,
    input: KnowledgeFeedbackCreateInput,
  ): Promise<KnowledgeFeedback> {
    const feedback: KnowledgeFeedback = {
      id: randomUUID(),
      articleId,
      userId,
      authorDisplayName,
      content: input.content,
      ...(input.context ? { context: input.context } : {}),
      createdAt: new Date().toISOString(),
    };
    this.knowledgeFeedback.push(feedback);
    return feedback;
  }

  async close(): Promise<void> {}

  private seedDemoFeed(): void {
    const now = Date.now();
    this.knowledgeFeedback.push(
      {
        id: randomUUID(),
        articleId: "running-easy-start",
        userId: randomUUID(),
        authorDisplayName: "새벽러너 민지",
        content: "처음 2주는 3분 달리기와 2분 걷기를 번갈아 하니 무리 없이 이어갈 수 있었어요.",
        context: "러닝 입문 · 주 3회",
        createdAt: new Date(now - 42 * 60_000).toISOString(),
      },
      {
        id: randomUUID(),
        articleId: "hiking-ten-essentials",
        userId: randomUUID(),
        authorDisplayName: "클라이머 도윤",
        content: "해가 짧은 계절에는 짧은 코스라도 휴대전화와 별도로 헤드램프를 챙깁니다.",
        context: "겨울 당일 산행",
        createdAt: new Date(now - 90 * 60_000).toISOString(),
      },
    );
    this.posts.push(
      {
        id: randomUUID(),
        userId: randomUUID(),
        authorDisplayName: "새벽러너 민지",
        sport: "running",
        content: "한강 5K 이지런 완료. 기록보다 호흡에 집중하니 끝까지 편안했어요.",
        createdAt: new Date(now - 18 * 60_000).toISOString(),
        comments: [
          {
            id: randomUUID(),
            userId: randomUUID(),
            authorDisplayName: "페이스메이커 준",
            content: "꾸준한 이지런이 가장 강한 기반이에요!",
            createdAt: new Date(now - 12 * 60_000).toISOString(),
          },
        ],
      },
      {
        id: randomUUID(),
        userId: randomUUID(),
        authorDisplayName: "클라이머 도윤",
        sport: "hiking",
        content: "주말 북한산 크루 준비 중입니다. 물과 보온 레이어를 꼭 챙겨요.",
        createdAt: new Date(now - 64 * 60_000).toISOString(),
        comments: [],
      },
      {
        id: randomUUID(),
        userId: randomUUID(),
        authorDisplayName: "리프팅 유나",
        sport: "strength",
        content: "오늘은 중량보다 스쿼트 깊이와 무릎 궤적을 천천히 확인했습니다.",
        createdAt: new Date(now - 3 * 60 * 60_000).toISOString(),
        comments: [],
      },
    );
  }
}
