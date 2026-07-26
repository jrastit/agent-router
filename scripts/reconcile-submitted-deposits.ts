import { reconcileSubmittedDeposits } from "../src/lib/deposit/reconciliation";

async function main() {
  if (!process.argv.includes("--confirm-production-reconciliation")) {
    throw new Error(
      "Pass --confirm-production-reconciliation to process submitted deposits",
    );
  }

  const config = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    mirrorNodeUrl:
      process.env.HEDERA_MIRROR_NODE_URL ??
      "https://testnet.mirrornode.hedera.com",
    pseudonymSalt: process.env.DEPOSIT_PSEUDONYM_SALT,
  };
  if (!config.supabaseUrl || !config.serviceRoleKey || !config.pseudonymSalt) {
    throw new Error("Server-side deposit reconciliation is not configured");
  }

  const result = await reconcileSubmittedDeposits({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
    mirrorNodeUrl: config.mirrorNodeUrl,
    pseudonymSalt: config.pseudonymSalt,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main();
