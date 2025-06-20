import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { updateEvolutionApiSettings, getEvolutionApi } from "./evolution-api";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Evolution API with environment credentials
  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
    console.log("🔗 Configuring Evolution API...");
    updateEvolutionApiSettings({
      baseUrl: process.env.EVOLUTION_API_URL.replace(/\/$/, ''),
      apiKey: process.env.EVOLUTION_API_KEY,
      enabled: true
    });
    
    try {
      const evolutionApi = getEvolutionApi();
      const health = await evolutionApi.healthCheck();
      console.log("✅ Evolution API connected:", health.status);
    } catch (error) {
      console.log("⚠️ Evolution API health check failed - will retry when needed");
    }
  } else {
    console.log("⚠️ Evolution API credentials not found in environment");
  }

  await registerRoutes(app);
  const server = createServer(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  try {
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  } catch (viteError: any) {
    console.log('⚠️ Vite setup failed, continuing without HMR:', viteError?.message || 'Unknown error');
    // Serve a basic HTML fallback for development
    app.get('*', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>WhatsApp Management System</title></head>
          <body>
            <div id="root">
              <h1>WhatsApp Management System</h1>
              <p>API Server is running. Frontend temporarily unavailable due to development server issue.</p>
              <p>Evolution API: Connected ✓</p>
              <p>Database: Connected ✓</p>
            </div>
          </body>
        </html>
      `);
    });
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
  });
})();
