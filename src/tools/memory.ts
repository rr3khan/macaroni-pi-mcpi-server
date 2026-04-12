import os from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseMeminfo } from "../providers/pi-system.js";

interface MemoryStatus {
  total_mb: number;
  used_mb: number;
  free_mb: number;
  usage_percent: number;
  swap_total_mb: number;
  swap_used_mb: number;
  swap_free_mb: number;
  source: "procfs" | "node_os";
}

function kbToMb(kb: number): number {
  return Math.round(kb / 1024);
}

function bytesToMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

async function getMemoryStatus(): Promise<MemoryStatus> {
  const meminfo = await parseMeminfo();

  if (meminfo) {
    const usedKb =
      meminfo.mem_total_kb - meminfo.mem_available_kb;
    return {
      total_mb: kbToMb(meminfo.mem_total_kb),
      used_mb: kbToMb(usedKb),
      free_mb: kbToMb(meminfo.mem_available_kb),
      usage_percent:
        Math.round((usedKb / meminfo.mem_total_kb) * 10000) / 100,
      swap_total_mb: kbToMb(meminfo.swap_total_kb),
      swap_used_mb: kbToMb(
        meminfo.swap_total_kb - meminfo.swap_free_kb,
      ),
      swap_free_mb: kbToMb(meminfo.swap_free_kb),
      source: "procfs",
    };
  }

  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total_mb: bytesToMb(total),
    used_mb: bytesToMb(used),
    free_mb: bytesToMb(free),
    usage_percent: Math.round((used / total) * 10000) / 100,
    swap_total_mb: 0,
    swap_used_mb: 0,
    swap_free_mb: 0,
    source: "node_os",
  };
}

export function registerMemoryTool(server: McpServer): void {
  server.tool(
    "get_memory_status",
    "Returns RAM and swap usage in MB with percentage. Uses /proc/meminfo on Linux/Pi, falls back to Node os module on macOS.",
    {},
    async () => {
      const status = await getMemoryStatus();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );
}
