import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import VideoItem from "./VideoItem";
import { VideoWithUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VideoFeed() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videos, setVideos] = useState<VideoWithUser[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fetchedVideos, isLoading } = useQuery({
    queryKey: ["/api/videos"],
    refetchOnWindowFocus: false,
  });

  const syncS3VideosMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/sync-s3-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to sync S3 videos");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "S3 Videos Synced!",
        description: `Synced ${data.synced} videos from your S3 bucket.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync videos from S3. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (fetchedVideos && Array.isArray(fetchedVideos)) {
      setVideos(fetchedVideos as VideoWithUser[]);
      // Reset to first video when new videos are loaded
      setCurrentIndex(0);
    }
  }, [fetchedVideos]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / containerHeight);
      
      // Only update if index actually changed
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
        setCurrentIndex(newIndex);
      }
    };

    // Use throttling to avoid too many scroll events
    let scrollTimeout: NodeJS.Timeout;
    const throttledHandleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 100);
    };

    container.addEventListener('scroll', throttledHandleScroll);
    
    // Pause all videos when page becomes hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause all videos
        const videoElements = container.querySelectorAll('video');
        videoElements.forEach(video => video.pause());
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(scrollTimeout);
    };
  }, [currentIndex, videos.length]);

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tiktok-pink"></div>
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-tiktok-dark rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-tiktok-gray" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
          <p className="text-tiktok-gray mb-4">Sync your S3 videos or upload new ones!</p>
          <Button
            onClick={() => syncS3VideosMutation.mutate()}
            disabled={syncS3VideosMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 mx-auto"
          >
            <Download className="w-4 h-4" />
            {syncS3VideosMutation.isPending ? "Syncing..." : "Sync S3 Videos"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="video-container h-screen overflow-y-scroll pt-16 pb-20"
    >
      {videos.map((video, index) => (
        <VideoItem 
          key={video.id} 
          video={video} 
          isActive={index === currentIndex}
        />
      ))}
    </div>
  );
}
