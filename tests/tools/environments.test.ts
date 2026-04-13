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

describe("list_environments", () => {
  it("returns an environments array", async () => {
    const result = await callTool("list_environments");
    expect(result).toHaveProperty("environments");
    expect(Array.isArray(result.environments)).toBe(true);
  });

  it("each environment has name, environment_id, and variable_keys", async () => {
    const result = await callTool("list_environments");

    for (const env of result.environments) {
      expect(typeof env.name).toBe("string");
      expect(typeof env.environment_id).toBe("string");
      expect(Array.isArray(env.variable_keys)).toBe(true);
    }
  });

  it("never returns secret values in variable_keys", async () => {
    const result = await callTool("list_environments");

    for (const env of result.environments) {
      for (const key of env.variable_keys) {
        expect(typeof key).toBe("string");
        expect(key).toMatch(/^[A-Z_][A-Z0-9_]*$/);
      }
    }
  });
});
