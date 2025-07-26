import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, Hash, Music, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoWithUser } from "@shared/schema";

export default function Discover() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("trending");

  const { data: trendingVideos = [], isLoading } = useQuery<VideoWithUser[]>({
    queryKey: ["/api/videos", "trending"],
    enabled: activeTab === "trending",
  });

  const { data: searchResults = [], isLoading: isSearching } = useQuery<VideoWithUser[]>({
    queryKey: ["/api/videos", "search", searchTerm],
    enabled: searchTerm.length > 2,
  });

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  const trendingHashtags = [
    "#fyp", "#viral", "#trending", "#dance", "#comedy", "#art", "#music", "#food"
  ];

  const trendingSounds = [
    "Original Audio - User123",
    "Trending Beat 2024",
    "Viral Sound Effect",
    "Popular Song Remix"
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 bg-black border-b border-gray-800 z-50">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold mb-3">Discover</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-tiktok-gray" />
            <Input
              type="text"
              placeholder="Search videos, users, sounds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-tiktok-dark border-gray-700 text-white placeholder-tiktok-gray"
            />
          </div>
        </div>
      </header>

      {/* Search Results */}
      {searchTerm.length > 2 ? (
        <div className="px-4 py-4">
          <h2 className="text-lg font-semibold mb-4">Search Results</h2>
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tiktok-pink"></div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-tiktok-gray">No results found for "{searchTerm}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {searchResults.map((video) => (
                <Card key={video.id} className="aspect-[9/16] bg-tiktok-dark border-gray-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                  <CardContent className="p-0 h-full relative">
                    <video
                      className="w-full h-full object-cover"
                      src={video.videoUrl}
                      poster={video.thumbnailUrl}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-20" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs text-white line-clamp-2">
                        {video.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-800">
            <Button
              variant="ghost"
              className={`flex-1 py-3 rounded-none ${
                activeTab === "trending" ? "text-white border-b-2 border-tiktok-pink" : "text-tiktok-gray"
              }`}
              onClick={() => setActiveTab("trending")}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending
            </Button>
            <Button
              variant="ghost"
              className={`flex-1 py-3 rounded-none ${
                activeTab === "hashtags" ? "text-white border-b-2 border-tiktok-pink" : "text-tiktok-gray"
              }`}
              onClick={() => setActiveTab("hashtags")}
            >
              <Hash className="w-4 h-4 mr-2" />
              Hashtags
            </Button>
            <Button
              variant="ghost"
              className={`flex-1 py-3 rounded-none ${
                activeTab === "sounds" ? "text-white border-b-2 border-tiktok-pink" : "text-tiktok-gray"
              }`}
              onClick={() => setActiveTab("sounds")}
            >
              <Music className="w-4 h-4 mr-2" />
              Sounds
            </Button>
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            {activeTab === "trending" && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Trending Videos</h2>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tiktok-pink"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {trendingVideos.map((video) => (
                      <Card key={video.id} className="aspect-[9/16] bg-tiktok-dark border-gray-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                        <CardContent className="p-0 h-full relative">
                          <video
                            className="w-full h-full object-cover"
                            src={video.videoUrl}
                            poster={video.thumbnailUrl}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-20" />
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-xs text-white line-clamp-2">
                              {video.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "hashtags" && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Trending Hashtags</h2>
                <div className="space-y-3">
                  {trendingHashtags.map((hashtag, index) => (
                    <Card key={hashtag} className="bg-tiktok-dark border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-tiktok-pink rounded-lg flex items-center justify-center">
                              <Hash className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold">{hashtag}</p>
                              <p className="text-sm text-tiktok-gray">{formatCount(Math.floor(Math.random() * 1000000) + 100000)} videos</p>
                            </div>
                          </div>
                          <div className="text-sm text-tiktok-gray">#{index + 1} trending</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "sounds" && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Trending Sounds</h2>
                <div className="space-y-3">
                  {trendingSounds.map((sound, index) => (
                    <Card key={sound} className="bg-tiktok-dark border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-tiktok-pink to-purple-500 rounded-lg flex items-center justify-center">
                              <Music className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold">{sound}</p>
                              <p className="text-sm text-tiktok-gray">{formatCount(Math.floor(Math.random() * 100000) + 10000)} videos</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="border-tiktok-pink text-tiktok-pink hover:bg-tiktok-pink hover:text-white">
                            Use Sound
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}