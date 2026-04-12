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

describe("get_disk_status", () => {
  it("returns at least one filesystem", async () => {
    const disk = await callTool("get_disk_status");

    expect(Array.isArray(disk.filesystems)).toBe(true);
    expect(disk.filesystems.length).toBeGreaterThan(0);
  });

  it("each filesystem has required fields", async () => {
    const disk = await callTool("get_disk_status");

    for (const fs of disk.filesystems) {
      expect(typeof fs.filesystem).toBe("string");
      expect(typeof fs.mount).toBe("string");
      expect(fs.size_gb).toBeGreaterThan(0);
      expect(typeof fs.use_percent).toBe("number");
    }
  });

  it("totals are consistent with individual filesystems", async () => {
    const disk = await callTool("get_disk_status");

    const sumSize = disk.filesystems.reduce(
      (s: number, f: { size_gb: number }) => s + f.size_gb,
      0,
    );
    expect(disk.total_size_gb).toBeCloseTo(sumSize, 1);
  });
});
