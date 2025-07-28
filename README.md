# TikTok Clone - Full Stack Video Sharing App

A modern TikTok-style video sharing platform built with React, TypeScript, Express.js, and PostgreSQL.

## Features

- 📱 Mobile-first TikTok-style interface
- 🎥 Video upload and streaming
- 👤 Direct access without authentication
- ❤️ Like and comment system
- 👥 User profiles and following
- 🔍 Discover page with trending content
- 🎵 Music/sound integration
- 📊 Real-time engagement metrics

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **TanStack Query** for state management
- **Wouter** for routing

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** database
- **Drizzle ORM** for type-safe database operations
- **Educational Content Validation** with Deepgram and Gemini AI
- **AWS S3** for video storage

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed

### Production Deployment
```bash
# Clone the repository
git clone <your-repo-url>
cd tiktok-clone

# Start the application
docker-compose up -d

# The app will be available at http://localhost:5000
```

### Development Mode
```bash
# Start in development mode with hot reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f app
```

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and AWS S3 credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run check` - TypeScript type checking

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `AWS_ACCESS_KEY_ID` - AWS access key for S3 storage
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3 storage
- `S3_BUCKET_NAME` - S3 bucket name for video storage

### Optional (for AI Features)
- `DEEPGRAM_API_KEY` - For video transcription
- `GEMINI_API_KEY` - For educational content analysis
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)

## Docker Commands

```bash
# Build and start services
docker-compose up --build

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Execute commands in container
docker-compose exec app npm run db:push

# Clean up volumes (removes all data)
docker-compose down -v
```

## Database

The application uses PostgreSQL with Drizzle ORM. The schema includes:

- **Users** - User profiles and authentication
- **Videos** - Video metadata and content
- **Likes** - Video like relationships
- **Comments** - Video comments
- **Follows** - User follow relationships
- **Sessions** - User session storage

## Architecture

### Frontend Structure
```
client/src/
├── components/     # Reusable UI components
├── pages/         # Route components
├── hooks/         # Custom React hooks
├── lib/           # Utility functions
└── main.tsx       # Application entry point
```

### Backend Structure
```
server/
├── index.ts       # Express server setup
├── routes.ts      # API route definitions
├── storage.ts     # Database operations
├── replitAuth.ts  # Authentication middleware
└── db.ts          # Database connection
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details# myapp
