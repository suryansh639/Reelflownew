import express, { type Request, type Response, type NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import { registerRoutes } from "./routes.js";
import { setupVite, log } from "./vite.js";

// Resolve __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DATABASE_URL check
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logger for /api
app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathReq.startsWith("/api")) {
      let logLine = `${req.method} ${pathReq} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// Serve static files in production
function serveStatic(app: express.Express) {
  const distPath = path.resolve(__dirname, "../client/dist");

  app.use(compression()); // Gzip/Brotli compression
  app.use(express.static(distPath, {
    maxAge: "1y",
    index: false,
  }));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

(async () => {
  const server = await registerRoutes(app);

  // Error middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Vite in development, static in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`✅ Server running on port ${port}`);
  });
})();
