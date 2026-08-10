import { clerkMiddleware, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export function clerkConfigured(): boolean {
  return Boolean(
    process.env["CLERK_PUBLISHABLE_KEY"]?.trim()
    && process.env["CLERK_SECRET_KEY"]?.trim(),
  );
}

const configuredClerkMiddleware = clerkConfigured() ? clerkMiddleware() : null;

export const optionalClerkAuth: RequestHandler = (req, res, next) => {
  if (!configuredClerkMiddleware) {
    next();
    return;
  }
  configuredClerkMiddleware(req, res, next);
};

export const requireClerkUser: RequestHandler = (req, res, next) => {
  if (!clerkConfigured()) {
    res.status(503).json({
      error: "Accounts are not configured yet",
      code: "auth_not_configured",
    });
    return;
  }

  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    res.status(401).json({ error: "Sign in required", code: "sign_in_required" });
    return;
  }
  res.locals["clerkUserId"] = auth.userId;
  next();
};

export function clerkUserId(res: Parameters<RequestHandler>[1]): string {
  return String(res.locals["clerkUserId"] ?? "");
}
