import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertVideoSchema, insertCommentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Video routes
  app.get('/api/videos', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.user?.claims?.sub;
      
      const videos = await storage.getVideos(userId, limit, offset);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get('/api/videos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      
      const video = await storage.getVideo(id, userId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.post('/api/videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoData = insertVideoSchema.parse({
        ...req.body,
        userId,
      });
      
      const video = await storage.createVideo(videoData);
      res.status(201).json(video);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      console.error("Error creating video:", error);
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.post('/api/videos/:id/view', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.incrementViewCount(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error incrementing view count:", error);
      res.status(500).json({ message: "Failed to increment view count" });
    }
  });

  // Like routes
  app.post('/api/videos/:id/like', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const isLiked = await storage.isVideoLiked(userId, id);
      
      if (isLiked) {
        await storage.unlikeVideo(userId, id);
        res.json({ liked: false });
      } else {
        await storage.likeVideo(userId, id);
        res.json({ liked: true });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Comment routes
  app.get('/api/videos/:id/comments', async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const comments = await storage.getComments(id, limit, offset);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post('/api/videos/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const commentData = insertCommentSchema.parse({
        ...req.body,
        userId,
        videoId: id,
      });
      
      const comment = await storage.createComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Follow routes
  app.post('/api/users/:id/follow', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const followerId = req.user.claims.sub;
      
      if (followerId === id) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }
      
      const isFollowing = await storage.isFollowing(followerId, id);
      
      if (isFollowing) {
        await storage.unfollowUser(followerId, id);
        res.json({ following: false });
      } else {
        await storage.followUser(followerId, id);
        res.json({ following: true });
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      res.status(500).json({ message: "Failed to toggle follow" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
