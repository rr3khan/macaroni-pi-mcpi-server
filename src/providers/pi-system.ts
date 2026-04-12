/**
 * Abstraction layer for reading Pi-specific system data.
 *
 * On a Raspberry Pi these read from /sys, /proc, and system commands.
 * On other platforms they return null so callers can degrade gracefully.
 */

import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function readSysFile(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf-8");
    return content.trim();
  } catch {
    return null;
  }
}

export async function execCommand(
  cmd: string,
  args: string[],
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getCpuTemperature(): Promise<number | null> {
  const raw = await readSysFile("/sys/class/thermal/thermal_zone0/temp");
  if (raw === null) return null;
  const millidegrees = parseInt(raw, 10);
  if (isNaN(millidegrees)) return null;
  return millidegrees / 1000;
}

export async function getCpuFrequency(): Promise<number | null> {
  const raw = await readSysFile(
    "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq",
  );
  if (raw === null) return null;
  const khz = parseInt(raw, 10);
  if (isNaN(khz)) return null;
  return khz / 1000;
}

export interface MemInfoFields {
  mem_total_kb: number;
  mem_free_kb: number;
  mem_available_kb: number;
  swap_total_kb: number;
  swap_free_kb: number;
}

export async function parseMeminfo(): Promise<MemInfoFields | null> {
  const raw = await readSysFile("/proc/meminfo");
  if (raw === null) return null;

  const extract = (key: string): number => {
    const match = raw.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    mem_total_kb: extract("MemTotal"),
    mem_free_kb: extract("MemFree"),
    mem_available_kb: extract("MemAvailable"),
    swap_total_kb: extract("SwapTotal"),
    swap_free_kb: extract("SwapFree"),
  };
}

export interface DiskUsageEntry {
  filesystem: string;
  mount: string;
  size_bytes: number;
  used_bytes: number;
  available_bytes: number;
  use_percent: number;
}

export async function getDiskUsage(): Promise<DiskUsageEntry[]> {
  const raw = await execCommand("df", [
    "--block-size=1",
    "--output=source,target,size,used,avail,pcent",
  ]);

  if (raw === null) {
    return getDiskUsageMacOS();
  }

  const lines = raw.split("\n").slice(1);
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      return {
        filesystem: parts[0],
        mount: parts[1],
        size_bytes: parseInt(parts[2], 10),
        used_bytes: parseInt(parts[3], 10),
        available_bytes: parseInt(parts[4], 10),
        use_percent: parseInt(parts[5].replace("%", ""), 10),
      };
    })
    .filter((e): e is DiskUsageEntry => e !== null);
}

async function getDiskUsageMacOS(): Promise<DiskUsageEntry[]> {
  const raw = await execCommand("df", ["-k"]);
  if (raw === null) return [];

  const lines = raw.split("\n").slice(1);
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) return null;
      const sizeKb = parseInt(parts[1], 10);
      const usedKb = parseInt(parts[2], 10);
      const availKb = parseInt(parts[3], 10);
      return {
        filesystem: parts[0],
        mount: parts[8],
        size_bytes: sizeKb * 1024,
        used_bytes: usedKb * 1024,
        available_bytes: availKb * 1024,
        use_percent: parseInt(parts[4].replace("%", ""), 10),
      };
    })
    .filter((e): e is DiskUsageEntry => e !== null);
}

export interface NetworkInterface {
  name: string;
  mac: string | null;
  ipv4: string[];
  ipv6: string[];
  internal: boolean;
}

export function getNetworkInterfaces(): NetworkInterface[] {
  const raw = os_networkInterfaces();
  const result: NetworkInterface[] = [];

  for (const [name, addrs] of Object.entries(raw)) {
    if (!addrs) continue;

    const iface: NetworkInterface = {
      name,
      mac: addrs[0]?.mac !== "00:00:00:00:00:00" ? addrs[0]?.mac : null,
      ipv4: [],
      ipv6: [],
      internal: addrs[0]?.internal ?? false,
    };

    for (const addr of addrs) {
      if (addr.family === "IPv4") iface.ipv4.push(addr.address);
      else if (addr.family === "IPv6") iface.ipv6.push(addr.address);
    }

    result.push(iface);
  }

  return result;
}

import os from "node:os";
const os_networkInterfaces = os.networkInterfaces.bind(os);

export async function getWifiInfo(): Promise<{
  ssid: string;
  signal_dbm: number;
} | null> {
  const raw = await execCommand("iwconfig", ["wlan0"]);
  if (raw === null) return null;

  const ssidMatch = raw.match(/ESSID:"([^"]+)"/);
  const signalMatch = raw.match(/Signal level=(-?\d+)/);

  if (!ssidMatch) return null;

  return {
    ssid: ssidMatch[1],
    signal_dbm: signalMatch ? parseInt(signalMatch[1], 10) : 0,
  };
}
