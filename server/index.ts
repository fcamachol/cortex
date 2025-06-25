import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeEvolutionApi } from "./evolution-api";
import { SseManager } from "./sse-manager"; // Import the SSE manager
import { ScheduledJobsService } from "./scheduled-jobs";

// Main async function to start the server
(async () => {
    // 1. Initialize Express App
    const app = express();
    const server = createServer(app);

    // Configure server timeouts for SSE connections
    server.timeout = 0; // Disable server timeout for SSE
    server.keepAliveTimeout = 65000; // Keep connections alive
    server.headersTimeout = 66000; // Headers timeout

    // 2. Setup Middleware
    // Use a large limit to handle webhooks with base64 media
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Add CORS headers for production deployment
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
        
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });

    // Optional: Add a simple logging middleware
    app.use((req, res, next) => {
        res.on("finish", () => {
            if (req.path.startsWith("/api")) {
                 console.log(`${req.method} ${req.path} ${res.statusCode} `);
            }
        });
        next();
    });
    
    // 3. Initialize External Services
    console.log("🔗 Configuring Evolution API...");
    initializeEvolutionApi({
        baseUrl: process.env.EVOLUTION_API_URL || 'https://evolution-api-evolution-api.vuswn0.easypanel.host',
        apiKey: process.env.EVOLUTION_API_KEY || '119FA240-45ED-46A7-AE13-5A1B7C909D7D'
    });

    // Optional: Perform an initial health check on startup
    try {
        const response = await fetch(process.env.EVOLUTION_API_URL || 'https://evolution-api-evolution-api.vuswn0.easypanel.host');
        if(response.ok) console.log("✅ Evolution API health check successful.");
    } catch (error) {
        console.warn("⚠️ Evolution API health check failed on startup. Will retry on first use.");
    }
    
    // 4. Register API and Real-time Routes
    registerRoutes(app);

    // This single route handles real-time updates pushed to the frontend
    app.get('/api/events', SseManager.handleNewConnection);

    // 4.5. Start Scheduled Jobs for Bill Processing
    console.log("⏰ Starting scheduled jobs for bill processing...");
    ScheduledJobsService.start();

    // 5. Setup Frontend Serving (Vite for Dev, Static for Prod)
    if (process.env.NODE_ENV === "development") {
        await setupVite(app, server);
    } else {
        serveStatic(app);
    }

    // 6. Global Error Handling Middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || 500;
        const message = err.message || "Internal Server Error";
        console.error("❌ Server Error:", err.stack);
        res.status(status).json({ error: message });
    });

    // 7. Start the Server
    const port = process.env.PORT || 5000;
    server.listen(port, "0.0.0.0", () => {
        console.log(`🚀 Server listening on port ${port}`);
    });

})();