import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSystemInfoTool } from "./tools/system-info.js";
import { registerCpuTool } from "./tools/cpu.js";
import { registerMemoryTool } from "./tools/memory.js";
import { registerDiskTool } from "./tools/disk.js";
import { registerNetworkTool } from "./tools/network.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcpi",
    version: "0.1.0",
    description:
      "Raspberry Pi 5 MCP server — system monitoring and secrets management",
  });

  registerSystemInfoTool(server);
  registerCpuTool(server);
  registerMemoryTool(server);
  registerDiskTool(server);
  registerNetworkTool(server);

  return server;
}
