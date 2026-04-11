import os from "node:os";
import { readFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  kernel: string;
  uptime_seconds: number;
  uptime_human: string;
  node_version: string;
  is_raspberry_pi: boolean;
  pi_model: string | null;
}

async function detectPiModel(): Promise<string | null> {
  try {
    const model = await readFile("/proc/device-tree/model", "utf-8");
    return model.replace(/\0/g, "").trim();
  } catch {
    return null;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

async function getSystemInfo(): Promise<SystemInfo> {
  const piModel = await detectPiModel();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    kernel: os.release(),
    uptime_seconds: os.uptime(),
    uptime_human: formatUptime(os.uptime()),
    node_version: process.version,
    is_raspberry_pi: piModel !== null,
    pi_model: piModel,
  };
}

export function registerSystemInfoTool(server: McpServer): void {
  server.tool(
    "get_system_info",
    "Returns basic system metadata: hostname, OS, architecture, kernel version, uptime, and whether this is a Raspberry Pi.",
    {},
    async () => {
      const info = await getSystemInfo();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    },
  );
}
