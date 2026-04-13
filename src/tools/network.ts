import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getNetworkInterfaces,
  getWifiInfo,
  type NetworkInterface,
} from "../providers/pi-system.js";

interface NetworkStatus {
  interfaces: NetworkInterface[];
  wifi: { ssid: string; signal_dbm: number } | null;
  primary_ipv4: string | null;
}

async function getNetworkStatus(): Promise<NetworkStatus> {
  const interfaces = getNetworkInterfaces();
  const wifi = await getWifiInfo();

  const external = interfaces.find(
    (i) => !i.internal && i.ipv4.length > 0,
  );

  return {
    interfaces,
    wifi,
    primary_ipv4: external?.ipv4[0] ?? null,
  };
}

export function registerNetworkTool(server: McpServer): void {
  server.tool(
    "get_network_info",
    "Returns network interfaces with IPs and MACs, WiFi SSID/signal (Pi only), and the primary IPv4 address.",
    {},
    async () => {
      const status = await getNetworkStatus();

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
