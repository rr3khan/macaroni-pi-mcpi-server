import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  loadServicesManifest,
  getEnvironmentVariableKeys,
  type EnvironmentInfo,
} from "../providers/onepassword.js";

export function registerEnvironmentsTool(server: McpServer): void {
  server.tool(
    "list_environments",
    "Lists configured 1Password Environments and their variable key names. Never returns secret values — only metadata.",
    {},
    async () => {
      const manifest = await loadServicesManifest();
      const seen = new Set<string>();
      const environments: EnvironmentInfo[] = [];

      for (const [name, config] of Object.entries(manifest)) {
        if (seen.has(config.environment_id)) continue;
        seen.add(config.environment_id);

        const keys = await getEnvironmentVariableKeys(config.environment_id);

        environments.push({
          name,
          environment_id: config.environment_id,
          variable_keys: keys,
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ environments }, null, 2),
          },
        ],
      };
    },
  );
}
