/** Single-line JSON logs for servers / local debugging (Vercel logs, `next dev`). */

export type LogLevel = "debug" | "info" | "warn" | "error";

export function logStructured(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    level,
    message,
    t: new Date().toISOString(),
    ...fields,
  });
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}
