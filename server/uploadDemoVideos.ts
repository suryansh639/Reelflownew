import { S3Service } from './s3';
import fetch from 'node-fetch';

// Demo video URLs
const demoVideos = [
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny Demo',
    description: 'Classic demo video - Big Buck Bunny animation',
    musicTitle: 'Original Soundtrack'
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    title: 'Elephants Dream',
    description: 'Beautiful animated short film',
    musicTitle: 'Cinematic Score'
  },
  {
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'For Bigger Blazes',
    description: 'High quality demo video content',
    musicTitle: 'Epic Background Music'
  }
];

export async function uploadDemoVideos(userId: string) {
  const results = [];
  
  console.log('Starting demo video uploads to S3...');
  
  for (const video of demoVideos) {
    try {
      console.log(`Downloading ${video.title}...`);
      const response = await fetch(video.url);
      
      if (!response.ok) {
        throw new Error(`Failed to download ${video.title}`);
      }
      
      const buffer = await response.buffer();
      
      // Create a mock file object for S3 upload
      const mockFile = {
        buffer,
        originalname: `${video.title.replace(/\s+/g, '_')}.mp4`,
        mimetype: 'video/mp4',
        size: buffer.length
      } as Express.Multer.File;
      
      console.log(`Uploading ${video.title} to S3...`);
      const s3Result = await S3Service.uploadVideo(mockFile, userId);
      
      results.push({
        ...video,
        videoUrl: s3Result.url,
        s3Key: s3Result.key,
        userId
      });
      
      console.log(`✅ ${video.title} uploaded successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to upload ${video.title}:`, error);
    }
  }
  
  console.log(`Demo video upload complete. ${results.length}/${demoVideos.length} videos uploaded.`);
  return results;
}