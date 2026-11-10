type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const sensitiveKey = /password|secret|token|authorization|cookie|signature|payload|address|api[_-]?key|service[_-]?role[_-]?key/i;
const piiKey = /email|phone/i;

function safeFields(fields: LogFields): LogFields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (sensitiveKey.test(key)) return [key, "[REDACTED]"];
    if (piiKey.test(key) && typeof value === "string") return [key, value.length > 4 ? `***${value.slice(-4)}` : "***"];
    // Provider and SQL errors can contain input values, URLs or request headers.
    if (key === "error" || value instanceof Error) {
      const code = value && typeof value === "object" && "code" in value ? String(value.code) : "";
      return [key, /^[A-Z0-9_]{2,32}$/.test(code) ? {code} : {type:"operation_failed"}];
    }
    return [key, value];
  }));
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...safeFields(fields) },
    (key, value) => sensitiveKey.test(key) ? "[REDACTED]" : typeof value === "string" ? value.replace(/sb_secret_[A-Za-z0-9_-]+/g,"[REDACTED]") : value);
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
