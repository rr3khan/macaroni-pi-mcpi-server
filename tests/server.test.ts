import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

function connectTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "1.0.0" });

  return {
    server,
    client,
    async start() {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
    },
    async stop() {
      await client.close();
      await server.close();
    },
  };
}

describe("mcpi server", () => {
  it("exposes all Stage 1 tools", async () => {
    const harness = connectTestClient();
    await harness.start();

    const { tools } = await harness.client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      "get_cpu_status",
      "get_disk_status",
      "get_memory_status",
      "get_network_info",
      "get_system_info",
    ]);

    await harness.stop();
  });

  it("each tool has a description", async () => {
    const harness = connectTestClient();
    await harness.start();

    const { tools } = await harness.client.listTools();
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.description?.length ?? 0).toBeGreaterThan(10);
    }

    await harness.stop();
  });
});
