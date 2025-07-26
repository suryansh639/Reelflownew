import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertVideoSchema, insertCommentSchema } from "@shared/schema";
import { z } from "zod";
import { upload } from "./multer";
import { S3Service } from "./s3";
import { uploadDemoVideos } from "./uploadDemoVideos";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
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
      const userId = (req.user as any)?.claims?.sub;
      
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
      const userId = (req.user as any)?.claims?.sub;
      
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

  app.post('/api/videos', isAuthenticated, upload.single('video'), async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      
      let videoUrl: string;
      let s3Key: string | undefined;
      
      if (req.file) {
        // Upload file to S3
        console.log('Uploading video to S3...', {
          filename: req.file.originalname,
          size: `${(req.file.size / (1024 * 1024)).toFixed(2)}MB`,
          mimetype: req.file.mimetype
        });
        const s3Result = await S3Service.uploadVideo(req.file, userId);
        videoUrl = s3Result.url;
        s3Key = s3Result.key;
        console.log('S3 upload successful:', { url: videoUrl, key: s3Key });
      } else if (req.body.videoUrl) {
        // If URL was provided, use it directly
        videoUrl = req.body.videoUrl;
      } else {
        return res.status(400).json({ message: "No video file or URL provided" });
      }
      
      const videoData = insertVideoSchema.parse({
        title: req.body.title || 'Untitled Video',
        description: req.body.description || '',
        videoUrl,
        musicTitle: req.body.musicTitle || 'Original Sound',
        isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
        userId,
        ...(s3Key && { s3Key }),
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

  // Health check endpoint for S3 connection
  app.get('/api/health/s3', async (req, res) => {
    try {
      const isConnected = await S3Service.testConnection();
      res.json({ 
        s3Connected: isConnected,
        bucket: process.env.S3_BUCKET_NAME,
        region: process.env.AWS_REGION
      });
    } catch (error) {
      res.status(500).json({ 
        s3Connected: false, 
        error: 'S3 connection failed' 
      });
    }
  });

  // Configure S3 CORS
  app.post('/api/admin/configure-s3-cors', async (req, res) => {
    try {
      await S3Service.configureCORS();
      res.json({ message: 'S3 CORS configured successfully' });
    } catch (error) {
      console.error('Failed to configure CORS:', error);
      res.status(500).json({ message: 'Failed to configure S3 CORS' });
    }
  });

  // Get video URL (CloudFront or fallback)
  app.post('/api/get-video-url', async (req: any, res) => {
    try {
      const { s3Key, videoUrl } = req.body;
      
      if (!s3Key && !videoUrl) {
        return res.status(400).json({ message: "s3Key or videoUrl is required" });
      }
      
      // If we already have a video URL that's not from S3, return it
      if (videoUrl && videoUrl.startsWith('http') && !videoUrl.includes('s3.amazonaws.com')) {
        return res.json({ url: videoUrl });
      }
      
      // Use CloudFront URL for S3 videos
      if (s3Key) {
        const cloudFrontUrl = S3Service.getCloudFrontUrl(s3Key);
        console.log('Serving video via CloudFront:', cloudFrontUrl);
        return res.json({ url: cloudFrontUrl });
      }
      
      res.status(400).json({ message: "Unable to generate video URL" });
    } catch (error) {
      console.error("Error getting video URL:", error);
      res.status(500).json({ message: "Failed to get video URL" });
    }
  });

  // Generate presigned URL for direct frontend uploads
  app.post('/api/generate-presigned-url', isAuthenticated, async (req: any, res) => {
    try {
      const { fileName, fileType } = req.body;
      const userId = (req.user as any)?.claims?.sub;
      
      if (!fileName || !fileType) {
        return res.status(400).json({ message: "fileName and fileType are required" });
      }
      
      // Validate file type
      if (!fileType.startsWith('video/')) {
        return res.status(400).json({ message: "Only video files are allowed" });
      }
      
      const presignedData = await S3Service.getPresignedUploadUrl(fileName, fileType, userId);
      res.json(presignedData);
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      res.status(500).json({ message: "Failed to generate presigned URL" });
    }
  });

  // Save video metadata after direct S3 upload
  app.post('/api/videos/metadata', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      
      const videoData = insertVideoSchema.parse({
        title: req.body.title || 'Untitled Video',
        description: req.body.description || '',
        videoUrl: req.body.videoUrl,
        musicTitle: req.body.musicTitle || 'Original Sound',
        isPublic: req.body.isPublic === true || req.body.isPublic === 'true',
        userId,
        s3Key: req.body.s3Key,
      });
      
      const video = await storage.createVideo(videoData);
      res.status(201).json(video);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      console.error("Error saving video metadata:", error);
      res.status(500).json({ message: "Failed to save video metadata" });
    }
  });

  // Upload demo videos to S3 (admin endpoint)
  app.post('/api/admin/upload-demo-videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      console.log('Starting demo video upload process...');
      
      const demoVideos = await uploadDemoVideos(userId);
      
      // Save demo videos to database
      const savedVideos = [];
      for (const video of demoVideos) {
        try {
          const videoData = insertVideoSchema.parse({
            title: video.title,
            description: video.description,
            videoUrl: video.videoUrl,
            musicTitle: video.musicTitle,
            isPublic: true,
            userId: video.userId,
            s3Key: video.s3Key
          });
          
          const savedVideo = await storage.createVideo(videoData);
          savedVideos.push(savedVideo);
        } catch (error) {
          console.error('Error saving demo video to database:', error);
        }
      }
      
      res.json({ 
        message: 'Demo videos uploaded successfully',
        uploaded: demoVideos.length,
        saved: savedVideos.length,
        videos: savedVideos
      });
    } catch (error) {
      console.error('Error uploading demo videos:', error);
      res.status(500).json({ message: 'Failed to upload demo videos' });
    }
  });

  // Sync existing S3 videos to database
  app.post('/api/admin/sync-s3-videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      console.log('Starting S3 videos sync process...');
      
      // List all videos in S3
      const s3Videos = await S3Service.listS3Videos();
      console.log(`Found ${s3Videos.length} videos in S3`);
      
      const syncedVideos = [];
      const skippedVideos = [];
      
      for (const s3Video of s3Videos) {
        try {
          // Check if video already exists in database
          const existingVideo = await storage.getVideoByS3Key(s3Video.key);
          if (existingVideo) {
            skippedVideos.push({ key: s3Video.key, reason: 'Already exists in database' });
            continue;
          }
          
          // Get metadata from S3
          const metadata = await S3Service.getS3VideoMetadata(s3Video.key);
          
          // Extract filename for title
          const fileName = s3Video.key.split('/').pop()?.split('.')[0] || 'Untitled';
          const title = fileName.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          // Create video record
          const videoData = insertVideoSchema.parse({
            title: title,
            description: `Video imported from S3`,
            videoUrl: s3Video.url,
            musicTitle: 'Original Sound',
            isPublic: true,
            userId: userId,
            s3Key: s3Video.key
          });
          
          const savedVideo = await storage.createVideo(videoData);
          syncedVideos.push(savedVideo);
          console.log(`Synced video: ${title}`);
        } catch (error) {
          console.error(`Error syncing video ${s3Video.key}:`, error);
          skippedVideos.push({ key: s3Video.key, reason: (error as Error).message });
        }
      }
      
      res.json({ 
        message: 'S3 videos sync completed',
        total: s3Videos.length,
        synced: syncedVideos.length,
        skipped: skippedVideos.length,
        syncedVideos: syncedVideos,
        skippedVideos: skippedVideos
      });
    } catch (error) {
      console.error('Error syncing S3 videos:', error);
      res.status(500).json({ message: 'Failed to sync S3 videos' });
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
      const userId = (req.user as any)?.claims?.sub;
      
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
      const userId = (req.user as any)?.claims?.sub;
      
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

  // User video routes
  app.get('/api/videos/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const videos = await storage.getUserVideos(userId, limit, offset);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching user videos:", error);
      res.status(500).json({ message: "Failed to fetch user videos" });
    }
  });

  // Follow routes
  app.post('/api/users/:id/follow', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const followerId = (req.user as any)?.claims?.sub;
      
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

  // Create CloudFront distribution (admin endpoint)
  app.post('/api/admin/create-cloudfront', async (req, res) => {
    try {
      const distributionDomain = await S3Service.createCloudFrontDistribution();
      res.json({ 
        message: 'CloudFront distribution created successfully',
        domain: distributionDomain,
        note: 'Please set CLOUDFRONT_DOMAIN environment variable to: ' + distributionDomain
      });
    } catch (error) {
      console.error('Error creating CloudFront distribution:', error);
      res.status(500).json({ message: 'Failed to create CloudFront distribution' });
    }
  });

  // Test CloudFront access (admin endpoint)
  app.post('/api/admin/test-cloudfront', async (req, res) => {
    try {
      const { s3Key, distributionId } = req.body;
      const isAccessible = await S3Service.testCloudFrontAccess(s3Key || 'videos/demo/demo-test.mp4');
      
      let distributionInfo = null;
      if (distributionId) {
        try {
          distributionInfo = await S3Service.getDistributionInfo(distributionId);
        } catch (error) {
          console.log('Could not fetch distribution info:', error.message);
        }
      }
      
      res.json({ 
        accessible: isAccessible,
        cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN || 'e2nl5e3zoa6qsv.cloudfront.net',
        testUrl: S3Service.getCloudFrontUrl(s3Key || 'videos/demo/demo-test.mp4'),
        distributionInfo,
        note: isAccessible ? 'CloudFront is working!' : 'CloudFront DNS may still be propagating (takes 5-15 minutes)'
      });
    } catch (error) {
      console.error('Error testing CloudFront access:', error);
      res.status(500).json({ message: 'Failed to test CloudFront access' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
