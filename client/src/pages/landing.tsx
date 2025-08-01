import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Reels</h1>
        <p className="text-gray-600 mb-8">
          Discover and share amazing short videos. Sign in with Google to upload videos and interact with content!
        </p>
        <div className="space-y-4">
          <Button 
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 text-lg"
            onClick={() => window.location.href = "/api/auth/google"}
          >
            Sign in with Google
          </Button>
          <Button 
            variant="outline"
            className="w-full py-3 text-lg"
            onClick={() => window.location.href = "/"}
          >
            Browse as Guest
          </Button>
          <p className="text-sm text-gray-500">
            You can view videos without signing in, but need to sign in to upload or interact
          </p>
        </div>
      </div>
    </div>
  );
}
