import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  loadServicesManifest,
  spawnWithEnvironment,
  stopService,
  isServiceRunning,
  getRunningServiceNames,
} from "../providers/onepassword.js";

export function registerServicesTools(server: McpServer): void {
  server.tool(
    "list_services",
    "Lists all configured services with their running/stopped status and description. Does not expose secrets.",
    {},
    async () => {
      const manifest = await loadServicesManifest();
      const running = new Set(getRunningServiceNames());

      const services = Object.entries(manifest).map(([name, config]) => ({
        name,
        status: running.has(name) ? "running" : "stopped",
        port: config.port,
        description: config.description,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ services }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "deploy_service",
    "Starts a service with secrets securely injected from its 1Password Environment via `op run`. The LLM never sees the secret values.",
    { service: z.string().describe("Name of the service to deploy (from services.json)") },
    async ({ service }) => {
      const manifest = await loadServicesManifest();
      const config = manifest[service];

      if (!config) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `Unknown service "${service}". Available: ${Object.keys(manifest).join(", ")}`,
              }),
            },
          ],
          isError: true,
        };
      }

      if (isServiceRunning(service)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `Service "${service}" is already running on port ${config.port}`,
              }),
            },
          ],
          isError: true,
        };
      }

      const result = spawnWithEnvironment(service, config);

      if (!result.success) {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result) },
          ],
          isError: true,
        };
      }

      await new Promise((r) => setTimeout(r, 1500));

      const running = isServiceRunning(service);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: running,
              service,
              port: config.port,
              message: running
                ? `Service "${service}" deployed on port ${config.port} with secrets from 1Password`
                : `Service "${service}" started but may have exited — check logs`,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "stop_service",
    "Stops a running service by name.",
    { service: z.string().describe("Name of the service to stop") },
    async ({ service }) => {
      const result = stopService(service);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result) },
        ],
        isError: !result.success,
      };
    },
  );
}
