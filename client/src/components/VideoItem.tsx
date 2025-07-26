import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Share, MoreHorizontal, Music, Play, Pause } from "lucide-react";
import { VideoWithUser } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
// import CommentsSidebar from "./CommentsSidebar";

interface VideoItemProps {
  video: VideoWithUser;
  isActive: boolean;
}

export default function VideoItem({ video, isActive }: VideoItemProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(video.isLiked || false);
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [videoUrl, setVideoUrl] = useState<string>(video.videoUrl);
  const [videoError, setVideoError] = useState<string>('');
  const [loadingVideo, setLoadingVideo] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/videos/${video.id}/like`),
    onSuccess: (response) => {
      const data = response.json();
      setLiked(!liked);
      setLikeCount(prev => liked ? prev - 1 : prev + 1);
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      
      if (!liked) {
        // Create floating heart animation
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const heart = {
            id: Date.now(),
            x: rect.width - 80,
            y: rect.height - 200
          };
          setFloatingHearts(prev => [...prev, heart]);
          setTimeout(() => {
            setFloatingHearts(prev => prev.filter(h => h.id !== heart.id));
          }, 2000);
        }
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to like video",
        variant: "destructive",
      });
    },
  });

  const viewMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/videos/${video.id}/view`),
  });

  // Fetch proper video URL if needed
  useEffect(() => {
    const fetchVideoUrl = async () => {
      // Always fetch presigned URL for S3 videos
      if (video.s3Key) {
        setLoadingVideo(true);
        try {
          console.log('Fetching CloudFront URL for S3 key:', video.s3Key);
          const response = await fetch('/api/get-video-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              s3Key: video.s3Key,
              videoUrl: video.videoUrl 
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Received CloudFront/S3 URL:', data.url);
            setVideoUrl(data.url);
            setVideoError('');
          } else {
            const errorText = await response.text();
            console.error('Failed to get video URL:', errorText);
            throw new Error('Failed to get video URL');
          }
        } catch (error) {
          console.error('Error fetching video URL:', error);
          console.error('S3 key:', video.s3Key);
          console.error('Original video URL:', video.videoUrl);
          // Fallback to original video URL if presigned fails  
          if (video.videoUrl) {
            setVideoUrl(video.videoUrl);
            setVideoError('Using original video URL');
          } else {
            setVideoError('Failed to load video - no URL available');
          }
        } finally {
          setLoadingVideo(false);
        }
      } else {
        // For non-S3 videos, use the direct URL
        setVideoUrl(video.videoUrl);
      }
    };
    
    fetchVideoUrl();
  }, [video.s3Key, video.videoUrl]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isActive) {
      // Reset video to beginning and start playing
      videoElement.currentTime = 0;
      setIsPlaying(true);
      viewMutation.mutate();
    } else {
      // Pause and reset when not active
      setIsPlaying(false);
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const updateProgress = () => {
      const progress = (videoElement.currentTime / videoElement.duration) * 100;
      setProgress(progress);
    };

    const handleEnded = () => {
      setProgress(0);
      videoElement.currentTime = 0;
      videoElement.play();
    };

    if (isPlaying) {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Ignore common video playback interruption errors
          if (error.name === 'AbortError' || 
              error.message.includes('interrupted') ||
              error.message.includes('removed from the document')) {
            console.log('Video play interrupted, ignoring error');
            return;
          }
          console.error('Video play error:', error);
        });
      }
    } else {
      videoElement.pause();
    }

    videoElement.addEventListener('timeupdate', updateProgress);
    videoElement.addEventListener('ended', handleEnded);

    return () => {
      videoElement.removeEventListener('timeupdate', updateProgress);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    // Only allow manual play/pause if this video is active
    if (isActive) {
      setIsPlaying(!isPlaying);
      setShowControls(true);
      setTimeout(() => setShowControls(false), 1000);
    }
  };

  const handleLike = () => {
    const heart = document.querySelector(`[data-video-id="${video.id}"] .like-icon`);
    if (heart) {
      heart.classList.add('pulse-like');
      setTimeout(() => heart.classList.remove('pulse-like'), 300);
    }
    likeMutation.mutate();
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="video-item relative w-full h-screen flex items-center justify-center bg-black"
        data-video-id={video.id}
      >
        {/* Video Element */}
        {loadingVideo ? (
          <div className="flex items-center justify-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : videoError ? (
          <div className="flex items-center justify-center text-white">
            <div className="text-center">
              <p>Failed to load video</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 px-4 py-2 bg-blue-500 rounded text-white"
              >
                Reload
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={videoUrl}
            muted={false}
            loop
            playsInline
            onClick={togglePlay}
            onError={(e) => {
              console.error('Video error:', e);
              console.error('Failed video URL:', videoUrl);
              console.error('Video element error details:', e.currentTarget.error);
              setVideoError('Video playback failed - check S3 permissions');
            }}
            onLoadedData={() => {
              console.log('Video loaded successfully:', videoUrl);
              setVideoError('');
            }}
            onLoadStart={() => {
              console.log('Video loading started:', videoUrl);
              // Unmute video after user interaction
              if (videoRef.current && isActive) {
                videoRef.current.muted = false;
              }
              // Unmute video after user interaction
              if (videoRef.current && isActive) {
                videoRef.current.muted = false;
              }
            }}
          />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-20" />

        {/* Play/Pause Button */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={togglePlay}
        >
          <Button variant="ghost" size="lg" className="text-white hover:bg-transparent">
            {isPlaying ? (
              <Pause className="w-12 h-12 drop-shadow-lg" />
            ) : (
              <Play className="w-12 h-12 drop-shadow-lg" />
            )}
          </Button>
        </div>

        {/* Floating Hearts */}
        {floatingHearts.map(heart => (
          <div
            key={heart.id}
            className="absolute floating-heart pointer-events-none z-40"
            style={{ left: heart.x, top: heart.y }}
          >
            <Heart className="w-8 h-8 text-tiktok-pink fill-current" />
          </div>
        ))}

        {/* Right Side Actions */}
        <div className="absolute right-4 bottom-24 flex flex-col items-center space-y-6">
          {/* User Avatar */}
          <div className="relative">
            <Avatar className="w-12 h-12 border-2 border-white">
              <AvatarImage src={video.user.profileImageUrl || undefined} />
              <AvatarFallback className="bg-tiktok-pink text-white">
                {video.user.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-tiktok-pink rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Like Button */}
          <button 
            onClick={handleLike}
            disabled={likeMutation.isPending}
            className="flex flex-col items-center"
          >
            <div className="w-12 h-12 flex items-center justify-center">
              <Heart 
                className={`like-icon w-8 h-8 drop-shadow-lg ${
                  liked ? 'text-tiktok-pink fill-current' : 'text-white'
                }`}
              />
            </div>
            <span className="text-xs mt-1 text-shadow">{formatCount(likeCount)}</span>
          </button>

          {/* Comment Button */}
          <button 
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center"
          >
            <div className="w-12 h-12 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
            <span className="text-xs mt-1 text-shadow">{formatCount(video.commentCount || 0)}</span>
          </button>

          {/* Share Button */}
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 flex items-center justify-center">
              <Share className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
            <span className="text-xs mt-1 text-shadow">{formatCount(video.shareCount || 0)}</span>
          </button>

          {/* More Button */}
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 flex items-center justify-center">
              <MoreHorizontal className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          </button>
        </div>

        {/* Bottom Content Info */}
        <div className="absolute bottom-24 left-4 right-20 text-white">
          <div className="mb-3">
            <h3 className="font-semibold mb-1 text-shadow">
              @{video.user.username || 'user'}
            </h3>
            <p className="text-sm leading-relaxed text-shadow">
              {video.description}
            </p>
          </div>
          
          {/* Music Info */}
          {video.musicTitle && (
            <div className="flex items-center space-x-2 text-sm">
              <Music className="w-4 h-4" />
              <span className="text-shadow">{video.musicTitle}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
          <div 
            className="h-full bg-white transition-all duration-200" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Comments Sidebar - TODO: Implement CommentsSidebar component */}
      {showComments && (
        <div className="absolute right-0 top-0 w-80 h-full bg-black bg-opacity-90 z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-lg font-semibold">Comments</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(false)}
              className="text-white"
            >
              ✕
            </Button>
          </div>
          <div className="text-white text-center opacity-70">
            Comments feature coming soon!
          </div>
        </div>
      )}
    </>
  );
}
