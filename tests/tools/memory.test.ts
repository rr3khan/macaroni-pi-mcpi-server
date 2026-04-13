import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

async function callTool(name: string) {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({ name, arguments: {} });

  await client.close();
  await server.close();

  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return JSON.parse(text);
}

describe("get_memory_status", () => {
  it("returns memory values in MB", async () => {
    const mem = await callTool("get_memory_status");

    expect(mem.total_mb).toBeGreaterThan(0);
    expect(mem.used_mb).toBeGreaterThan(0);
    expect(mem.free_mb).toBeGreaterThanOrEqual(0);
  });

  it("usage percent is between 0 and 100", async () => {
    const mem = await callTool("get_memory_status");

    expect(mem.usage_percent).toBeGreaterThan(0);
    expect(mem.usage_percent).toBeLessThanOrEqual(100);
  });

  it("reports which data source was used", async () => {
    const mem = await callTool("get_memory_status");

    expect(["procfs", "node_os"]).toContain(mem.source);
  });

  it("swap values are non-negative", async () => {
    const mem = await callTool("get_memory_status");

    expect(mem.swap_total_mb).toBeGreaterThanOrEqual(0);
    expect(mem.swap_used_mb).toBeGreaterThanOrEqual(0);
    expect(mem.swap_free_mb).toBeGreaterThanOrEqual(0);
  });
});
