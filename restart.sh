#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

pm2_bin="$script_dir/node_modules/.bin/pm2"
if [[ ! -x "$pm2_bin" ]]; then
  echo "PM2 is not installed. Run npm install first." >&2
  exit 1
fi

if "$pm2_bin" describe agent-router >/dev/null 2>&1; then
  echo "Stopping the current agent-router process..."
  "$pm2_bin" stop agent-router
fi

echo "Building the latest production application..."
npm run build

echo "Starting agent-router with the latest environment..."
"$pm2_bin" start ecosystem.config.cjs --update-env
"$pm2_bin" save

echo "Waiting for the local health endpoint..."
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:29000/api/health >/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "agent-router did not become healthy within 30 seconds." >&2
    "$pm2_bin" logs agent-router --lines 50 --nostream >&2
    exit 1
  fi
  sleep 1
done

echo "agent-router restarted on http://127.0.0.1:29000"
