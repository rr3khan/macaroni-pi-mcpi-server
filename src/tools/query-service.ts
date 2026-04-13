import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  loadServicesManifest,
  isServiceRunning,
} from "../providers/onepassword.js";

export function registerQueryServiceTool(server: McpServer): void {
  server.tool(
    "query_service",
    "Sends an HTTP GET to a running service's local endpoint and returns the response. Use this to get data from services without exposing their secrets.",
    {
      service: z.string().describe("Name of the service to query"),
      path: z.string().optional().describe("URL path to query, e.g. /weather?city=Toronto (defaults to /health)"),
    },
    async ({ service, path }) => {
      const manifest = await loadServicesManifest();
      const config = manifest[service];

      if (!config) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Unknown service "${service}"`,
              }),
            },
          ],
          isError: true,
        };
      }

      if (!isServiceRunning(service)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Service "${service}" is not running. Deploy it first.`,
              }),
            },
          ],
          isError: true,
        };
      }

      const urlPath = path ?? "/health";
      const url = `http://127.0.0.1:${config.port}${urlPath}`;

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const body = await response.text();

        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: response.status,
                data: parsed,
              }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Failed to reach service: ${err instanceof Error ? err.message : String(err)}`,
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
