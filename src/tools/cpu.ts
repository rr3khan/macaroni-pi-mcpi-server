import os from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getCpuTemperature,
  getCpuFrequency,
} from "../providers/pi-system.js";

interface CpuStatus {
  core_count: number;
  model: string;
  load_average_1m: number;
  load_average_5m: number;
  load_average_15m: number;
  temperature_celsius: number | null;
  frequency_mhz: number | null;
  per_core_speed_mhz: number[];
}

async function getCpuStatus(): Promise<CpuStatus> {
  const cpus = os.cpus();
  const [load1, load5, load15] = os.loadavg();

  return {
    core_count: cpus.length,
    model: cpus[0]?.model ?? "unknown",
    load_average_1m: Math.round(load1 * 100) / 100,
    load_average_5m: Math.round(load5 * 100) / 100,
    load_average_15m: Math.round(load15 * 100) / 100,
    temperature_celsius: await getCpuTemperature(),
    frequency_mhz: await getCpuFrequency(),
    per_core_speed_mhz: cpus.map((c) => c.speed),
  };
}

export function registerCpuTool(server: McpServer): void {
  server.tool(
    "get_cpu_status",
    "Returns CPU info: core count, model, load averages, temperature (Pi only), and per-core clock speeds.",
    {},
    async () => {
      const status = await getCpuStatus();

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
