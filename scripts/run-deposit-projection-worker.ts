import { processDepositProjectionOutbox } from "../src/lib/projection/deposit-worker";

const required = {
  supabaseUrl: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  contractAddress: process.env.LOCAL_HEDERA_ANCHOR_CONTRACT_ADDRESS,
  graphUrl: process.env.HEDERA_PROJECTION_SUBGRAPH_QUERY_URL,
};
if (
  !required.supabaseUrl ||
  !required.serviceRoleKey ||
  !required.contractAddress ||
  !required.graphUrl
) {
  throw new Error("Deposit projection worker is not configured");
}

const config = {
  supabaseUrl: required.supabaseUrl,
  serviceRoleKey: required.serviceRoleKey,
  contractAddress: required.contractAddress,
  graphUrl: required.graphUrl,
  rpcUrl: process.env.LOCAL_EVM_RPC_URL ?? "http://127.0.0.1:8545",
  chainId: BigInt(process.env.LOCAL_EVM_CHAIN_ID ?? "1337"),
  relayerIndex: Number(process.env.LOCAL_EVM_RELAYER_INDEX ?? "1"),
};

async function run() {
  try {
    const result = await processDepositProjectionOutbox(config);
    if (result.projected > 0)
      process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "projection worker failed"}\n`,
    );
  }
}

async function main() {
  while (true) {
    await run();
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

void main();
