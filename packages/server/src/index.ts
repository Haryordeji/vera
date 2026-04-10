import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { clerkInit, requireAuthMiddleware } from "./middleware/auth";
import authRouter from "./routes/auth";

export const app = express();

app.use(cors());
app.use(express.json());

// Health check — registered BEFORE Clerk middleware so it's always reachable
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Clerk: parse session token on every request
app.use(clerkInit);

// Reject unauthenticated requests on all /api/* routes (health is already handled above)
app.use(requireAuthMiddleware);

// Routes
app.use("/api/auth", authRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT ?? 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
