# Public repository and clean-clone evidence

Verified on 2026-07-25.

## Public access and attribution

- repository: `https://github.com/jrastit/agent-router`;
- visibility: public;
- archived: no;
- default branch: `main`; and
- attribution: [`ATTRIBUTION.md`](ATTRIBUTION.md) records the fresh repository
  baseline, validation-lab boundary, starter status, third-party packages, and
  ongoing disclosure rule.

The public `main` commit tested was
`b78e83f51950322145cb7e4cc1219c3160964a5e`. Newer local documentation commits
were intentionally not pushed because repository policy requires an explicit
push request.

## Clean-clone verification

An anonymous HTTPS clone was created outside the working repository. From that
clone, with no `.env` file:

```sh
npm ci
npm run validate
```

Results:

- locked dependency installation completed;
- formatting, linting, and type checking passed;
- 184 tests passed and one was skipped;
- both Subgraph builds passed;
- the Next.js production build passed; and
- the client bundle contained no server-only key names or configured secrets.

This verifies the documented credential-free build and deterministic test path
at the recorded public commit. The final submission still requires pushing the
latest reviewed commits and repeating this check at the resulting public HEAD.

## Dependency audit observation

`npm audit --omit=dev` reported 42 production dependency findings: 8 low, 8
moderate, 21 high, and 5 critical. Direct dependency paths include the 0G
Storage SDK, Hashgraph SDK, ethers, and PM2; some have no non-breaking automated
fix. No forced or major-version audit fix was applied. Review the reachable
runtime paths and upstream fixes before final submission rather than weakening
tests or applying an unreviewed lockfile rewrite.
