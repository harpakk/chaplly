import "server-only";

const secretKeys = /token|secret|password|authorization|cookie|private|card|iban/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        secretKeys.test(key) ? "[REDACTED]" : redact(item),
      ]),
    );
  return value;
}

export function logServerEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  const safeFields = redact(fields) as Record<string, unknown>;
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: process.env.DEPLOYMENT_ENV || "development",
    release: process.env.RELEASE_VERSION || "development",
    ...safeFields,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
