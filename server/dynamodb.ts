import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export interface Like {
  id: string;
  videoId: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userProfileImage?: string;
  content: string;
  createdAt: string;
}

export class DynamoDBService {
  private static readonly LIKES_TABLE = "reels-likes";
  private static readonly COMMENTS_TABLE = "reels-comments";

  // Like operations
  static async addLike(videoId: string, userId: string, userEmail: string, userName: string): Promise<Like> {
    const like: Like = {
      id: `${videoId}#${userId}`,
      videoId,
      userId,
      userEmail,
      userName,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: this.LIKES_TABLE,
      Item: like,
    }));

    return like;
  }

  static async removeLike(videoId: string, userId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: this.LIKES_TABLE,
      Key: {
        id: `${videoId}#${userId}`,
      },
    }));
  }

  static async getUserLike(videoId: string, userId: string): Promise<Like | null> {
    const result = await docClient.send(new GetCommand({
      TableName: this.LIKES_TABLE,
      Key: {
        id: `${videoId}#${userId}`,
      },
    }));

    return result.Item as Like || null;
  }

  static async getVideoLikes(videoId: string): Promise<Like[]> {
    const result = await docClient.send(new ScanCommand({
      TableName: this.LIKES_TABLE,
      FilterExpression: "videoId = :videoId",
      ExpressionAttributeValues: {
        ":videoId": videoId,
      },
    }));

    return result.Items as Like[] || [];
  }

  static async getVideoLikeCount(videoId: string): Promise<number> {
    const result = await docClient.send(new ScanCommand({
      TableName: this.LIKES_TABLE,
      FilterExpression: "videoId = :videoId",
      ExpressionAttributeValues: {
        ":videoId": videoId,
      },
      Select: "COUNT",
    }));

    return result.Count || 0;
  }

  // Comment operations
  static async addComment(videoId: string, userId: string, userEmail: string, userName: string, content: string, userProfileImage?: string): Promise<Comment> {
    const comment: Comment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      videoId,
      userId,
      userEmail,
      userName,
      userProfileImage,
      content,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: this.COMMENTS_TABLE,
      Item: comment,
    }));

    return comment;
  }

  static async getVideoComments(videoId: string): Promise<Comment[]> {
    const result = await docClient.send(new ScanCommand({
      TableName: this.COMMENTS_TABLE,
      FilterExpression: "videoId = :videoId",
      ExpressionAttributeValues: {
        ":videoId": videoId,
      },
    }));

    const comments = result.Items as Comment[] || [];
    
    // Sort by creation date (newest first)
    return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async getVideoCommentCount(videoId: string): Promise<number> {
    const result = await docClient.send(new ScanCommand({
      TableName: this.COMMENTS_TABLE,
      FilterExpression: "videoId = :videoId",
      ExpressionAttributeValues: {
        ":videoId": videoId,
      },
      Select: "COUNT",
    }));

    return result.Count || 0;
  }

  static async deleteComment(commentId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: this.COMMENTS_TABLE,
      Key: {
        id: commentId,
      },
    }));
  }

  // Initialize tables (call this on server startup)
  static async initializeTables(): Promise<void> {
    try {
      // Tables will be created manually in AWS Console or via AWS CLI
      console.log("DynamoDB tables should be created manually:");
      console.log(`1. Table: ${this.LIKES_TABLE}`);
      console.log("   - Partition Key: id (String)");
      console.log("   - Attributes: videoId, userId, userEmail, userName, createdAt");
      console.log(`2. Table: ${this.COMMENTS_TABLE}`);
      console.log("   - Partition Key: id (String)");
      console.log("   - Attributes: videoId, userId, userEmail, userName, userProfileImage, content, createdAt");
    } catch (error) {
      console.error("Error initializing DynamoDB tables:", error);
    }
  }
}