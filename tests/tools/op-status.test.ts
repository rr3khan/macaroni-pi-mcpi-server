import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const server = createServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.callTool({ name, arguments: args });

  await client.close();
  await server.close();

  const text = (result.content as Array<{ type: string; text: string }>)[0]
    .text;
  return JSON.parse(text);
}

describe("get_op_status", () => {
  it("returns the expected shape", async () => {
    const status = await callTool("get_op_status");

    expect(typeof status.installed).toBe("boolean");
    expect(typeof status.authenticated).toBe("boolean");
    if (status.installed) {
      expect(typeof status.version).toBe("string");
    } else {
      expect(status.version).toBeNull();
    }
  }, 15000);

  it("does not crash when op is not installed", async () => {
    const status = await callTool("get_op_status");
    expect(status).toHaveProperty("installed");
  }, 15000);
});
