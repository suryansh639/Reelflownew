import { useState } from "react";
import { Home, Compass, Plus, Inbox, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadModal from "./UploadModal";

export default function BottomNavigation() {
  const [activeTab, setActiveTab] = useState("home");
  const [showUpload, setShowUpload] = useState(false);

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-50">
        <div className="flex items-center justify-around px-4 py-2">
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "home" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={() => setActiveTab("home")}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "discover" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={() => setActiveTab("discover")}
          >
            <Compass className="w-6 h-6" />
            <span className="text-xs">Discover</span>
          </Button>
          
          {/* Upload Button */}
          <Button
            variant="ghost"
            className="relative p-2"
            onClick={() => setShowUpload(true)}
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
            onClick={() => setActiveTab("inbox")}
          >
            <Inbox className="w-6 h-6" />
            <span className="text-xs">Inbox</span>
          </Button>
          
          <Button
            variant="ghost"
            className={`flex flex-col items-center space-y-1 py-3 px-2 ${
              activeTab === "profile" ? "text-white" : "text-tiktok-gray"
            }`}
            onClick={handleLogout}
          >
            <User className="w-6 h-6" />
            <span className="text-xs">Profile</span>
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
