/**
 * Abstraction layer for 1Password CLI (op) commands.
 *
 * All functions degrade gracefully when `op` is not installed or
 * the service account is not configured — callers get null/empty
 * results rather than thrown errors.
 *
 * SECURITY: No function in this module ever returns secret values.
 * Secrets flow from 1Password into child processes via `op run`.
 */

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

export interface OpStatus {
  installed: boolean;
  version: string | null;
  authenticated: boolean;
}

export async function getOpStatus(): Promise<OpStatus> {
  try {
    const { stdout } = await execFileAsync("op", ["--version"], {
      timeout: 5000,
    });
    const version = stdout.trim();

    try {
      await execFileAsync("op", ["account", "get", "--format=json"], {
        timeout: 10000,
      });
      return { installed: true, version, authenticated: true };
    } catch {
      return { installed: true, version, authenticated: false };
    }
  } catch {
    return { installed: false, version: null, authenticated: false };
  }
}

export interface ServiceConfig {
  command: string;
  args: string[];
  environment_id: string;
  port: number;
  description: string;
}

export type ServicesManifest = Record<string, ServiceConfig>;

export async function loadServicesManifest(): Promise<ServicesManifest> {
  try {
    const raw = await readFile(
      resolve(PROJECT_ROOT, "services.json"),
      "utf-8",
    );
    return JSON.parse(raw) as ServicesManifest;
  } catch {
    return {};
  }
}

export interface EnvironmentInfo {
  name: string;
  environment_id: string;
  variable_keys: string[];
}

export async function getEnvironmentVariableKeys(
  envId: string,
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "op",
      ["environment", "get", envId, "--format=json"],
      { timeout: 10000 },
    );
    const parsed: unknown = JSON.parse(stdout);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v: Record<string, unknown>) => {
        const key = v.variable ?? v.name ?? v.key;
        return typeof key === "string" ? key : null;
      })
      .filter((k): k is string => k !== null);
  } catch {
    return [];
  }
}

const runningProcesses = new Map<string, ChildProcess>();

export async function spawnWithEnvironmentAndWait(
  serviceName: string,
  config: ServiceConfig,
  waitMs = 2000,
): Promise<{ success: boolean; running: boolean; stderr: string }> {
  if (runningProcesses.has(serviceName)) {
    return { success: false, running: true, stderr: "" };
  }

  const child = spawn(
    "op",
    [
      "run",
      "--environment",
      config.environment_id,
      "--no-masking",
      "--",
      config.command,
      ...config.args,
    ],
    {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    },
  );

  const stderrChunks: Buffer[] = [];
  child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  child.on("exit", () => {
    runningProcesses.delete(serviceName);
  });

  child.on("error", () => {
    runningProcesses.delete(serviceName);
  });

  runningProcesses.set(serviceName, child);

  await new Promise((r) => setTimeout(r, waitMs));

  const running = child.exitCode === null && !child.killed;
  const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
  return { success: true, running, stderr };
}

export function stopService(
  serviceName: string,
): { success: boolean; error?: string } {
  const child = runningProcesses.get(serviceName);
  if (!child) {
    return { success: false, error: `Service "${serviceName}" is not running` };
  }

  child.kill("SIGTERM");
  runningProcesses.delete(serviceName);
  return { success: true };
}

export function isServiceRunning(serviceName: string): boolean {
  const child = runningProcesses.get(serviceName);
  if (!child) return false;
  return child.exitCode === null && !child.killed;
}

export function getRunningServiceNames(): string[] {
  return [...runningProcesses.keys()].filter(isServiceRunning);
}
