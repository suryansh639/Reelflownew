import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import VideoItem from "./VideoItem";
import { VideoWithUser } from "@shared/schema";

export default function VideoFeed() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videos, setVideos] = useState<VideoWithUser[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: fetchedVideos, isLoading } = useQuery({
    queryKey: ["/api/videos"],
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (fetchedVideos && Array.isArray(fetchedVideos)) {
      setVideos(fetchedVideos as VideoWithUser[]);
    }
  }, [fetchedVideos]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / containerHeight);
      setCurrentIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
          <p className="text-tiktok-gray">Be the first to upload a video!</p>
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
