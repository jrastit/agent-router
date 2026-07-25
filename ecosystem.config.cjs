"use strict";

module.exports = {
  apps: [
    {
      name: "agent-router",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: ["start", "--hostname", "127.0.0.1", "--port", "29000"],
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      kill_timeout: 10_000,
      listen_timeout: 10_000,
      time: true,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "29000",
      },
    },
  ],
};
