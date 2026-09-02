import { randomUUID } from "node:crypto";
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
  UserNotification,
  WorkoutSession,
  WorkoutSessionCreateInput,
  WorkoutSessionUpdateInput,
} from "@moveall/contracts";
import type {
  AppStore,
  StoredAuthSession,
  StoredMediaObject,
  StoredPushDevice,
  User,
} from "../domain/store.js";

export class MemoryStore implements AppStore {
  private readonly users = new Map<string, User>();
  private readonly routines: Routine[] = [];
  private readonly workouts: WorkoutSession[] = [];
  private readonly posts: FeedPost[] = [];
  private readonly commentLikes = new Map<string, Set<string>>();
  private readonly knowledgeFeedback: KnowledgeFeedback[] = [];

  async healthCheck(): Promise<void> {}
  private readonly oauthIdentities = new Map<string, string>();
  private readonly follows = new Set<string>();
  private readonly blocks = new Set<string>();
  private readonly messages: DirectMessage[] = [];
  private readonly postShares = new Map<
    string,
    {
      postId: string;
      sharerId: string;
      recipientId: string;
      createdAt: string;
    }
  >();
  private readonly authSessions = new Map<string, StoredAuthSession>();
  private readonly consents = new Map<string, ConsentState>();
  private readonly onboardingProfiles = new Map<string, OnboardingProfile>();
  private readonly mediaObjects = new Map<string, StoredMediaObject>();
  private readonly contentReports: ContentReport[] = [];
  private readonly notifications: Array<UserNotification & { userId: string }> = [];
  private readonly pushDevices: StoredPushDevice[] = [];

  constructor(options: { seedDemo?: boolean } = {}) {
    if (options.seedDemo) this.seedDemoFeed();
  }

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async isDisplayNameTaken(displayName: string, excludingUserId: string): Promise<boolean> {
    const normalized = displayName.toLocaleLowerCase("ko-KR");
    return [...this.users.values()].some(
      (user) =>
        user.id !== excludingUserId && user.displayName.toLocaleLowerCase("ko-KR") === normalized,
    );
  }

  async updateUserProfile(userId: string, input: ProfileUpdateInput): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const updated: User = {
      ...user,
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.avatarDataUri !== undefined ? { avatarDataUri: input.avatarDataUri } : {}),
    };
    this.users.set(userId, updated);
    if (input.displayName !== undefined) {
      for (const post of this.posts) {
        if (post.userId === userId) post.authorDisplayName = input.displayName;
        for (const comment of post.comments) {
          if (comment.userId === userId) comment.authorDisplayName = input.displayName;
        }
      }
    }
    return { ...updated };
  }

  async createUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const user: User = {
      id: randomUUID(),
      ...input,
      avatarDataUri: null,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async findOrCreateOAuthUser(input: {
    provider: "google" | "apple" | "kakao" | "naver";
    subject: string;
    email: string;
    displayName: string;
  }): Promise<User> {
    const identityKey = `${input.provider}:${input.subject}`;
    const linkedUserId = this.oauthIdentities.get(identityKey);
    if (linkedUserId) return this.users.get(linkedUserId)!;

    const existing = await this.findUserByEmail(input.email);
    const user =
      existing ??
      ({
        id: randomUUID(),
        email: input.email,
        displayName: input.displayName,
        avatarDataUri: null,
        passwordHash: null,
        createdAt: new Date().toISOString(),
      } satisfies User);
    this.users.set(user.id, user);
    this.oauthIdentities.set(identityKey, user.id);
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    this.users.set(userId, { ...user, passwordHash });
    for (const session of this.authSessions.values()) {
      if (session.userId === userId) session.revokedAt = new Date().toISOString();
    }
    return true;
  }

  async deleteUserAccount(userId: string): Promise<boolean> {
    if (!this.users.delete(userId)) return false;
    this.removeWhere(this.routines, (item) => item.userId === userId);
    this.removeWhere(this.workouts, (item) => item.userId === userId);
    this.removeWhere(this.posts, (item) => item.userId === userId);
    for (const post of this.posts) {
      const removedIds = new Set(
        post.comments.filter((item) => item.userId === userId).map((item) => item.id),
      );
      this.removeWhere(
        post.comments,
        (item) =>
          removedIds.has(item.id) ||
          Boolean(item.parentCommentId && removedIds.has(item.parentCommentId)),
      );
    }
    const remainingCommentIds = new Set(
      this.posts.flatMap((post) => post.comments.map((item) => item.id)),
    );
    for (const [commentId, likes] of this.commentLikes) {
      if (!remainingCommentIds.has(commentId)) this.commentLikes.delete(commentId);
      else likes.delete(userId);
    }
    for (const [key, share] of this.postShares) {
      if (
        share.sharerId === userId ||
        share.recipientId === userId ||
        !this.posts.some((post) => post.id === share.postId)
      )
        this.postShares.delete(key);
    }
    this.removeWhere(this.knowledgeFeedback, (item) => item.userId === userId);
    this.removeWhere(
      this.messages,
      (item) => item.senderId === userId || item.recipientId === userId,
    );
    this.removeWhere(this.contentReports, (item) => item.reporterId === userId);
    this.removeWhere(
      this.notifications,
      (item) => item.userId === userId || item.actorId === userId,
    );
    this.removeWhere(this.pushDevices, (item) => item.userId === userId);
    for (const [key, linkedUserId] of this.oauthIdentities) {
      if (linkedUserId === userId) this.oauthIdentities.delete(key);
    }
    for (const key of [...this.follows]) if (key.includes(userId)) this.follows.delete(key);
    for (const key of [...this.blocks]) if (key.includes(userId)) this.blocks.delete(key);
    for (const [id, session] of this.authSessions) {
      if (session.userId === userId) this.authSessions.delete(id);
    }
    for (const [id, media] of this.mediaObjects) {
      if (media.userId === userId) this.mediaObjects.delete(id);
    }
    this.consents.delete(userId);
    this.onboardingProfiles.delete(userId);
    return true;
  }

  async createAuthSession(input: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<StoredAuthSession> {
    const now = new Date().toISOString();
    const session: StoredAuthSession = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null,
    };
    this.authSessions.set(session.id, session);
    return { ...session };
  }

  async findAuthSessionById(sessionId: string): Promise<StoredAuthSession | null> {
    const session = this.authSessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async findAuthSessionByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<StoredAuthSession | null> {
    const session = [...this.authSessions.values()].find(
      (item) => item.refreshTokenHash === refreshTokenHash,
    );
    return session ? { ...session } : null;
  }

  async rotateAuthSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<StoredAuthSession | null> {
    const session = this.authSessions.get(input.sessionId);
    if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) return null;
    const updated = {
      ...session,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      lastSeenAt: new Date().toISOString(),
    };
    this.authSessions.set(session.id, updated);
    return { ...updated };
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    const session = this.authSessions.get(sessionId);
    if (session) session.revokedAt = new Date().toISOString();
  }

  async listAuthSessions(userId: string): Promise<StoredAuthSession[]> {
    return [...this.authSessions.values()]
      .filter((session) => session.userId === userId && !session.revokedAt)
      .map((session) => ({ ...session }));
  }

  async getConsent(userId: string): Promise<ConsentState | null> {
    return this.consents.get(userId) ?? null;
  }

  async saveConsent(userId: string, input: ConsentUpdateInput): Promise<ConsentState> {
    const consent = { ...input, acceptedAt: new Date().toISOString() };
    this.consents.set(userId, consent);
    return { ...consent };
  }

  async getOnboarding(userId: string): Promise<OnboardingProfile | null> {
    const profile = this.onboardingProfiles.get(userId);
    return profile ? structuredClone(profile) : null;
  }

  async saveOnboarding(userId: string, input: OnboardingInput): Promise<OnboardingProfile> {
    const profile: OnboardingProfile = {
      ...structuredClone(input),
      completedAt: new Date().toISOString(),
    };
    this.onboardingProfiles.set(userId, profile);
    return structuredClone(profile);
  }

  async createMediaObject(
    input: Omit<StoredMediaObject, "id" | "status" | "createdAt">,
  ): Promise<StoredMediaObject> {
    const media: StoredMediaObject = {
      ...input,
      id: randomUUID(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.mediaObjects.set(media.id, media);
    return { ...media };
  }

  async markMediaObjectAvailable(
    userId: string,
    mediaId: string,
  ): Promise<StoredMediaObject | null> {
    const media = this.mediaObjects.get(mediaId);
    if (!media || media.userId !== userId || media.status !== "pending") return null;
    media.status = "available";
    return { ...media };
  }

  async findMediaObject(userId: string, mediaId: string): Promise<StoredMediaObject | null> {
    const media = this.mediaObjects.get(mediaId);
    return media?.userId === userId ? { ...media } : null;
  }

  async listMediaObjects(userId: string): Promise<StoredMediaObject[]> {
    return [...this.mediaObjects.values()]
      .filter((media) => media.userId === userId && media.status !== "deleted")
      .map((media) => ({ ...media }));
  }

  async createRoutine(userId: string, input: RoutineCreateInput): Promise<Routine> {
    this.routines.forEach((routine) => {
      if (routine.userId === userId) routine.sortOrder += 1;
    });
    const routine: Routine = {
      id: randomUUID(),
      userId,
      ...input,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    };
    this.routines.push(routine);
    return routine;
  }

  async listRoutines(userId: string): Promise<Routine[]> {
    return this.routines
      .filter((routine) => routine.userId === userId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((routine) => ({ ...routine, items: routine.items.map((item) => ({ ...item })) }));
  }

  async updateRoutine(
    userId: string,
    routineId: string,
    input: RoutineUpdateInput,
  ): Promise<Routine | null> {
    const routine = this.routines.find((item) => item.id === routineId && item.userId === userId);
    if (!routine) return null;
    Object.assign(routine, input);
    return { ...routine, items: routine.items.map((item) => ({ ...item })) };
  }

  async deleteRoutine(userId: string, routineId: string): Promise<boolean> {
    const index = this.routines.findIndex(
      (routine) => routine.id === routineId && routine.userId === userId,
    );
    if (index < 0) return false;
    this.routines.splice(index, 1);
    const remaining = this.routines
      .filter((routine) => routine.userId === userId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    remaining.forEach((routine, sortOrder) => {
      routine.sortOrder = sortOrder;
    });
    return true;
  }

  async reorderRoutines(userId: string, routineIds: string[]): Promise<boolean> {
    const owned = this.routines.filter((routine) => routine.userId === userId);
    if (
      owned.length !== routineIds.length ||
      routineIds.some((id) => !owned.some((routine) => routine.id === id))
    ) {
      return false;
    }
    routineIds.forEach((id, sortOrder) => {
      const routine = owned.find((item) => item.id === id)!;
      routine.sortOrder = sortOrder;
    });
    return true;
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

  async listWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
    return this.workouts
      .filter((workout) => workout.userId === userId)
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .map((workout) => ({
        ...workout,
        metrics: { ...workout.metrics },
        ...(workout.routePoints
          ? { routePoints: workout.routePoints.map((point) => ({ ...point })) }
          : {}),
      }));
  }

  async updateWorkoutSession(
    userId: string,
    workoutId: string,
    input: WorkoutSessionUpdateInput,
  ): Promise<WorkoutSession | null> {
    const workout = this.workouts.find((item) => item.id === workoutId && item.userId === userId);
    if (!workout) return null;
    if (input.notes === null) delete workout.notes;
    else if (input.notes !== undefined) workout.notes = input.notes;
    if (input.perceivedExertion !== undefined) {
      workout.perceivedExertion = input.perceivedExertion;
    }
    if (input.metrics !== undefined) workout.metrics = { ...input.metrics };
    return { ...workout, metrics: { ...workout.metrics } };
  }

  async deleteWorkoutSession(userId: string, workoutId: string): Promise<boolean> {
    const index = this.workouts.findIndex(
      (workout) => workout.id === workoutId && workout.userId === userId,
    );
    if (index < 0) return false;
    this.workouts.splice(index, 1);
    return true;
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

    const media = input.mediaId ? this.mediaObjects.get(input.mediaId) : undefined;
    if (input.mediaId && (!media || media.userId !== userId || media.status !== "available")) {
      return null;
    }

    const post: FeedPost = {
      id: randomUUID(),
      userId,
      authorDisplayName,
      ...input,
      ...(media ? { mediaObjectPath: media.objectPath } : {}),
      contentType: input.contentType ?? "post",
      likeCount: 0,
      shareCount: 0,
      createdAt: new Date().toISOString(),
      comments: [],
    };
    this.posts.unshift(post);
    return this.clonePost(post);
  }

  async listFeed(viewerId?: string, postId?: string): Promise<FeedPost[]> {
    return this.posts
      .filter((post) => !postId || post.id === postId)
      .filter((post) => !post.archivedAt)
      .filter((post) => !viewerId || !this.isBlockedPair(viewerId, post.userId))
      .map((post) => {
        const cloned = this.clonePost(post, viewerId);
        if (viewerId) {
          cloned.comments = cloned.comments.filter(
            (comment) => !this.isBlockedPair(viewerId, comment.userId),
          );
        }
        const visibleIds = new Set(cloned.comments.map((comment) => comment.id));
        cloned.comments = cloned.comments.filter(
          (comment) => !comment.parentCommentId || visibleIds.has(comment.parentCommentId),
        );
        return cloned;
      });
  }

  async listPostsByUser(userId: string, viewerId = userId): Promise<FeedPost[]> {
    const feed = await this.listFeed(viewerId);
    return feed.filter((post) => post.userId === userId);
  }

  async listArchivedPostsByUser(userId: string): Promise<FeedPost[]> {
    return this.posts
      .filter((post) => post.userId === userId && post.archivedAt)
      .map((post) => this.clonePost(post, userId));
  }

  async updatePost(
    userId: string,
    postId: string,
    input: PostUpdateInput,
  ): Promise<FeedPost | null> {
    const post = this.posts.find((item) => item.id === postId && item.userId === userId);
    if (!post) return null;
    post.content = input.content;
    return this.clonePost(post);
  }

  async setPostArchived(
    userId: string,
    postId: string,
    archived: boolean,
  ): Promise<FeedPost | null> {
    const post = this.posts.find((item) => item.id === postId && item.userId === userId);
    if (!post) return null;
    if (archived) post.archivedAt = new Date().toISOString();
    else delete post.archivedAt;
    return this.clonePost(post);
  }

  async deletePost(userId: string, postId: string): Promise<boolean> {
    const index = this.posts.findIndex((item) => item.id === postId && item.userId === userId);
    if (index < 0) return false;
    for (const comment of this.posts[index]!.comments) this.commentLikes.delete(comment.id);
    this.posts.splice(index, 1);
    for (const [key, share] of this.postShares)
      if (share.postId === postId) this.postShares.delete(key);
    return true;
  }

  async followUser(followerId: string, followingId: string): Promise<boolean> {
    if (
      followerId === followingId ||
      !this.users.has(followingId) ||
      this.blocks.has(this.followKey(followerId, followingId)) ||
      this.blocks.has(this.followKey(followingId, followerId))
    )
      return false;
    this.follows.add(this.followKey(followerId, followingId));
    return true;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    this.follows.delete(this.followKey(followerId, followingId));
  }

  async removeFollower(userId: string, followerId: string): Promise<void> {
    this.follows.delete(this.followKey(followerId, userId));
  }

  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (blockerId === blockedId || !this.users.has(blockedId)) return false;
    this.blocks.add(this.followKey(blockerId, blockedId));
    this.follows.delete(this.followKey(blockerId, blockedId));
    this.follows.delete(this.followKey(blockedId, blockerId));
    return true;
  }

  private isBlockedPair(leftId: string, rightId: string): boolean {
    return (
      this.blocks.has(this.followKey(leftId, rightId)) ||
      this.blocks.has(this.followKey(rightId, leftId))
    );
  }

  async createContentReport(
    reporterId: string,
    input: ContentReportCreateInput,
  ): Promise<ContentReport> {
    const now = new Date().toISOString();
    const existing = this.contentReports.find(
      (report) =>
        report.reporterId === reporterId &&
        report.targetType === input.targetType &&
        report.targetId === input.targetId,
    );
    if (existing) {
      Object.assign(existing, input, {
        status: "open" as const,
        resolutionNote: undefined,
        updatedAt: now,
      });
      return { ...existing };
    }
    const report: ContentReport = {
      id: randomUUID(),
      reporterId,
      ...input,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.contentReports.push(report);
    return { ...report };
  }

  async listContentReports(): Promise<ContentReport[]> {
    return [...this.contentReports]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((report) => ({ ...report }));
  }

  async updateContentReport(
    reportId: string,
    input: ModerationReportUpdateInput,
  ): Promise<ContentReport | null> {
    const report = this.contentReports.find((candidate) => candidate.id === reportId);
    if (!report) return null;
    report.status = input.status;
    if (input.resolutionNote === undefined) {
      delete report.resolutionNote;
    } else {
      report.resolutionNote = input.resolutionNote;
    }
    report.updatedAt = new Date().toISOString();
    return { ...report };
  }

  async createNotification(
    userId: string,
    input: Omit<UserNotification, "id" | "readAt" | "createdAt">,
  ): Promise<UserNotification> {
    const notification: UserNotification = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push({ ...notification, userId });
    return { ...notification };
  }

  async listNotifications(userId: string): Promise<UserNotification[]> {
    return this.notifications
      .filter((notification) => notification.userId === userId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map(({ userId: _userId, ...notification }) => ({ ...notification }));
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<UserNotification | null> {
    const notification = this.notifications.find(
      (candidate) => candidate.id === notificationId && candidate.userId === userId,
    );
    if (!notification) return null;
    notification.readAt ??= new Date().toISOString();
    const { userId: _userId, ...result } = notification;
    return { ...result };
  }

  async registerPushDevice(
    userId: string,
    input: PushDeviceRegistrationInput,
  ): Promise<StoredPushDevice> {
    const now = new Date().toISOString();
    const existing = this.pushDevices.find((device) => device.token === input.token);
    if (existing) {
      existing.userId = userId;
      existing.platform = input.platform;
      if (input.deviceName === undefined) delete existing.deviceName;
      else existing.deviceName = input.deviceName;
      existing.updatedAt = now;
      return { ...existing };
    }
    const device: StoredPushDevice = {
      id: randomUUID(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.pushDevices.push(device);
    return { ...device };
  }

  async unregisterPushDevice(userId: string, token: string): Promise<void> {
    this.removeWhere(
      this.pushDevices,
      (device) => device.userId === userId && device.token === token,
    );
  }

  async listPushDeviceTokens(userId: string): Promise<string[]> {
    return this.pushDevices
      .filter((device) => device.userId === userId)
      .map((device) => device.token);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return this.follows.has(this.followKey(followerId, followingId));
  }

  async listFollowers(userId: string): Promise<PublicUser[]> {
    return this.listRelatedUsers(userId, "followers");
  }

  async listFollowing(userId: string): Promise<PublicUser[]> {
    return this.listRelatedUsers(userId, "following");
  }

  async listMessages(userId: string, peerId: string): Promise<DirectMessage[]> {
    if (this.isBlockedPair(userId, peerId)) return [];
    const shares: DirectMessage[] = [...this.postShares.entries()].map(([id, share]) => {
      const post = this.posts.find(
        (item) =>
          item.id === share.postId && !item.archivedAt && !this.isBlockedPair(userId, item.userId),
      );
      return {
        id: `share:${id}`,
        senderId: share.sharerId,
        recipientId: share.recipientId,
        content: "피드를 공유했습니다.",
        createdAt: share.createdAt,
        sharedPost: post
          ? {
              id: post.id,
              authorDisplayName: this.users.get(post.userId)?.displayName ?? post.authorDisplayName,
              sport: post.sport,
              content: post.content,
            }
          : null,
      };
    });
    return [...this.messages, ...shares]
      .filter(
        (message) =>
          (message.senderId === userId && message.recipientId === peerId) ||
          (message.senderId === peerId && message.recipientId === userId),
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .map((message) => ({ ...message }));
  }

  async createMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<DirectMessage | null> {
    if (
      senderId === recipientId ||
      !this.users.has(recipientId) ||
      this.blocks.has(this.followKey(senderId, recipientId)) ||
      this.blocks.has(this.followKey(recipientId, senderId))
    ) {
      return null;
    }
    const message: DirectMessage = {
      id: randomUUID(),
      senderId,
      recipientId,
      content,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(message);
    return { ...message };
  }

  async createComment(
    userId: string,
    authorDisplayName: string,
    postId: string,
    content: string,
    parentCommentId?: string,
  ): Promise<FeedPost["comments"][number] | null> {
    const post = this.posts.find(
      (candidate) =>
        candidate.id === postId &&
        !candidate.archivedAt &&
        !this.isBlockedPair(userId, candidate.userId),
    );
    if (!post) return null;
    if (parentCommentId) {
      const parent = post.comments.find((comment) => comment.id === parentCommentId);
      if (!parent || parent.parentCommentId || this.isBlockedPair(userId, parent.userId))
        return null;
    }

    const comment = {
      id: randomUUID(),
      userId,
      authorDisplayName,
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
      likeCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    return this.clonePost(post, userId).comments.find((item) => item.id === comment.id) ?? null;
  }

  async setCommentLiked(userId: string, postId: string, commentId: string, liked: boolean) {
    const post = (await this.listFeed(userId, postId))[0];
    const comment = post?.comments.find((item) => item.id === commentId);
    if (!comment) return null;
    const likes = this.commentLikes.get(commentId) ?? new Set<string>();
    if (liked) likes.add(userId);
    else likes.delete(userId);
    this.commentLikes.set(commentId, likes);
    return { ...comment, likeCount: likes.size, likedByMe: likes.has(userId) };
  }

  async sharePost(
    userId: string,
    postId: string,
    selectedIds: string[],
  ): Promise<PostShareResult | null> {
    const post = this.posts.find(
      (item) => item.id === postId && !item.archivedAt && !this.isBlockedPair(userId, item.userId),
    );
    const recipientIds = [...new Set(selectedIds)];
    if (
      !post ||
      !recipientIds.length ||
      recipientIds.some(
        (id) =>
          id === userId ||
          !this.users.has(id) ||
          !this.follows.has(this.followKey(userId, id)) ||
          this.isBlockedPair(userId, id) ||
          this.isBlockedPair(post.userId, id),
      )
    )
      return null;
    const sentIds = recipientIds.filter((id) => !this.postShares.has(`${postId}:${userId}:${id}`));
    sentIds.forEach((recipientId) =>
      this.postShares.set(`${postId}:${userId}:${recipientId}`, {
        postId,
        sharerId: userId,
        recipientId,
        createdAt: new Date().toISOString(),
      }),
    );
    const sharers = new Set(
      [...this.postShares.values()]
        .filter((share) => share.postId === postId)
        .map((share) => share.sharerId),
    );
    post.shareCount = sharers.size;
    return { shareCount: sharers.size, recipientCount: sentIds.length, recipientIds: sentIds };
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

  private removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (predicate(items[index]!)) items.splice(index, 1);
    }
  }

  private followKey(followerId: string, followingId: string): string {
    return `${followerId}:${followingId}`;
  }

  private listRelatedUsers(userId: string, direction: "followers" | "following"): PublicUser[] {
    const userIds = [...this.follows].flatMap((key) => {
      const [followerId, followingId] = key.split(":") as [string, string];
      if (direction === "followers" && followingId === userId) return [followerId];
      if (direction === "following" && followerId === userId) return [followingId];
      return [];
    });
    return userIds.flatMap((id) => {
      const user = this.users.get(id);
      if (
        !user ||
        this.blocks.has(this.followKey(userId, user.id)) ||
        this.blocks.has(this.followKey(user.id, userId))
      )
        return [];
      return [
        {
          id: user.id,
          displayName: user.displayName,
          ...(user.avatarDataUri ? { avatarDataUri: user.avatarDataUri } : {}),
        },
      ];
    });
  }

  private seedDemoFeed(): void {
    const now = Date.now();
    const demoUsers = [
      { id: randomUUID(), email: "minji@groov.demo", displayName: "새벽러너 민지" },
      { id: randomUUID(), email: "jun@groov.demo", displayName: "페이스메이커 준" },
      { id: randomUUID(), email: "doyun@groov.demo", displayName: "클라이머 도윤" },
      { id: randomUUID(), email: "yuna@groov.demo", displayName: "리프팅 유나" },
    ];
    for (const item of demoUsers) {
      this.users.set(item.id, {
        ...item,
        avatarDataUri: null,
        passwordHash: null,
        createdAt: new Date(now - 30 * 86_400_000).toISOString(),
      });
    }
    const [minji, jun, doyun, yuna] = demoUsers as [
      (typeof demoUsers)[number],
      (typeof demoUsers)[number],
      (typeof demoUsers)[number],
      (typeof demoUsers)[number],
    ];
    this.knowledgeFeedback.push(
      {
        id: randomUUID(),
        articleId: "running-easy-start",
        userId: minji.id,
        authorDisplayName: minji.displayName,
        content: "처음 2주는 3분 달리기와 2분 걷기를 번갈아 하니 무리 없이 이어갈 수 있었어요.",
        context: "러닝 입문 · 주 3회",
        createdAt: new Date(now - 42 * 60_000).toISOString(),
      },
      {
        id: randomUUID(),
        articleId: "hiking-ten-essentials",
        userId: doyun.id,
        authorDisplayName: doyun.displayName,
        content: "해가 짧은 계절에는 짧은 코스라도 휴대전화와 별도로 헤드램프를 챙깁니다.",
        context: "겨울 당일 산행",
        createdAt: new Date(now - 90 * 60_000).toISOString(),
      },
    );
    this.posts.push(
      {
        id: randomUUID(),
        userId: minji.id,
        authorDisplayName: minji.displayName,
        sport: "running",
        content: "한강 5K 이지런 완료. 기록보다 호흡에 집중하니 끝까지 편안했어요.",
        contentType: "post",
        likeCount: 42,
        createdAt: new Date(now - 18 * 60_000).toISOString(),
        comments: [
          {
            id: randomUUID(),
            userId: jun.id,
            authorDisplayName: jun.displayName,
            content: "꾸준한 이지런이 가장 강한 기반이에요!",
            likeCount: 0,
            likedByMe: false,
            createdAt: new Date(now - 12 * 60_000).toISOString(),
          },
        ],
      },
      {
        id: randomUUID(),
        userId: doyun.id,
        authorDisplayName: doyun.displayName,
        sport: "hiking",
        content: "주말 북한산 크루 준비 중입니다. 물과 보온 레이어를 꼭 챙겨요.",
        contentType: "story",
        likeCount: 28,
        createdAt: new Date(now - 64 * 60_000).toISOString(),
        comments: [],
      },
      {
        id: randomUUID(),
        userId: yuna.id,
        authorDisplayName: yuna.displayName,
        sport: "strength",
        content: "오늘은 중량보다 스쿼트 깊이와 무릎 궤적을 천천히 확인했습니다.",
        contentType: "post",
        likeCount: 35,
        createdAt: new Date(now - 3 * 60 * 60_000).toISOString(),
        comments: [],
      },
    );
  }

  private clonePost(post: FeedPost, viewerId?: string): FeedPost {
    const {
      authorAvatarDataUri: _storedAuthorAvatar,
      comments: storedComments,
      ...postWithoutAvatar
    } = post;
    const authorAvatar = this.users.get(post.userId)?.avatarDataUri;
    return {
      ...postWithoutAvatar,
      ...(authorAvatar ? { authorAvatarDataUri: authorAvatar } : {}),
      comments: storedComments.map((comment) => {
        const { authorAvatarDataUri: _storedCommentAvatar, ...commentWithoutAvatar } = comment;
        const commentAvatar = this.users.get(comment.userId)?.avatarDataUri;
        return {
          ...commentWithoutAvatar,
          likeCount: this.commentLikes.get(comment.id)?.size ?? 0,
          likedByMe: viewerId ? (this.commentLikes.get(comment.id)?.has(viewerId) ?? false) : false,
          ...(commentAvatar ? { authorAvatarDataUri: commentAvatar } : {}),
        };
      }),
    };
  }
}
