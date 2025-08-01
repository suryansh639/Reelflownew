import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, getUser, type User } from "./auth";
import { DynamoDBService } from "./dynamodb";
import { VideoValidationService } from "./videoValidation";
import { z } from "zod";
import { upload } from "./multer";
import { S3Service } from "./s3";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  
  // Initialize DynamoDB tables
  try {
    await DynamoDBService.initializeTables();
    // Create tables if they don't exist
    const { createDynamoDBTables } = await import('./createTables');
    await createDynamoDBTables();
  } catch (error) {
    console.error('DynamoDB initialization error:', error);
  }

  // Note: Auth routes are handled in server/auth.ts

  // Video routes (public access for viewing)
  app.get('/api/videos', getUser, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const user = req.user as User;
      
      const videos = await storage.getVideos(user?.id || null, limit, offset);
      
      // Enhance videos with like and comment counts from DynamoDB
      const enhancedVideos = await Promise.all(videos.map(async (video) => {
        const [likeCount, commentCount, userLike] = await Promise.all([
          DynamoDBService.getVideoLikeCount(video.id),
          DynamoDBService.getVideoCommentCount(video.id),
          user ? DynamoDBService.getUserLike(video.id, user.id) : Promise.resolve(null)
        ]);
        
        return {
          ...video,
          likeCount,
          commentCount,
          isLiked: !!userLike
        };
      }));
      
      res.json(enhancedVideos);
    } catch (error) {
      console.error("Error fetching videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Get video validation rules (must be before /:id route)
  app.get('/api/videos/validation-rules', (req, res) => {
    res.json({
      maxDurationSeconds: 60,
      maxFileSizeMB: 10,
      allowedFormats: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'],
      requiresEducationalContent: true,
      description: 'Videos must be educational content only, maximum 60 seconds or 10MB'
    });
  });

  app.get('/api/videos/:id', getUser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      const video = await storage.getVideo(id, user?.id || null);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Enhance video with like and comment data
      const [likeCount, commentCount, userLike] = await Promise.all([
        DynamoDBService.getVideoLikeCount(video.id),
        DynamoDBService.getVideoCommentCount(video.id),
        user ? DynamoDBService.getUserLike(video.id, user.id) : Promise.resolve(null)
      ]);
      
      const enhancedVideo = {
        ...video,
        likeCount,
        commentCount,
        isLiked: !!userLike
      };
      
      res.json(enhancedVideo);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.post('/api/videos', requireAuth, upload.single('video'), async (req: any, res) => {
    try {
      const user = req.user as User;
      
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }
      
      // Validate file size
      const sizeValidation = VideoValidationService.validateFileSize(req.file.size);
      if (!sizeValidation.isValid) {
        return res.status(400).json({ message: sizeValidation.error });
      }
      
      // Validate file type
      const typeValidation = VideoValidationService.validateMimeType(req.file.mimetype);
      if (!typeValidation.isValid) {
        return res.status(400).json({ message: typeValidation.error });
      }
      
      // Validate video duration
      const durationValidation = await VideoValidationService.validateVideoDuration(req.file.path);
      if (!durationValidation.isValid) {
        return res.status(400).json({ message: durationValidation.error });
      }
      
      // Upload to S3
      let videoUrl: string;
      let s3Key: string | undefined;
      
      try {
        const uploadResult = await S3Service.uploadVideo(req.file);
        videoUrl = uploadResult.url;
        s3Key = uploadResult.key;
        
        console.log('Video uploaded to S3 successfully:', {
          url: videoUrl,
          key: s3Key
        });
      } catch (uploadError) {
        console.error('S3 upload failed:', uploadError);
        return res.status(500).json({ message: "Failed to upload video to S3" });
      }
      
      // Create video record
      const video = await storage.createVideo({
        userId: user.id,
        title: req.body.title || "Untitled Video",
        description: req.body.description || "",
        videoUrl,
        duration: Math.round(durationValidation.duration || 0),
        isPublic: req.body.isPublic !== 'false',
        musicTitle: req.body.musicTitle || 'Original Sound',
        s3Key
      });
      
      res.status(201).json({
        ...video,
        validation: {
          duration: durationValidation.duration,
          fileSize: `${(req.file.size / (1024 * 1024)).toFixed(2)}MB`
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      console.error("Error creating video:", error);
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  // Like/Unlike video (requires authentication)
  app.post('/api/videos/:id/like', requireAuth, async (req: any, res) => {
    try {
      const { id: videoId } = req.params;
      const user = req.user as User;
      
      // Check if video exists
      const video = await storage.getVideo(videoId, user.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Check if user already liked this video
      const existingLike = await DynamoDBService.getUserLike(videoId, user.id);
      
      if (existingLike) {
        // Unlike the video
        await DynamoDBService.removeLike(videoId, user.id);
        const newLikeCount = await DynamoDBService.getVideoLikeCount(videoId);
        
        res.json({ 
          liked: false, 
          likeCount: newLikeCount,
          message: "Video unliked" 
        });
      } else {
        // Like the video
        await DynamoDBService.addLike(videoId, user.id, user.email, user.name);
        const newLikeCount = await DynamoDBService.getVideoLikeCount(videoId);
        
        res.json({ 
          liked: true, 
          likeCount: newLikeCount,
          message: "Video liked" 
        });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Get video comments (public access)
  app.get('/api/videos/:id/comments', async (req, res) => {
    try {
      const { id: videoId } = req.params;
      
      // Check if video exists
      const video = await storage.getVideo(videoId, null);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      const comments = await DynamoDBService.getVideoComments(videoId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Add comment (requires authentication)
  app.post('/api/videos/:id/comments', requireAuth, async (req: any, res) => {
    try {
      const { id: videoId } = req.params;
      const { content } = req.body;
      const user = req.user as User;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      if (content.length > 500) {
        return res.status(400).json({ message: "Comment is too long (max 500 characters)" });
      }
      
      // Check if video exists
      const video = await storage.getVideo(videoId, user.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      const comment = await DynamoDBService.addComment(
        videoId, 
        user.id, 
        user.email, 
        user.name, 
        content.trim(),
        user.profileImage
      );
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Delete comment (requires authentication - only comment author can delete)
  app.delete('/api/comments/:commentId', requireAuth, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      const user = req.user as User;
      
      // For now, we'll allow any authenticated user to delete comments
      // In production, you'd want to check if the user owns the comment
      await DynamoDBService.deleteComment(commentId);
      
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
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

  // Health check endpoint for AI services
  app.get('/api/health/ai', async (req, res) => {
    try {
      const { DeepgramService } = await import('./deepgram');
      const { GeminiService } = await import('./gemini');
      
      const deepgramConfigured = await DeepgramService.isConfigured();
      const geminiConfigured = await GeminiService.isConfigured();
      
      res.json({ 
        deepgramConfigured,
        geminiConfigured,
        educationalValidationEnabled: deepgramConfigured && geminiConfigured
      });
    } catch (error) {
      res.status(500).json({ 
        deepgramConfigured: false,
        geminiConfigured: false,
        educationalValidationEnabled: false,
        error: 'AI services health check failed' 
      });
    }
  });

  // Get video validation rules
  app.get('/api/videos/validation-rules', (req, res) => {
    res.json({
      maxDurationSeconds: 60,
      maxFileSizeMB: 10,
      allowedFormats: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'],
      requiresEducationalContent: true,
      description: 'Videos must be educational content only, maximum 60 seconds or 10MB'
    });
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
  app.post('/api/generate-presigned-url', async (req: any, res) => {
    try {
      const { fileName, fileType } = req.body;
      const userId = 'anonymous';
      
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
  app.post('/api/videos/metadata', async (req: any, res) => {
    try {
      const userId = 'anonymous';
      
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
  app.post('/api/admin/upload-demo-videos', async (req: any, res) => {
    try {
      const userId = 'anonymous';
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
  app.post('/api/admin/sync-s3-videos', async (req: any, res) => {
    try {
      const userId = 'anonymous';
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
  app.post('/api/videos/:id/like', async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = 'anonymous';
      
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

  app.post('/api/videos/:id/comments', async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = 'anonymous';
      
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
  app.post('/api/users/:id/follow', async (req: any, res) => {
    try {
      const { id } = req.params;
      const followerId = 'anonymous';
      
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
