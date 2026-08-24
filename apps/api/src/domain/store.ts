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

export type User = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

export interface AppStore {
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  createUser(input: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine>;
  listRoutines(userId: string): Promise<Routine[]>;
  createWorkoutSession(userId: string, input: WorkoutSessionCreateInput): Promise<WorkoutSession>;
  createPost(
    userId: string,
    authorDisplayName: string,
    input: PostCreateInput,
  ): Promise<FeedPost | null>;
  listFeed(): Promise<FeedPost[]>;
  createComment(
    userId: string,
    authorDisplayName: string,
    postId: string,
    content: string,
  ): Promise<FeedPost["comments"][number] | null>;
  listKnowledgeFeedback(articleId: string): Promise<KnowledgeFeedback[]>;
  createKnowledgeFeedback(
    userId: string,
    authorDisplayName: string,
    articleId: string,
    input: KnowledgeFeedbackCreateInput,
  ): Promise<KnowledgeFeedback>;
  close(): Promise<void>;
}
