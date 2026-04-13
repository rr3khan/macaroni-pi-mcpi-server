import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDiskUsage, type DiskUsageEntry } from "../providers/pi-system.js";

interface DiskStatus {
  filesystems: DiskFilesystem[];
  total_size_gb: number;
  total_used_gb: number;
  total_available_gb: number;
}

interface DiskFilesystem {
  filesystem: string;
  mount: string;
  size_gb: number;
  used_gb: number;
  available_gb: number;
  use_percent: number;
}

function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

function toFilesystem(entry: DiskUsageEntry): DiskFilesystem {
  return {
    filesystem: entry.filesystem,
    mount: entry.mount,
    size_gb: bytesToGb(entry.size_bytes),
    used_gb: bytesToGb(entry.used_bytes),
    available_gb: bytesToGb(entry.available_bytes),
    use_percent: entry.use_percent,
  };
}

async function getDiskStatus(): Promise<DiskStatus> {
  const raw = await getDiskUsage();

  const physical = raw.filter(
    (e) =>
      !e.filesystem.startsWith("devfs") &&
      !e.filesystem.startsWith("map ") &&
      e.size_bytes > 0,
  );

  const filesystems = physical.map(toFilesystem);

  return {
    filesystems,
    total_size_gb: filesystems.reduce((s, f) => s + f.size_gb, 0),
    total_used_gb: filesystems.reduce((s, f) => s + f.used_gb, 0),
    total_available_gb: filesystems.reduce(
      (s, f) => s + f.available_gb,
      0,
    ),
  };
}

export function registerDiskTool(server: McpServer): void {
  server.tool(
    "get_disk_status",
    "Returns disk usage for all mounted filesystems: size, used, available in GB, and usage percentage.",
    {},
    async () => {
      const status = await getDiskStatus();

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
