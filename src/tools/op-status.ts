import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOpStatus } from "../providers/onepassword.js";

export function registerOpStatusTool(server: McpServer): void {
  server.tool(
    "get_op_status",
    "Checks whether the 1Password CLI (op) is installed, its version, and whether a service account is authenticated.",
    {},
    async () => {
      const status = await getOpStatus();

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
