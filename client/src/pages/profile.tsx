import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { User as UserIcon, Video, Heart, MessageCircle, Share } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoWithUser, User } from "@shared/schema";

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const typedUser = user as User | undefined;
  
  const { data: userVideos = [], isLoading } = useQuery<VideoWithUser[]>({
    queryKey: ["/api/videos/user", typedUser?.id],
    enabled: !!typedUser?.id && isAuthenticated,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tiktok-pink"></div>
      </div>
    );
  }

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 bg-black border-b border-gray-800 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">Profile</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Profile Info */}
      <div className="px-4 py-6">
        <div className="flex items-center space-x-4 mb-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={typedUser?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-tiktok-pink text-white text-xl">
              {typedUser?.username?.[0]?.toUpperCase() || typedUser?.firstName?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              @{typedUser?.username || `${typedUser?.firstName || 'User'}`}
            </h2>
            <p className="text-tiktok-gray">
              {typedUser?.firstName && typedUser?.lastName ? `${typedUser.firstName} ${typedUser.lastName}` : typedUser?.email}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex space-x-8 mb-6">
          <div className="text-center">
            <div className="text-xl font-bold">{userVideos.length}</div>
            <div className="text-sm text-tiktok-gray">Videos</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">
              {userVideos.reduce((sum, video) => sum + (video.likeCount || 0), 0)}
            </div>
            <div className="text-sm text-tiktok-gray">Likes</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">
              {userVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0)}
            </div>
            <div className="text-sm text-tiktok-gray">Views</div>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="px-4">
        <h3 className="text-lg font-semibold mb-4">Your Videos</h3>
        {userVideos.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-tiktok-dark rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-tiktok-gray" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
            <p className="text-tiktok-gray">Upload your first video to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {userVideos.map((video) => (
              <Card key={video.id} className="aspect-[9/16] bg-tiktok-dark border-gray-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                <CardContent className="p-0 h-full relative">
                  <video
                    className="w-full h-full object-cover"
                    src={video.videoUrl}
                    poster={video.thumbnailUrl}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-20" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs text-white line-clamp-2 mb-1">
                      {video.description}
                    </p>
                    <div className="flex items-center space-x-3 text-xs text-white">
                      <div className="flex items-center space-x-1">
                        <Heart className="w-3 h-3" />
                        <span>{formatCount(video.likeCount || 0)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-3 h-3" />
                        <span>{formatCount(video.commentCount || 0)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}