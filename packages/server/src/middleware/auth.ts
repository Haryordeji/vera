import { clerkMiddleware, requireAuth } from "@clerk/express";
import { RequestHandler } from "express";

// Initialise Clerk — must be applied before any route handlers.
// Parses the session token and attaches auth state to every request.
export const clerkInit = clerkMiddleware();

// Rejects unauthenticated requests with 401 for all /api/* routes
// except the health check, which is intentionally public.
export const requireAuthMiddleware: RequestHandler = (req, res, next) => {
  if (req.path === "/api/health") return next();
  return requireAuth()(req, res, next);
};
