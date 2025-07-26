import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Upload, Video } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [musicTitle, setMusicTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      videoFile?: File;
      videoUrl?: string;
      isPublic: boolean;
      musicTitle?: string;
    }) => {
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("description", data.description);
      formData.append("isPublic", data.isPublic.toString());
      if (data.musicTitle) formData.append("musicTitle", data.musicTitle);
      
      if (data.videoFile) {
        formData.append("video", data.videoFile);
      } else if (data.videoUrl) {
        formData.append("videoUrl", data.videoUrl);
      }
      
      return fetch("/api/videos", {
        method: "POST",
        body: formData,
        credentials: "include",
      }).then(res => {
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Video uploaded!",
        description: "Your video has been published successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      handleClose();
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
        title: "Upload failed",
        description: "There was an error uploading your video.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setPrivacy("public");
    setMusicTitle("");
    onClose();
  };

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('video/')) {
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast({
          title: "File too large",
          description: "Please select a video smaller than 100MB.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a video file.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a video to upload.",
        variant: "destructive",
      });
      return;
    }

    // Upload the actual selected file
    uploadMutation.mutate({
      title: title || selectedFile.name.replace(/\.[^/.]+$/, ""),
      description: description || "Check out my new video!",
      videoFile: selectedFile,
      isPublic: privacy === "public",
      musicTitle: musicTitle || "Original Sound",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-tiktok-dark border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Upload Video</h3>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-6 h-6" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-tiktok-pink bg-tiktok-pink bg-opacity-10' 
                  : 'border-gray-600 hover:border-tiktok-pink'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <Video className="w-12 h-12 text-tiktok-pink mx-auto" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-tiktok-gray">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Change Video
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-tiktok-gray mx-auto" />
                  <div>
                    <p className="text-tiktok-gray mb-2">Drag and drop your video here</p>
                    <p className="text-sm text-tiktok-light-gray mb-4">MP4, MOV, AVI files, max 500MB</p>
                    <Button 
                      type="button"
                      className="bg-tiktok-pink hover:bg-tiktok-pink/90"
                      onClick={() => document.getElementById('file-input')?.click()}
                    >
                      Select Video
                    </Button>
                    <input
                      id="file-input"
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          handleFileSelect(files[0]);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Video Details */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter video title..."
                  className="bg-gray-800 border-gray-700 focus:ring-tiktok-pink focus:border-tiktok-pink"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your video..."
                  rows={4}
                  className="bg-gray-800 border-gray-700 focus:ring-tiktok-pink focus:border-tiktok-pink resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Music</label>
                <Input
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                  placeholder="Original sound or music title..."
                  className="bg-gray-800 border-gray-700 focus:ring-tiktok-pink focus:border-tiktok-pink"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Privacy</label>
                <Select value={privacy} onValueChange={setPrivacy}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 focus:ring-tiktok-pink focus:border-tiktok-pink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="friends">Friends</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full bg-tiktok-pink hover:bg-tiktok-pink/90 text-white py-3 font-semibold"
            >
              {uploadMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Uploading...</span>
                </div>
              ) : (
                "Upload Video"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
