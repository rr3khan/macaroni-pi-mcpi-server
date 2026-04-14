import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../logger.js";
import { execCommand, readSysFile } from "../providers/pi-system.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = createLogger("health-check");

interface DepCheck {
  name: string;
  status: "ok" | "degraded" | "missing" | "corrupt";
  version: string | null;
  path: string | null;
  detail: string | null;
}

interface HealthReport {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  dependencies: DepCheck[];
  filesystem: {
    sd_card_health: string | null;
    root_usage_percent: number | null;
    logs_dir_writable: boolean;
  };
  runtime: {
    pid: number;
    uptime_seconds: number;
    memory_usage_mb: number;
    node_version: string;
  };
}

async function checkBinary(
  name: string,
  path: string,
  versionArgs: string[],
): Promise<DepCheck> {
  const raw = await execCommand("file", [path]);

  if (raw === null) {
    return { name, status: "missing", version: null, path, detail: `${path} not found` };
  }

  if (raw.includes("data") || raw.includes("empty")) {
    return { name, status: "corrupt", version: null, path, detail: `${path} appears corrupt: ${raw}` };
  }

  if (!raw.includes("ELF") && !raw.includes("Mach-O") && !raw.includes("executable") && !raw.includes("script")) {
    return { name, status: "corrupt", version: null, path, detail: `Unexpected file type: ${raw}` };
  }

  const version = await execCommand(path, versionArgs);
  if (version === null) {
    return { name, status: "degraded", version: null, path, detail: `Binary exists but failed to execute` };
  }

  return { name, status: "ok", version: version.trim(), path, detail: null };
}

async function checkOpAuth(): Promise<DepCheck> {
  const result = await execCommand("op", ["account", "get", "--format=json"]);
  if (result === null) {
    return {
      name: "op-auth",
      status: "degraded",
      version: null,
      path: null,
      detail: "1Password CLI not authenticated (service account token may be missing)",
    };
  }
  return { name: "op-auth", status: "ok", version: null, path: null, detail: "Authenticated" };
}

async function checkServicesJson(): Promise<DepCheck> {
  const manifestPath = resolve(__dirname, "../../services.json");

  try {
    const raw = await readFile(manifestPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const count = typeof parsed === "object" && parsed !== null ? Object.keys(parsed).length : 0;
    return {
      name: "services.json",
      status: "ok",
      version: null,
      path: manifestPath,
      detail: `${count} service(s) configured`,
    };
  } catch (err) {
    return {
      name: "services.json",
      status: "missing",
      version: null,
      path: manifestPath,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkLogsWritable(): Promise<boolean> {
  const logDir = resolve(__dirname, "../../logs");

  try {
    await mkdir(logDir, { recursive: true });
    const testFile = resolve(logDir, ".health-check-probe");
    await appendFile(testFile, "");
    return true;
  } catch {
    return false;
  }
}

async function getRootUsage(): Promise<number | null> {
  const raw = await execCommand("df", ["--output=pcent", "/"]);
  if (raw === null) return null;
  const match = raw.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

async function getSdCardHealth(): Promise<string | null> {
  const lifetime = await readSysFile("/sys/block/mmcblk0/device/life_time");
  if (lifetime === null) return null;

  const [typeA, typeB] = lifetime.split(/\s+/).map((v) => parseInt(v, 16));
  const worstLevel = Math.max(typeA || 0, typeB || 0);

  if (worstLevel <= 1) return "excellent (0-10% used)";
  if (worstLevel <= 3) return "good (10-30% used)";
  if (worstLevel <= 5) return "fair (30-50% used)";
  if (worstLevel <= 7) return "worn (50-70% used)";
  if (worstLevel <= 9) return "critical (70-90% used)";
  return "end-of-life (90%+ used) — replace soon!";
}

async function runHealthCheck(): Promise<HealthReport> {
  const nodePath = await execCommand("which", ["node"]) ?? "/usr/local/bin/node";
  const opPath = await execCommand("which", ["op"]) ?? "/usr/local/bin/op";

  const [node, op, opAuth, servicesJson, logsWritable, rootUsage, sdHealth] =
    await Promise.all([
      checkBinary("node", nodePath, ["--version"]),
      checkBinary("op", opPath, ["--version"]),
      checkOpAuth(),
      checkServicesJson(),
      checkLogsWritable(),
      getRootUsage(),
      getSdCardHealth(),
    ]);

  const deps = [node, op, opAuth, servicesJson];
  const hasMissing = deps.some((d) => d.status === "missing" || d.status === "corrupt");
  const hasDegraded = deps.some((d) => d.status === "degraded");

  let overall: HealthReport["overall"] = "healthy";
  if (hasMissing) overall = "unhealthy";
  else if (hasDegraded) overall = "degraded";

  const memUsage = process.memoryUsage();

  return {
    overall,
    timestamp: new Date().toISOString(),
    dependencies: deps,
    filesystem: {
      sd_card_health: sdHealth,
      root_usage_percent: rootUsage,
      logs_dir_writable: logsWritable,
    },
    runtime: {
      pid: process.pid,
      uptime_seconds: Math.round(process.uptime()),
      memory_usage_mb: Math.round(memUsage.rss / (1024 * 1024)),
      node_version: process.version,
    },
  };
}

export function registerHealthCheckTool(server: McpServer): void {
  server.tool(
    "health_check",
    "Runs a comprehensive health check: verifies Node.js, op CLI, authentication, services.json, filesystem, SD card wear, and runtime status. Use this to diagnose connectivity or deployment issues.",
    {},
    async () => {
      log.info("running health check");
      const report = await runHealthCheck();
      log.info(`health check complete: ${report.overall}`, {
        deps: report.dependencies.map((d) => `${d.name}:${d.status}`).join(", "),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    },
  );
}
