import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3Upload() {
  try {
    console.log("Testing S3 upload...");
    
    const testContent = "Hello from TikTok app test!";
    const key = `test/upload-test-${Date.now()}.txt`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(testContent),
      ContentType: "text/plain",
    });

    await s3Client.send(command);
    
    const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log("✅ S3 upload successful!");
    console.log("📁 File URL:", url);
    console.log("🔑 S3 Key:", key);
    
  } catch (error) {
    console.error("❌ S3 upload failed:", error.message);
  }
}

testS3Upload();
