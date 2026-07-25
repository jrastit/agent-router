import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const config = require("./ecosystem.config.cjs") as {
  apps: Array<Record<string, unknown>>;
};

describe("PM2 production configuration", () => {
  it("runs one production Next server on the Apache loopback origin", () => {
    expect(config.apps).toHaveLength(1);
    expect(config.apps[0]).toMatchObject({
      name: "agent-router",
      script: "node_modules/next/dist/bin/next",
      args: ["start", "--hostname", "127.0.0.1", "--port", "29000"],
      interpreter: "node",
      node_args: ["--env-file=.env"],
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "29000",
      },
    });
  });

  it("bounds shutdown, startup, and memory recovery", () => {
    expect(config.apps[0]).toMatchObject({
      max_memory_restart: "512M",
      kill_timeout: 10_000,
      listen_timeout: 10_000,
    });
  });
});
