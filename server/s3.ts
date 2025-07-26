import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateDistributionCommand, GetDistributionCommand } from '@aws-sdk/client-cloudfront';
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

// Initialize CloudFront client
const cloudFrontClient = new CloudFrontClient({
  region: 'us-east-1', // CloudFront is global but requires us-east-1
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
// CloudFront domain - can be set via secrets
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || null;

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
      // Removed ACL since your bucket doesn't support it
      Metadata: {
        userId,
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
      },
    });

    try {
      await s3Client.send(command);
      
      // Generate public URL - check if bucket has public access
      // If your bucket is not public, videos may not be accessible via direct URL
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
      // Add public tag for bucket policy
      Tagging: 'public=true',
      Metadata: {
        'uploaded-by': userId,
        'upload-date': new Date().toISOString()
      }
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

  // Configure bucket policy for public read access
  static async configureBucketPolicy(): Promise<void> {
    try {
      const { PutBucketPolicyCommand } = await import('@aws-sdk/client-s3');
      
      const bucketPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicReadGetObject",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject", "s3:GetObjectVersion"],
            Resource: `arn:aws:s3:::${BUCKET_NAME}/*`,
            Condition: {
              StringEquals: {
                "s3:ExistingObjectTag/public": "true"
              }
            }
          }
        ]
      };
      
      const command = new PutBucketPolicyCommand({
        Bucket: BUCKET_NAME,
        Policy: JSON.stringify(bucketPolicy)
      });
      
      await s3Client.send(command);
      console.log('S3 bucket policy configured for video access');
    } catch (error) {
      console.error('Failed to configure S3 bucket policy:', error);
    }
  }

  // Configure CORS for the bucket
  static async configureCORS(): Promise<void> {
    try {
      const { PutBucketCorsCommand } = await import('@aws-sdk/client-s3');
      const corsConfiguration = {
        CORSRules: [
          {
            AllowedOrigins: ['*'], // In production, replace with your domain
            AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600
          }
        ]
      };
      
      const command = new PutBucketCorsCommand({
        Bucket: BUCKET_NAME,
        CORSConfiguration: corsConfiguration
      });
      
      await s3Client.send(command);
      console.log('S3 CORS configuration updated successfully');
    } catch (error) {
      console.error('Failed to configure S3 CORS:', error);
    }
  }

  // Get presigned URL for viewing video
  static async getPresignedViewUrl(s3Key: string): Promise<string> {
    try {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });
      
      const presignedUrl = await getSignedUrl(s3Client, command, { 
        expiresIn: 300 // 5 minutes as per instructions
      });
      
      console.log('Generated presigned view URL for key:', s3Key);
      
      return presignedUrl;
    } catch (error) {
      console.error('Error generating presigned view URL:', error);
      throw new Error('Failed to generate presigned view URL');
    }
  }

  // CloudFront Methods
  static async createCloudFrontDistribution(): Promise<string> {
    try {
      const distributionConfig = {
        CallerReference: `tiktok-app-${Date.now()}`,
        Comment: 'CloudFront distribution for TikTok app videos',
        DefaultCacheBehavior: {
          TargetOriginId: `S3-${BUCKET_NAME}`,
          ViewerProtocolPolicy: 'redirect-to-https',
          TrustedSigners: {
            Enabled: false,
            Quantity: 0,
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: {
              Forward: 'none',
            },
          },
          MinTTL: 0,
          DefaultTTL: 86400, // 1 day
          MaxTTL: 31536000, // 1 year
        },
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: `S3-${BUCKET_NAME}`,
              DomainName: `${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`,
              S3OriginConfig: {
                OriginAccessIdentity: '',
              },
            },
          ],
        },
        Enabled: true,
      };

      const command = new CreateDistributionCommand({
        DistributionConfig: distributionConfig,
      });

      const response = await cloudFrontClient.send(command);
      const distributionDomain = response.Distribution?.DomainName;
      
      console.log('CloudFront distribution created:', distributionDomain);
      return distributionDomain || '';
    } catch (error) {
      console.error('Error creating CloudFront distribution:', error);
      throw new Error('Failed to create CloudFront distribution');
    }
  }

  // Get CloudFront URL for video
  static getCloudFrontUrl(s3Key: string): string {
    if (!CLOUDFRONT_DOMAIN) {
      console.warn('CloudFront domain not configured, falling back to S3 URL');
      return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    }
    return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
  }

  // Test CloudFront distribution
  static async testCloudFrontAccess(s3Key: string): Promise<boolean> {
    try {
      if (!CLOUDFRONT_DOMAIN) {
        return false;
      }
      
      const cloudFrontUrl = this.getCloudFrontUrl(s3Key);
      const response = await fetch(cloudFrontUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('CloudFront access test failed:', error);
      return false;
    }
  }
}