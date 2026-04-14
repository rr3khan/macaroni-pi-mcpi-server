import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "./logger.js";
import { registerSystemInfoTool } from "./tools/system-info.js";
import { registerCpuTool } from "./tools/cpu.js";
import { registerMemoryTool } from "./tools/memory.js";
import { registerDiskTool } from "./tools/disk.js";
import { registerNetworkTool } from "./tools/network.js";
import { registerOpStatusTool } from "./tools/op-status.js";
import { registerEnvironmentsTool } from "./tools/environments.js";
import { registerServicesTools } from "./tools/services.js";
import { registerQueryServiceTool } from "./tools/query-service.js";
import { registerHealthCheckTool } from "./tools/health-check.js";

const log = createLogger("server");

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcpi",
    version: "0.2.0",
    description:
      "Raspberry Pi 5 MCP server — system monitoring and secrets management",
  });

  const tools = [
    { name: "system-info", register: registerSystemInfoTool },
    { name: "cpu", register: registerCpuTool },
    { name: "memory", register: registerMemoryTool },
    { name: "disk", register: registerDiskTool },
    { name: "network", register: registerNetworkTool },
    { name: "op-status", register: registerOpStatusTool },
    { name: "environments", register: registerEnvironmentsTool },
    { name: "services", register: registerServicesTools },
    { name: "query-service", register: registerQueryServiceTool },
    { name: "health-check", register: registerHealthCheckTool },
  ];

  for (const tool of tools) {
    try {
      tool.register(server);
      log.debug(`registered tool: ${tool.name}`);
    } catch (err) {
      log.error(`failed to register tool: ${tool.name}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info(`registered ${tools.length} tools`);
  return server;
}
