import type {
  DirectMessage,
  FeedPost,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  PostCreateInput,
  PostUpdateInput,
  ProfileUpdateInput,
  PublicUser,
  Routine,
  RoutineCreateInput,
  WorkoutSession,
  WorkoutSessionCreateInput,
} from "@moveall/contracts";

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarDataUri: string | null;
  passwordHash: string | null;
  createdAt: string;
};

export interface AppStore {
  findUserById(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  isDisplayNameTaken(displayName: string, excludingUserId: string): Promise<boolean>;
  updateUserProfile(userId: string, input: ProfileUpdateInput): Promise<User | null>;
  createUser(input: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  findOrCreateOAuthUser(input: {
    provider: "google";
    subject: string;
    email: string;
    displayName: string;
  }): Promise<User>;
  createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine>;
  listRoutines(userId: string): Promise<Routine[]>;
  createWorkoutSession(userId: string, input: WorkoutSessionCreateInput): Promise<WorkoutSession>;
  listWorkoutSessions(userId: string): Promise<WorkoutSession[]>;
  createPost(
    userId: string,
    authorDisplayName: string,
    input: PostCreateInput,
  ): Promise<FeedPost | null>;
  listFeed(): Promise<FeedPost[]>;
  listPostsByUser(userId: string): Promise<FeedPost[]>;
  listArchivedPostsByUser(userId: string): Promise<FeedPost[]>;
  updatePost(userId: string, postId: string, input: PostUpdateInput): Promise<FeedPost | null>;
  setPostArchived(userId: string, postId: string, archived: boolean): Promise<FeedPost | null>;
  deletePost(userId: string, postId: string): Promise<boolean>;
  followUser(followerId: string, followingId: string): Promise<boolean>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  removeFollower(userId: string, followerId: string): Promise<void>;
  blockUser(blockerId: string, blockedId: string): Promise<boolean>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  listFollowers(userId: string): Promise<PublicUser[]>;
  listFollowing(userId: string): Promise<PublicUser[]>;
  listMessages(userId: string, peerId: string): Promise<DirectMessage[]>;
  createMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<DirectMessage | null>;
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
