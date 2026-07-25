# Production application deployment

The application runs as one PM2-managed Next.js process behind the Apache
virtual host for `www.router.fexhu.com`. Apache terminates TLS and proxies to
the loopback-only origin at `http://127.0.0.1:29000`.

## Deploy or update

From the repository root:

```sh
npm ci
npm run validate
npm run build
npm run pm2:start
npm run pm2:save
```

Apply database migrations only after the transactional SQL suite and guarded
dry run both pass:

```sh
npm run validate:supabase
npm run deploy:supabase
npm run deploy:supabase -- --confirm-production-migrations
```

The first deployment command is non-mutating and prints the pending migration
list. The confirmation form uses Supabase's tracked `db push`, then probes the
latest migration, deposit and projection tables, and atomic credit function.

### Recorded schema deployment

On 2026-07-25, the transactional SQL suite and deployment dry run passed before
eight migrations were applied to the self-hosted AgentRouter Supabase
database. The post-deployment probe returned:

```json
{
  "latestMigration": "20260725001000",
  "depositTable": true,
  "projectionTable": true,
  "creditFunction": true
}
```

The restored `20260724000000_create_validation_health.sql` baseline matches the
already-applied production migration and keeps local and remote migration
histories aligned.

For an existing process after a new build:

```sh
npm run pm2:reload
npm run pm2:save
```

Next loads the ignored `.env` file from the application working directory.
Keep it mode `0600` and never place credentials in `ecosystem.config.cjs`.

## Verification

Verify the private origin first:

```sh
curl --fail --silent --show-error \
  http://127.0.0.1:29000/api/health
```

Then verify the public TLS proxy:

```sh
curl --fail --silent --show-error \
  https://www.router.fexhu.com/api/health
```

Both responses must identify `agent-router` with status `ok`. Also inspect:

```sh
pm2 status agent-router
pm2 logs agent-router --lines 100 --nostream
```

## Recorded production smoke test

On 2026-07-25, the PM2 process `agent-router` was online with zero restarts and
served the production build on `127.0.0.1:29000`. Both the loopback origin and
the Apache TLS endpoint returned:

```json
{ "status": "ok", "service": "agent-router", "version": "0.1.0" }
```

The public application root at `https://www.router.fexhu.com/` returned HTTP
200 with a certificate valid for `www.router.fexhu.com`. This verifies the
PM2-to-Apache deployment path; it does not by itself prove a complete commerce
run.

To restore the saved PM2 process list automatically after a host reboot,
install the system startup unit once using the command printed by:

```sh
pm2 startup
```

That command changes host service configuration and normally requires
administrator approval. Run `pm2 save` again after any intended process-list
change.
