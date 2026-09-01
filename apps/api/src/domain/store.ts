import type {
  AccountSession,
  ConsentState,
  ConsentUpdateInput,
  DirectMessage,
  FeedPost,
  KnowledgeFeedback,
  KnowledgeFeedbackCreateInput,
  MediaKind,
  PostCreateInput,
  PostShareResult,
  PostUpdateInput,
  ProfileUpdateInput,
  PublicUser,
  Routine,
  RoutineCreateInput,
  RoutineUpdateInput,
  WorkoutSession,
  WorkoutSessionCreateInput,
  WorkoutSessionUpdateInput,
} from "@moveall/contracts";

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatarDataUri: string | null;
  passwordHash: string | null;
  createdAt: string;
};

export type StoredAuthSession = Omit<AccountSession, "current"> & {
  userId: string;
  refreshTokenHash: string;
  revokedAt: string | null;
};

export type StoredMediaObject = {
  id: string;
  userId: string;
  provider: "supabase" | "r2";
  bucket: string;
  objectPath: string;
  kind: MediaKind;
  contentType: string;
  byteSize: number;
  status: "pending" | "available" | "deleting" | "deleted";
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
  updatePassword(userId: string, passwordHash: string): Promise<boolean>;
  deleteUserAccount(userId: string): Promise<boolean>;
  createAuthSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<StoredAuthSession>;
  findAuthSessionById(sessionId: string): Promise<StoredAuthSession | null>;
  findAuthSessionByRefreshTokenHash(refreshTokenHash: string): Promise<StoredAuthSession | null>;
  rotateAuthSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<StoredAuthSession | null>;
  revokeAuthSession(sessionId: string): Promise<void>;
  listAuthSessions(userId: string): Promise<StoredAuthSession[]>;
  getConsent(userId: string): Promise<ConsentState | null>;
  saveConsent(userId: string, input: ConsentUpdateInput): Promise<ConsentState>;
  createMediaObject(
    input: Omit<StoredMediaObject, "id" | "status" | "createdAt">,
  ): Promise<StoredMediaObject>;
  markMediaObjectAvailable(userId: string, mediaId: string): Promise<StoredMediaObject | null>;
  listMediaObjects(userId: string): Promise<StoredMediaObject[]>;
  createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine>;
  listRoutines(userId: string): Promise<Routine[]>;
  updateRoutine(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine | null>;
  deleteRoutine(userId: string, routineId: string): Promise<boolean>;
  reorderRoutines(userId: string, routineIds: string[]): Promise<boolean>;
  createWorkoutSession(userId: string, input: WorkoutSessionCreateInput): Promise<WorkoutSession>;
  listWorkoutSessions(userId: string): Promise<WorkoutSession[]>;
  updateWorkoutSession(
    userId: string,
    workoutId: string,
    input: WorkoutSessionUpdateInput,
  ): Promise<WorkoutSession | null>;
  deleteWorkoutSession(userId: string, workoutId: string): Promise<boolean>;
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
  sharePost(userId: string, postId: string): Promise<PostShareResult | null>;
  listKnowledgeFeedback(articleId: string): Promise<KnowledgeFeedback[]>;
  createKnowledgeFeedback(
    userId: string,
    authorDisplayName: string,
    articleId: string,
    input: KnowledgeFeedbackCreateInput,
  ): Promise<KnowledgeFeedback>;
  close(): Promise<void>;
}
