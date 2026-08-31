function sanitizedMessage(value: unknown) {
  return String(value)
    .replace(/([?&](?:key|api_key|access_token|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_GOOGLE_API_KEY]");
}

type SafeErrorLog = Record<string, unknown> & {
  error: { name: string; message: string; stack?: string; cause?: { name?: string; message: string } };
};

export function safeErrorDetails(error: unknown, context: Record<string, unknown> = {}): SafeErrorLog {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error
      ? { name: error.cause.name, message: sanitizedMessage(error.cause.message) }
      : error.cause == null ? undefined : { message: sanitizedMessage(error.cause) };
    return {
      ...context,
      error: {
        name: error.name,
        message: sanitizedMessage(error.message),
        stack: error.stack ? sanitizedMessage(error.stack) : undefined,
        cause,
      },
    };
  }
  return { ...context, error: { name: typeof error, message: sanitizedMessage(error) } };
}
