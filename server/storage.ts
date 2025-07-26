import {
  users,
  videos,
  likes,
  comments,
  follows,
  type User,
  type UpsertUser,
  type Video,
  type InsertVideo,
  type VideoWithUser,
  type Comment,
  type CommentWithUser,
  type InsertComment,
  type Like,
  type InsertLike,
  type Follow,
  type InsertFollow,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Video operations
  getVideos(userId?: string, limit?: number, offset?: number): Promise<VideoWithUser[]>;
  getVideo(id: string, userId?: string): Promise<VideoWithUser | undefined>;
  getUserVideos(userId: string, limit?: number, offset?: number): Promise<VideoWithUser[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  incrementViewCount(videoId: string): Promise<void>;
  getVideoByS3Key(s3Key: string): Promise<Video | undefined>;
  
  // Like operations
  likeVideo(userId: string, videoId: string): Promise<Like>;
  unlikeVideo(userId: string, videoId: string): Promise<void>;
  isVideoLiked(userId: string, videoId: string): Promise<boolean>;
  
  // Comment operations
  getComments(videoId: string, limit?: number, offset?: number): Promise<CommentWithUser[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  
  // Follow operations
  followUser(followerId: string, followingId: string): Promise<Follow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        username: userData.username || `user_${userData.id}`,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Video operations
  async getUserVideos(userId: string, limit = 50, offset = 0): Promise<VideoWithUser[]> {
    const result = await db
      .select({
        id: videos.id,
        userId: videos.userId,
        title: videos.title,
        description: videos.description,
        videoUrl: videos.videoUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        viewCount: videos.viewCount,
        likeCount: videos.likeCount,
        commentCount: videos.commentCount,
        shareCount: videos.shareCount,
        musicTitle: videos.musicTitle,
        isPublic: videos.isPublic,
        createdAt: videos.createdAt,
        updatedAt: videos.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          username: users.username,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        likes: sql<any[]>`'[]'::json`,
        comments: sql<any[]>`'[]'::json`,
        isLiked: sql<boolean>`false`,
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .where(and(eq(videos.userId, userId), eq(videos.isPublic, true)))
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);

    return result as VideoWithUser[];
  }

  async getVideos(userId?: string, limit = 20, offset = 0): Promise<VideoWithUser[]> {
    const videosWithUsers = await db
      .select({
        video: videos,
        user: users,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.isPublic, true))
      .orderBy(desc(videos.createdAt))
      .limit(limit)
      .offset(offset);

    const result: VideoWithUser[] = [];

    for (const { video, user } of videosWithUsers) {
      if (!user) continue;

      const videoLikes = await db
        .select()
        .from(likes)
        .where(eq(likes.videoId, video.id));

      const videoComments = await db
        .select()
        .from(comments)
        .where(eq(comments.videoId, video.id));

      let isLiked = false;
      if (userId) {
        isLiked = await this.isVideoLiked(userId, video.id);
      }

      result.push({
        ...video,
        user,
        likes: videoLikes,
        comments: videoComments,
        isLiked,
      });
    }

    return result;
  }

  async getVideo(id: string, userId?: string): Promise<VideoWithUser | undefined> {
    const [result] = await db
      .select({
        video: videos,
        user: users,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.id, id));

    if (!result?.video || !result?.user) return undefined;

    const videoLikes = await db
      .select()
      .from(likes)
      .where(eq(likes.videoId, result.video.id));

    const videoComments = await db
      .select()
      .from(comments)
      .where(eq(comments.videoId, result.video.id));

    let isLiked = false;
    if (userId) {
      isLiked = await this.isVideoLiked(userId, result.video.id);
    }

    return {
      ...result.video,
      user: result.user,
      likes: videoLikes,
      comments: videoComments,
      isLiked,
    };
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db
      .insert(videos)
      .values(video)
      .returning();
    return newVideo;
  }

  async incrementViewCount(videoId: string): Promise<void> {
    await db
      .update(videos)
      .set({
        viewCount: sql`${videos.viewCount} + 1`,
      })
      .where(eq(videos.id, videoId));
  }

  async getVideoByS3Key(s3Key: string): Promise<Video | undefined> {
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.s3Key, s3Key));
    return video;
  }

  // Like operations
  async likeVideo(userId: string, videoId: string): Promise<Like> {
    const [like] = await db
      .insert(likes)
      .values({ userId, videoId })
      .returning();

    // Update like count
    await db
      .update(videos)
      .set({
        likeCount: sql`${videos.likeCount} + 1`,
      })
      .where(eq(videos.id, videoId));

    return like;
  }

  async unlikeVideo(userId: string, videoId: string): Promise<void> {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.videoId, videoId)));

    // Update like count
    await db
      .update(videos)
      .set({
        likeCount: sql`${videos.likeCount} - 1`,
      })
      .where(eq(videos.id, videoId));
  }

  async isVideoLiked(userId: string, videoId: string): Promise<boolean> {
    const [like] = await db
      .select()
      .from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.videoId, videoId)));
    return !!like;
  }

  // Comment operations
  async getComments(videoId: string, limit = 50, offset = 0): Promise<CommentWithUser[]> {
    const commentsWithUsers = await db
      .select({
        comment: comments,
        user: users,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.videoId, videoId))
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);

    return commentsWithUsers
      .filter(({ user }) => user)
      .map(({ comment, user }) => ({
        ...comment,
        user: user!,
      }));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db
      .insert(comments)
      .values(comment)
      .returning();

    // Update comment count
    await db
      .update(videos)
      .set({
        commentCount: sql`${videos.commentCount} + 1`,
      })
      .where(eq(videos.id, comment.videoId));

    return newComment;
  }

  // Follow operations
  async followUser(followerId: string, followingId: string): Promise<Follow> {
    const [follow] = await db
      .insert(follows)
      .values({ followerId, followingId })
      .returning();
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    return !!follow;
  }
}

export const storage = new DatabaseStorage();
