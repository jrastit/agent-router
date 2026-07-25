import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const config = readFileSync(
  "deploy/graph-node/apache-app-events.conf.example",
  "utf8",
);

describe("public Graph Node Apache template", () => {
  it("terminates TLS for the intended hostname", () => {
    expect(config).toContain("ServerName graph.router.fexhu.com");
    expect(config).toContain(
      "/etc/letsencrypt/live/graph.router.fexhu.com/fullchain.pem",
    );
    expect(config).toContain(
      "RewriteRule ^ https://graph.router.fexhu.com%{REQUEST_URI}",
    );
  });

  it("exposes only the project POST queries over a loopback upstream", () => {
    expect(config).toContain(
      'ProxyPass "/subgraphs/name/agent-router/app-events"',
    );
    expect(config).toContain(
      '"http://127.0.0.1:8000/subgraphs/name/agent-router/app-events"',
    );
    expect(config).toContain(
      'ProxyPassReverse "/subgraphs/name/agent-router/app-events"',
    );
    expect(config).toContain(
      'ProxyPass "/subgraphs/name/agent-router/hedera-projection"',
    );
    expect(config).toContain(
      '"http://127.0.0.1:8000/subgraphs/name/agent-router/hedera-projection"',
    );
    expect(config).toContain(
      'ProxyPassReverse "/subgraphs/name/agent-router/hedera-projection"',
    );
    expect(config).not.toContain("ProxyPassMatch");
    expect(config).toContain("<Limit POST>");
    expect(config).toContain("<LimitExcept POST>");
    expect(config).toContain("Require all denied");
    expect(config).not.toMatch(/127\.0\.0\.1:(5001|8001|8020|8030|8040)/);
  });

  it("sets bounded request and transport controls", () => {
    expect(config).toContain("LimitRequestBody 65536");
    expect(config).toContain("ProxyTimeout 30");
    expect(config).toContain("Strict-Transport-Security");
  });
});
