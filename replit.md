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

### Authentication System
- **Replit Auth Integration**: Uses OpenID Connect for secure authentication
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **User Management**: Automatic user creation and profile management
- **Protected Routes**: Authentication middleware for secure endpoints

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
- **Authentication**: Replit Auth, OpenID Client, Passport
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
- **Authentication**: Requires Replit Auth environment variables
- **Sessions**: Requires `SESSION_SECRET` for session security

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

### Authentication Architecture
- **Replit Integration**: Leverages platform authentication
- **Session Security**: HTTP-only cookies with secure settings
- **User Experience**: Automatic login redirects for expired sessions
- **Data Protection**: All routes require authentication except landing page