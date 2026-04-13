import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSystemInfoTool } from "./tools/system-info.js";
import { registerCpuTool } from "./tools/cpu.js";
import { registerMemoryTool } from "./tools/memory.js";
import { registerDiskTool } from "./tools/disk.js";
import { registerNetworkTool } from "./tools/network.js";
import { registerOpStatusTool } from "./tools/op-status.js";
import { registerEnvironmentsTool } from "./tools/environments.js";
import { registerServicesTools } from "./tools/services.js";
import { registerQueryServiceTool } from "./tools/query-service.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcpi",
    version: "0.2.0",
    description:
      "Raspberry Pi 5 MCP server — system monitoring and secrets management",
  });

  // Stage 1: system monitoring
  registerSystemInfoTool(server);
  registerCpuTool(server);
  registerMemoryTool(server);
  registerDiskTool(server);
  registerNetworkTool(server);

  // Stage 2: 1Password integration
  registerOpStatusTool(server);
  registerEnvironmentsTool(server);
  registerServicesTools(server);
  registerQueryServiceTool(server);

  return server;
}
