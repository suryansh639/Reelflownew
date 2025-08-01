import { useState } from "react";
import { useLocation } from "wouter";
import { Home, Compass, Plus, Inbox, User, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import UploadModal from "./UploadModal";

export default function BottomNavigation() {
  const [location, setLocation] = useLocation();
  const [showUpload, setShowUpload] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const getActiveTab = () => {
    if (location === "/") return "home";
    if (location === "/discover") return "discover";
    if (location === "/profile") return "profile";
    return "home";
  };

  const activeTab = getActiveTab();

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50">
        <div className="flex items-center justify-around px-4 py-2">
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "home" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={() => setLocation("/")}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "discover" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={() => setLocation("/discover")}
          >
            <Compass className="w-6 h-6" />
            <span className="text-xs">Discover</span>
          </Button>
          
          {/* Upload Button */}
          <Button
            variant="ghost"
            className="relative p-2"
            onClick={() => {
              if (!isAuthenticated) {
                toast({
                  title: "Authentication Required",
                  description: "Please sign in with Google to upload videos",
                  variant: "destructive",
                });
                return;
              }
              setShowUpload(true);
            }}
          >
            <div className="w-12 h-8 bg-white rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-black" />
            </div>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "inbox" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={() => alert("Inbox feature coming soon!")}
          >
            <Inbox className="w-6 h-6" />
            <span className="text-xs">Inbox</span>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "profile" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={() => {
              if (!isAuthenticated) {
                window.location.href = "/api/auth/google";
                return;
              }
              setLocation("/profile");
            }}
          >
            {isAuthenticated ? (
              <User className="w-6 h-6" />
            ) : (
              <LogIn className="w-6 h-6" />
            )}
            <span className="text-xs">{isAuthenticated ? "Profile" : "Sign In"}</span>
          </Button>
        </div>
      </nav>

      <UploadModal 
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
      />
    </>
  );
}
