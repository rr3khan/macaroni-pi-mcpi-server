import { appendFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = resolve(__dirname, "../../logs");
const LOG_FILE = resolve(LOG_DIR, "mcpi-server.log");

const MAX_LOG_LINES = 2000;
let lineCount = 0;

type LogLevel = "info" | "warn" | "error" | "debug";

async function ensureLogDir(): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
  } catch {
    // best-effort
  }
}

function formatMessage(level: LogLevel, component: string, msg: string, data?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${component}] ${msg}`;
  if (data && Object.keys(data).length > 0) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

async function writeToFile(line: string): Promise<void> {
  if (lineCount === 0) await ensureLogDir();
  if (lineCount < MAX_LOG_LINES) {
    try {
      await appendFile(LOG_FILE, line + "\n");
      lineCount++;
    } catch {
      // best-effort
    }
  }
}

function createLogger(component: string) {
  return {
    info(msg: string, data?: Record<string, unknown>): void {
      const formatted = formatMessage("info", component, msg, data);
      console.error(formatted);
      void writeToFile(formatted);
    },
    warn(msg: string, data?: Record<string, unknown>): void {
      const formatted = formatMessage("warn", component, msg, data);
      console.error(formatted);
      void writeToFile(formatted);
    },
    error(msg: string, data?: Record<string, unknown>): void {
      const formatted = formatMessage("error", component, msg, data);
      console.error(formatted);
      void writeToFile(formatted);
    },
    debug(msg: string, data?: Record<string, unknown>): void {
      const formatted = formatMessage("debug", component, msg, data);
      void writeToFile(formatted);
    },
  };
}

export { createLogger, LOG_FILE };
