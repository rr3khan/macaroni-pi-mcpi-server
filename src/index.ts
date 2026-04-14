import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createLogger, LOG_FILE } from "./logger.js";

const log = createLogger("main");

process.on("uncaughtException", (err) => {
  log.error("uncaughtException — server will exit", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  log.error("unhandledRejection", {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
});

async function main(): Promise<void> {
  log.info("starting mcpi server", {
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    logFile: LOG_FILE,
  });

  const server = createServer();

  const transport = new StdioServerTransport();
  log.info("connecting stdio transport");

  await server.connect(transport);
  log.info("server connected and ready");

  const shutdown = (signal: string) => {
    log.info(`received ${signal}, shutting down`);
    void server.close().then(() => {
      log.info("server closed cleanly");
      process.exit(0);
    });
    setTimeout(() => {
      log.warn("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 5000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  log.error("fatal error during startup", {
    name: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
