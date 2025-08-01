# TikTok Style Video Sharing Platform

## Overview

This is a modern full-stack web application that mimics TikTok's functionality, allowing users to upload, view, like, comment, and share short videos. The application follows a TikTok-style vertical video feed interface with a dark theme optimized for mobile viewing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a modern full-stack architecture with the following key components:

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom TikTok-inspired theme variables
- **State Management**: TanStack Query (React Query) for server state management
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage

### Mobile-First Design
The application is designed with a mobile-first approach, featuring:
- Vertical video feed similar to TikTok
- Touch-friendly interface
- Full-screen video viewing experience
- Bottom navigation bar
- Swipe gestures for video interaction

## Key Components

### Direct Access System
- **No Authentication Required**: Users can directly access all videos and features
- **Anonymous Interactions**: All user actions performed as anonymous user
- **Educational Content Only**: Videos must pass AI validation to be approved

### Video Management
- **Video Upload**: Multi-step upload process with metadata capture
- **Video Storage**: Configured for external video URL storage
- **Thumbnail Generation**: Support for video thumbnails
- **View Tracking**: Automatic view count incrementing

### Social Features
- **Like System**: Users can like/unlike videos with real-time updates
- **Comment System**: Threaded comments with user avatars
- **Follow System**: User following/unfollowing functionality
- **Social Interactions**: Real-time UI feedback for all social actions

### User Interface
- **Video Feed**: Infinite scroll vertical video feed
- **Video Player**: Custom HTML5 video player with controls
- **Comments Sidebar**: Slide-out comment panel
- **Upload Modal**: Multi-step video upload interface
- **Bottom Navigation**: TikTok-style navigation bar

## Data Flow

### Video Viewing Flow
1. User accesses the home page
2. Authentication middleware verifies user session
3. Video feed loads paginated videos from the database
4. Each video includes user data, like status, and comment counts
5. Video interactions update both database and UI state

### Upload Flow
1. User selects video file through upload interface
2. Video metadata (title, description, privacy) is captured
3. Video is processed and stored (URL-based storage)
4. Database record is created with video metadata
5. User is redirected to updated video feed

### Social Interaction Flow
1. User performs action (like, comment, follow)
2. Optimistic UI update provides immediate feedback
3. API request updates database
4. Query cache is invalidated and refreshed
5. UI reflects final state from server

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React, React DOM, React Query
- **Database**: Drizzle ORM, @neondatabase/serverless
- **Video Storage**: AWS S3 for video files
- **AI Services**: Deepgram for transcription, Gemini for content analysis
- **UI Components**: Radix UI primitives, Lucide React icons
- **Validation**: Zod for schema validation
- **Styling**: Tailwind CSS, class-variance-authority

### Development Dependencies
- **Build Tools**: Vite, esbuild, TypeScript
- **Code Quality**: ESLint, Prettier (implied by structure)
- **Development**: tsx for TypeScript execution

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React application to `dist/public`
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations handled via `db:push` script

### Environment Configuration
- **Database**: Requires `DATABASE_URL` for PostgreSQL connection
- **AWS Services**: Requires AWS credentials for S3 video storage
- **AI Services**: Optional `DEEPGRAM_API_KEY` and `GEMINI_API_KEY` for educational validation

### Production Deployment
- Single Node.js process serves both API and static files
- Static files served from `dist/public` directory
- Database migrations applied during deployment
- Session storage persisted in PostgreSQL

### Development Environment
- Hot module replacement via Vite dev server
- TypeScript compilation checking
- Automatic server restart with tsx
- Replit integration for cloud development

## Key Design Decisions

### Database Schema Design
- **User-centric**: All content tied to authenticated users
- **Social Features**: Separate tables for likes, comments, follows
- **Scalable Relations**: Proper foreign key relationships with cascading
- **Performance**: Indexes on frequently queried fields

### State Management Strategy
- **Server State**: TanStack Query for all API data
- **Client State**: React hooks for local UI state
- **Optimistic Updates**: Immediate UI feedback with server reconciliation
- **Cache Management**: Intelligent query invalidation strategies

### Direct Access Architecture
- **No Authentication**: Complete removal of all authentication systems
- **Anonymous Usage**: All interactions performed as anonymous user
- **Educational Content**: AI-powered validation ensures only educational videos
- **Open Access**: All routes publicly accessible without restrictions

### Video Upload & Storage
- **File Upload**: Multer middleware for handling video file uploads
- **Local Storage**: Videos stored locally for development, configurable for production
- **File Serving**: Express static middleware for serving uploaded videos
- **Audio Support**: Videos play with sound for enhanced user experience

### Docker & Deployment
- **Multi-stage Dockerfile**: Optimized for production deployment
- **Docker Compose**: Both development and production configurations
- **CI/CD Pipeline**: GitHub Actions for automated builds and deployment
- **Environment Configuration**: Flexible environment variable management

## Recent Changes (January 2025)

### Google OAuth Authentication & DynamoDB Integration (Latest - August 2025)
- ✓ Successfully migrated from Replit Agent to standard Replit environment
- ✓ Implemented Google OAuth authentication using Passport.js
- ✓ Created DynamoDB tables for likes and comments storage
- ✓ Added authentication middleware for protected routes
- ✓ Restricted video uploads to authenticated users only
- ✓ Implemented like/unlike functionality with DynamoDB
- ✓ Added comment system with authentication requirements
- ✓ Updated frontend UI to handle authentication states
- ✓ Added proper error handling for unauthenticated actions
- ✓ Configured session storage with PostgreSQL
- ✓ Public video viewing for all users, protected interactions

### Educational Content Validation & Migration (Previous - July 2025)
- ✓ Successfully migrated from Replit Agent to Replit environment
- ✓ Created PostgreSQL database and applied schema migrations
- ✓ Fixed session management and authentication for Replit compatibility
- ✓ Implemented video duration limits (max 60 seconds)
- ✓ Added file size restrictions (max 10MB for uploads)
- ✓ Integrated Deepgram API for video transcription
- ✓ Integrated Gemini AI for educational content analysis
- ✓ Created automated educational content validation flow
- ✓ Added comprehensive video validation system
- ✓ Made S3 configuration optional for development
- ✓ Added AI service health check endpoints

### Video Upload Validation Features
- **Duration Limit**: Videos restricted to maximum 60 seconds
- **File Size Limit**: Upload limit set to 10MB maximum
- **Educational Content Filter**: Automatic validation using AI
- **Transcription Service**: Deepgram integration for speech-to-text
- **Content Analysis**: Gemini AI determines educational value
- **Validation Flow**: Upload → Transcribe → Analyze → Approve/Reject

### AI Integration Architecture
- **Deepgram Integration**: Real-time video transcription
- **Gemini AI Analysis**: Educational content classification
- **Automated Filtering**: Videos rejected if not educational
- **Health Monitoring**: API endpoints to check service status
- **Fallback Handling**: Graceful degradation when services unavailable

### Video Playback & Device Optimization
- ✓ Fixed multiple videos playing simultaneously issue
- ✓ Implemented proper video play/pause control based on scroll position
- ✓ Added responsive video sizing for all devices (mobile, tablet, desktop)
- ✓ Enhanced mobile support with dynamic viewport height (100dvh)
- ✓ Added snap scrolling for smooth TikTok-style navigation
- ✓ Optimized video loading and error handling
- ✓ Added iOS Safari video playback optimizations

### AWS S3 Integration & Production Setup
- ✓ Successfully integrated AWS S3 for video storage and retrieval
- ✓ Implemented S3 video sync functionality (imported 5 existing videos)
- ✓ Fixed S3 CORS configuration for direct uploads
- ✓ Added presigned URL generation for secure video access
- ✓ Created comprehensive production deployment documentation
- ✓ Updated Docker configuration for production deployment
- ✓ Added environment configuration templates (.env.example)

### Dockerization & Deployment Setup
- ✓ Added comprehensive Docker configuration
- ✓ Created development and production Docker Compose files
- ✓ Implemented file upload functionality with Multer
- ✓ Added sound support to video playbook
- ✓ Created GitHub Actions workflow for CI/CD
- ✓ Updated project documentation for deployment