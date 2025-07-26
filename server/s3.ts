import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

export class S3Service {
  // Upload video to S3
  static async uploadVideo(
    file: Express.Multer.File,
    userId: string
  ): Promise<{ url: string; key: string }> {
    const fileExtension = file.originalname.split('.').pop();
    const key = `videos/${userId}/${nanoid()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read', // Make videos publicly accessible
      Metadata: {
        userId,
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    });

    try {
      await s3Client.send(command);
      
      // Generate public URL
      const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      return { url, key };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error('Failed to upload video to S3');
    }
  }

  // Delete video from S3
  static async deleteVideo(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    try {
      await s3Client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error('Failed to delete video from S3');
    }
  }

  // Generate presigned URL for direct upload (alternative method)
  static async getPresignedUploadUrl(
    fileName: string,
    fileType: string,
    userId: string
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    const fileExtension = fileName.split('.').pop();
    const key = `videos/${userId}/${nanoid()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      ACL: 'public-read',
    });

    try {
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      return { uploadUrl, key, publicUrl };
    } catch (error) {
      console.error('Presigned URL error:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  // Check if S3 configuration is valid
  static async testConnection(): Promise<boolean> {
    try {
      // Try to list objects in the bucket (just to test connection)
      const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
      const command = new HeadBucketCommand({ Bucket: BUCKET_NAME });
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('S3 connection test failed:', error);
      return false;
    }
  }
}