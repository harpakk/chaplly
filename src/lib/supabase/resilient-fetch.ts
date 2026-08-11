const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const SAFE_READ_RPCS = [
  "/rpc/service_admin_overview",
  "/rpc/service_catalog_products",
  "/rpc/service_marketplace_context",
  "/rpc/service_supplier_catalog_stats",
];
const SAFE_WRITE_PATHS = [
  "/rest/v1/storage_files",
  "/rpc/service_save_raw_product_media",
  // Password sign-in only issues a session and is safe to retry after a
  // transient network failure. This keeps completed registrations from being
  // reported as failed solely because the final session request dropped.
  "/auth/v1/token",
];

const requestUrl = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : String(input);

async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const relayAbort = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) relayAbort();
  else upstreamSignal?.addEventListener("abort", relayAbort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("Supabase request timed out")),
    timeoutMs,
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", relayAbort);
  }
}

export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = requestUrl(input);
  const method = (init?.method || (input instanceof Request ? input.method : "GET"))
    .toUpperCase();
  const isStorageWrite =
    url.includes("/storage/v1/object/") && !["GET", "HEAD"].includes(method);
  const canRetry =
    ["GET", "HEAD"].includes(method) ||
    SAFE_READ_RPCS.some((path) => url.includes(path)) ||
    SAFE_WRITE_PATHS.some((path) => url.includes(path));
  // A JWT clock-skew rejection is safe to retry even for a write: PostgREST
  // rejects it before the request reaches a transaction.
  const attempts = 2;
  // Writes can legitimately take longer while Supabase wakes a paused project
  // or commits uploaded-file metadata. Ten seconds caused successful image
  // uploads to be reported as failed during raw-product edits.
  const timeoutMs = isStorageWrite ? 60_000 : 30_000;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithDeadline(input, init, timeoutMs);
      const jwtClockSkew =
        response.status === 401 &&
        (await response.clone().text()).toLowerCase().includes("jwt issued at future");
      const retryableResponse =
        jwtClockSkew || (canRetry && RETRYABLE_STATUS.has(response.status));
      if (!retryableResponse || attempt === attempts - 1)
        return response;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (!canRetry || attempt === attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Supabase network request failed");
}
