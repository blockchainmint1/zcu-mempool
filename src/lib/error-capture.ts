// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

export function isDisconnectedRequest(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const coded = error as Error & { code?: string; cause?: unknown };
  if (coded.code === "ECONNRESET" || coded.message.toLowerCase() === "aborted") return true;
  return coded.cause !== undefined && isDisconnectedRequest(coded.cause);
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => {
    const error = (event as ErrorEvent).error ?? event;
    if (isDisconnectedRequest(error)) {
      event.preventDefault();
      return;
    }
    record(error);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const error = (event as PromiseRejectionEvent).reason;
    if (isDisconnectedRequest(error)) {
      event.preventDefault();
      return;
    }
    record(error);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
