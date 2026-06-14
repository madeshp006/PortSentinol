import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { connectDatabase, prisma } from "./config/db.js";
import { initSocket, emitToUser } from "./services/socketManager.js";
import { serialize } from "./utils/serialize.js";

import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import scanRoutes from "./routes/scan.js";
import scansRoutes from "./routes/scans.js";
import agentRoutes from "./routes/agents.js";
import alertsRoutes from "./routes/alerts.js";
import schedulesRoutes from "./routes/schedules.js";
import adminRoutes from "./routes/admin.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Security hardening: Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP for dev convenience, toggle back if strict
}));

// Rate limiting: prevent API abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again after 15 minutes." }
});
app.use("/api/", limiter);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const isLocalhost = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
    if (isLocalhost) return callback(null, true);

    if (process.env.CLIENT_ORIGIN && origin === process.env.CLIENT_ORIGIN) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-agent-key"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send("PortSentinel backend is running");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "PortSentinel API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/scan", scanRoutes);
app.use("/api/scans", scansRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/schedules", schedulesRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: err.message || "Internal server error" });
});

connectDatabase()
  .then(() => {
    // Wrap Express app with HTTP server for Socket.IO integration
    const server = createServer(app);
    initSocket(server);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`PortSentinel API listening on http://0.0.0.0:${PORT}`);
    });

    // Daemon: Inactive Agent offline-marking daemon
    setInterval(async () => {
      try {
        const threshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes threshold
        const inactiveAgents = await prisma.agent.findMany({
          where: {
            lastSeen: { lt: threshold },
            status: { not: "offline" }
          }
        });

        if (inactiveAgents.length > 0) {
          await prisma.agent.updateMany({
            where: {
              id: { in: inactiveAgents.map((a) => a.id) }
            },
            data: { status: "offline" }
          });

          for (const agent of inactiveAgents) {
            emitToUser(agent.userId, "agent:status", {
              agentId: agent.agentId,
              status: "offline",
              agent: serialize({ ...agent, status: "offline" }),
            });
            console.log(`[Agent Monitor] Inactivity threshold hit. Marked agent offline: ${agent.name} (${agent.agentId})`);
          }
        }
      } catch (err) {
        console.error("[Agent Monitor Error]:", err.message);
      }
    }, 30000); // Check every 30 seconds
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message || error);
    process.exit(1);
  });
