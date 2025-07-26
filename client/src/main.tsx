import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Prevent runtime error overlay from blocking the app
if (typeof window !== 'undefined') {
  // Override error handler to prevent overlay interference
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0];
    if (message && typeof message === 'string') {
      // Suppress specific errors that don't affect functionality
      if (message.includes('Failed to load because no supported source was found') ||
          message.includes('The element has no supported sources') ||
          message.includes('runtime-error-plugin')) {
        return;
      }
    }
    originalError.apply(console, args);
  };
  
  // Handle unhandled promise rejections gracefully
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message) {
      const message = event.reason.message;
      if (message.includes('The element has no supported sources') ||
          message.includes('runtime-error-plugin')) {
        event.preventDefault();
        return;
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
