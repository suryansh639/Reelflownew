import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent runtime error overlay from blocking the app
if (typeof window !== 'undefined') {
  // Override error handler to prevent overlay interference
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Failed to load because no supported source was found')) {
      // Suppress specific Vite plugin error
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
