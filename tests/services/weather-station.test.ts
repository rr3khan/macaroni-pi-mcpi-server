import { describe, it, expect, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const SERVICE_PATH = resolve(PROJECT_ROOT, "services/weather-station.js");

function startService(
  env: Record<string, string>,
): Promise<{ child: ChildProcess; port: number }> {
  return new Promise((resolve, reject) => {
    const port = 3199;
    const child = spawn("node", [SERVICE_PATH], {
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Service did not start within 3s"));
    }, 3000);

    child.stderr?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve({ child, port });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        reject(new Error(`Service exited with code ${code}`));
      }
    });
  });
}

describe("weather-station service", () => {
  let child: ChildProcess | undefined;
  let port: number;

  afterAll(() => {
    child?.kill();
  });

  it("exits with error when WEATHER_API_KEY is not set", async () => {
    const exitCode = await new Promise<number | null>((resolve) => {
      const proc = spawn("node", [SERVICE_PATH], {
        env: { ...process.env, WEATHER_API_KEY: undefined },
        stdio: "ignore",
      });
      proc.on("exit", resolve);
    });
    expect(exitCode).toBe(1);
  });

  it("starts and responds to /health when API key is set", async () => {
    const result = await startService({
      WEATHER_API_KEY: "test-key-not-real",
    });
    child = result.child;
    port = result.port;

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("weather-station");
  });

  it("returns 404 for unknown paths", async () => {
    if (!child) return;
    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });
});
