import express from "express";
import { getConfig, getServerConfig } from "./lib/config.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { errorMiddleware } from "./middleware/error.js";
import { logger } from "./lib/logger.js";
import chatRouter from "./routes/chat.js";
import healthRouter from "./routes/health.js";

// Load config early to fail fast on misconfiguration
const config = getConfig();
const { port } = getServerConfig();

const app = express();

// Middleware
app.use(createCorsMiddleware());
app.use(express.json({ limit: "1mb" }));

// Routes
app.use(healthRouter);
app.use(chatRouter);

// Error handling (must be last)
app.use(errorMiddleware);

app.listen(port, () => {
  logger.info(`cBioPortal Assistant API listening on port ${port}`);
});

export default app;
