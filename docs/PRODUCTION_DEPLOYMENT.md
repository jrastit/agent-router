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

To restore the saved PM2 process list automatically after a host reboot,
install the system startup unit once using the command printed by:

```sh
pm2 startup
```

That command changes host service configuration and normally requires
administrator approval. Run `pm2 save` again after any intended process-list
change.
