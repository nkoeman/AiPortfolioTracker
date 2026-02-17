type MapLogLevel = "info" | "warn" | "error";

// Formats mapping logs with a stable prefix so failures can be filtered quickly in container logs.
export function logMap(stage: string, message: string, payload: Record<string, unknown> = {}, level: MapLogLevel = "info") {
  const line = `[MAP] [${stage}] ${message}`;

  if (level === "error") {
    console.error(line, payload);
    return;
  }

  if (level === "warn") {
    console.warn(line, payload);
    return;
  }

  console.info(line, payload);
}