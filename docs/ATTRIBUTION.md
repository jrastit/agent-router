# Attribution and project baseline

This document separates pre-existing reference work, third-party software, and
the implementation created in this repository.

## Repository baseline

AgentRouter began as a new repository on 24 July 2026. Its first commit,
`814d831`, contained only `AGENTS.md`: the incremental development, safety, and
review rules for the project.

Before application implementation started, the repository added product,
architecture, validation-handoff, and prize-strategy documents. There was no
application scaffold, domain implementation, database schema, provider
integration, payment logic, or deployable product.

The first application code arrived in commit `fb775e7` on 25 July 2026.
Subsequent work is preserved chronologically in this repository rather than
imported or backdated.

## Starter and original work

No third-party application starter, template repository, generated design, or
pre-existing product code was used. The Next.js scaffold, health page, copy,
styling, tests, and configuration were created specifically for AgentRouter.

The separate technical validation lab described in
[`VALIDATION_BASELINE.md`](VALIDATION_BASELINE.md) is reference material. It
established feasibility before this application was built. AgentRouter does not
contain the lab's source code, credentials, Git history, or deployment
artifacts. Any technique later ported from that lab must be reviewed, tested in
this architecture, and identified in the commit that introduces it.

## Third-party software

AgentRouter currently uses these open-source packages through npm:

- Next.js, React, and React DOM for the application runtime;
- Tailwind CSS and its PostCSS integration for styling;
- Zod for typed runtime validation;
- `server-only` to enforce server module boundaries;
- TypeScript and the React/Node type packages for static typing;
- ESLint and `eslint-config-next` for static analysis;
- Prettier for formatting; and
- Vitest for automated tests.

Exact versions and transitive dependencies are recorded in
[`package-lock.json`](../package-lock.json). Their upstream license files and
package metadata remain authoritative. No dependency code is claimed as
original AgentRouter work.

## Disclosure rule

Update this file whenever the project adopts a starter, copies or adapts
third-party code or assets, or ports a concrete implementation from the
validation lab. Link the source, name the affected files, describe the
modification, and retain any required license notice.
