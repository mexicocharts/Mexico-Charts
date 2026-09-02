import { createHash } from "node:crypto";
import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

type ClerkAuthResolver = (req: Request) => ReturnType<typeof getAuth>;

type RequireClerkUserOptions = {
  configured?: () => boolean;
  now?: () => number;
  resolveAuth?: ClerkAuthResolver;
};

export function clerkConfigured(): boolean {
  return Boolean(
    process.env["CLERK_PUBLISHABLE_KEY"]?.trim() &&
    process.env["CLERK_SECRET_KEY"]?.trim(),
  );
}

export function safeClerkIdentityHash(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function safeRequestPath(req: Request): string {
  return String(req.originalUrl || req.url || "")
    .split("?")[0]!
    .slice(0, 512);
}

function safelyInferredAuthSource(req: Request): "bearer" | "cookie" | "none" {
  const authorization = req.headers.authorization;
  if (
    typeof authorization === "string" &&
    /^Bearer\s+\S+/i.test(authorization)
  ) {
    return "bearer";
  }
  return typeof req.headers.cookie === "string" && req.headers.cookie.length > 0
    ? "cookie"
    : "none";
}

function logAuthResolution(
  req: Request,
  level: "info" | "warn",
  fields: Record<string, unknown>,
  message: string,
) {
  req.log?.[level]({ event: "clerk_auth_resolution", ...fields }, message);
}

const configuredClerkMiddleware = clerkConfigured() ? clerkMiddleware() : null;

export const optionalClerkAuth: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();
  res.locals["clerkAuthMiddlewareStartedAt"] = startedAt;
  res.locals["clerkAuthMiddlewareReached"] = Boolean(configuredClerkMiddleware);
  if (!configuredClerkMiddleware) {
    next();
    return;
  }
  configuredClerkMiddleware(req, res, (error) => {
    res.locals["clerkAuthMiddlewareDurationMs"] = Number(
      (performance.now() - startedAt).toFixed(1),
    );
    if (error) {
      logAuthResolution(
        req,
        "warn",
        {
          authMiddlewareReached: true,
          clerkIdentityResolved: false,
          authSource: safelyInferredAuthSource(req),
          identityHash: null,
          requestPath: safeRequestPath(req),
          authResolutionDurationMs: res.locals["clerkAuthMiddlewareDurationMs"],
          middlewareErrorType: error instanceof Error ? error.name : "unknown",
        },
        "Clerk authentication middleware failed",
      );
    }
    next(error);
  });
};

export function createRequireClerkUser({
  configured = clerkConfigured,
  now = () => performance.now(),
  resolveAuth = (req) => getAuth(req),
}: RequireClerkUserOptions = {}): RequestHandler {
  return (req, res, next) => {
    const startedAt = Number(
      res.locals["clerkAuthMiddlewareStartedAt"] ?? now(),
    );
    const common = {
      authMiddlewareReached: Boolean(
        res.locals["clerkAuthMiddlewareReached"] ?? configured(),
      ),
      authSource: safelyInferredAuthSource(req),
      requestPath: safeRequestPath(req),
    };

    if (!configured()) {
      logAuthResolution(
        req,
        "warn",
        {
          ...common,
          clerkIdentityResolved: false,
          identityHash: null,
          authResolutionDurationMs: Number((now() - startedAt).toFixed(1)),
          outcome: "auth_not_configured",
        },
        "Clerk authentication is not configured",
      );
      res.status(503).json({
        error: "Accounts are not configured yet",
        code: "auth_not_configured",
      });
      return;
    }

    let auth: ReturnType<typeof getAuth>;
    try {
      auth = resolveAuth(req);
    } catch (error) {
      logAuthResolution(
        req,
        "warn",
        {
          ...common,
          clerkIdentityResolved: false,
          identityHash: null,
          authResolutionDurationMs: Number((now() - startedAt).toFixed(1)),
          outcome: "auth_resolution_error",
        },
        "Clerk identity resolution failed",
      );
      next(error);
      return;
    }

    const identityResolved = Boolean(auth.isAuthenticated && auth.userId);
    const identityHash = identityResolved
      ? safeClerkIdentityHash(auth.userId!)
      : null;
    logAuthResolution(
      req,
      identityResolved ? "info" : "warn",
      {
        ...common,
        clerkIdentityResolved: identityResolved,
        identityHash,
        authResolutionDurationMs: Number((now() - startedAt).toFixed(1)),
        outcome: identityResolved ? "authenticated" : "sign_in_required",
      },
      identityResolved ? "Clerk identity resolved" : "Clerk identity denied",
    );

    if (!identityResolved) {
      res
        .status(401)
        .json({ error: "Sign in required", code: "sign_in_required" });
      return;
    }
    res.locals["clerkUserId"] = auth.userId;
    next();
  };
}

export const requireClerkUser = createRequireClerkUser();

export function clerkUserId(res: Parameters<RequestHandler>[1]): string {
  return String(res.locals["clerkUserId"] ?? "");
}
