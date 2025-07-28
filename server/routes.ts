import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// Authentication removed - direct access
import { insertVideoSchema, insertCommentSchema } from "@shared/schema";
import { z } from "zod";
import { upload } from "./multer";
import { S3Service } from "./s3";
import { uploadDemoVideos } from "./uploadDemoVideos";
import { VideoValidator } from "./videoValidator";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Direct access - no authentication required

  // Video routes
  app.get('/api/videos', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const videos = await storage.getVideos(null, limit, offset);
      res.json(videos);
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

  app.get('/api/videos/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const video = await storage.getVideo(id, null);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.post('/api/videos', upload.single('video'), async (req: any, res) => {
    try {
      const userId = 'anonymous'; // No authentication required
      
      let videoUrl: string;
      let s3Key: string | undefined;
      let validationResult;
      
      if (req.file) {
        // Validate video file (duration, size, and educational content)
        console.log('Validating video file...', {
          filename: req.file.originalname,
          size: `${(req.file.size / (1024 * 1024)).toFixed(2)}MB`,
          mimetype: req.file.mimetype
        });
        
        validationResult = await VideoValidator.validateVideo(req.file);
        
        if (!validationResult.isValid) {
          return res.status(400).json({ 
            message: "Video validation failed", 
            errors: validationResult.errors,
            details: {
              duration: validationResult.duration,
              fileSize: `${(validationResult.fileSize / (1024 * 1024)).toFixed(2)}MB`,
              maxDuration: "60 seconds",
              maxFileSize: "10MB"
            }
          });
        }

        console.log('Video validation successful:', {
          duration: `${validationResult.duration}s`,
          isEducational: validationResult.educationalAnalysis?.is_educational,
          topic: validationResult.educationalAnalysis?.topic
        });

        if (S3Service.isConfigured()) {
          // Upload file to S3
          const s3Result = await S3Service.uploadVideo(req.file, userId);
          videoUrl = s3Result.url;
          s3Key = s3Result.key;
          console.log('S3 upload successful:', { url: videoUrl, key: s3Key });
        } else {
          return res.status(400).json({ 
            message: "S3 is not configured. Please provide a video URL instead or configure AWS credentials." 
          });
        }
      } else if (req.body.videoUrl) {
        // If URL was provided, use it directly (skip validation for external URLs)
        videoUrl = req.body.videoUrl;
        console.log('Using provided video URL:', videoUrl);
      } else {
        return res.status(400).json({ message: "No video file or URL provided" });
      }
      
      const videoData = insertVideoSchema.parse({
        title: req.body.title || 'Untitled Video',
        description: req.body.description || (validationResult?.educationalAnalysis?.topic ? `Educational content about: ${validationResult.educationalAnalysis.topic}` : ''),
        videoUrl,
        musicTitle: req.body.musicTitle || 'Original Sound',
        isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
        userId,
        duration: validationResult?.duration,
        ...(s3Key && { s3Key }),
      });
      
      const video = await storage.createVideo(videoData);
      
      // Include validation details in response
      res.status(201).json({
        ...video,
        validation: validationResult ? {
          duration: validationResult.duration,
          educationalAnalysis: validationResult.educationalAnalysis,
          transcript: validationResult.transcript
        } : null
      });
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
