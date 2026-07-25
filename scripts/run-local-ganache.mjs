import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ganacheBin = fileURLToPath(
  new URL("../node_modules/.bin/ganache", import.meta.url),
);
const child = spawn(
  ganacheBin,
  [
    "--server.host",
    "127.0.0.1",
    "--server.port",
    "8545",
    "--chain.chainId",
    "1337",
    "--chain.networkId",
    "1337",
    "--wallet.totalAccounts",
    "3",
    "--logging.quiet",
  ],
  {
    stdio: ["inherit", "ignore", "pipe"],
  },
);

process.stdout.write(
  "Starting disposable Ganache on http://127.0.0.1:8545 (chain ID 1337); wallet material is intentionally hidden.\n",
);

child.stderr.pipe(process.stderr);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  process.stderr.write(`Failed to start local Ganache: ${error.message}\n`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exitCode = 0;
    return;
  }
  process.exitCode = code ?? 1;
});
