import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSystemInfoTool } from "./tools/system-info.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcpi",
    version: "0.1.0",
    description:
      "Raspberry Pi 5 MCP server — system monitoring and secrets management",
  });

  registerSystemInfoTool(server);

  return server;
}
