import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function createTableIfNotExists(tableName: string, keySchema: any) {
  try {
    // Check if table exists
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table ${tableName} already exists`);
    return;
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  // Create table
  try {
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: keySchema,
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });

    await client.send(command);
    console.log(`Table ${tableName} created successfully`);
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    throw error;
  }
}

export async function createDynamoDBTables() {
  console.log('Creating DynamoDB tables...');
  
  try {
    await createTableIfNotExists('reels-likes', [
      {
        AttributeName: 'id',
        KeyType: 'HASH'
      }
    ]);

    await createTableIfNotExists('reels-comments', [
      {
        AttributeName: 'id',
        KeyType: 'HASH'
      }
    ]);

    console.log('All DynamoDB tables created successfully!');
  } catch (error) {
    console.error('Error creating DynamoDB tables:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createDynamoDBTables().catch(console.error);
}