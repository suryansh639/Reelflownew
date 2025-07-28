import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Heart, MessageCircle, Share } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-tiktok-dark border-gray-800">
        <CardContent className="pt-8 pb-6 text-center">
          {/* Logo/Brand */}
          <div className="mb-8">
            <div className="w-16 h-16 bg-tiktok-pink rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
            <h1 className="text-2xl font-bold">TikTok Style</h1>
            <p className="text-tiktok-light-gray text-sm">Discover amazing short videos</p>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center space-x-2 text-sm">
              <Heart className="w-4 h-4 text-tiktok-pink" />
              <span>Like and share videos</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm">
              <MessageCircle className="w-4 h-4 text-tiktok-cyan" />
              <span>Comment and engage</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm">
              <Share className="w-4 h-4 text-tiktok-light-gray" />
              <span>Share with friends</span>
            </div>
          </div>

          {/* Access Button */}
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-tiktok-pink hover:bg-tiktok-pink/90 text-white font-semibold py-3 rounded-lg transition-all duration-300"
          >
            Watch Videos
          </Button>

          <p className="text-xs text-tiktok-gray mt-4">
            Join millions of creators sharing their stories
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
