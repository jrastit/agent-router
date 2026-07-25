#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

pm2_bin="$script_dir/node_modules/.bin/pm2"
if [[ ! -x "$pm2_bin" ]]; then
  echo "PM2 is not installed. Run npm install first." >&2
  exit 1
fi

echo "Building the latest production application..."
npm run build

if "$pm2_bin" describe agent-router >/dev/null 2>&1; then
  echo "Stopping the current agent-router process..."
  "$pm2_bin" stop agent-router
fi

echo "Starting agent-router with the latest environment..."
"$pm2_bin" start ecosystem.config.cjs --update-env
"$pm2_bin" save

echo "agent-router restarted on http://127.0.0.1:29000"
