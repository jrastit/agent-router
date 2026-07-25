import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { JsonRpcProvider, keccak256 } from "ethers";
import solc from "solc";

const rpcUrl = process.env.ZG_CHAIN_RPC_URL;
const contractAddress = process.env.ZG_CHAIN_CONTRACT_ADDRESS;
if (!rpcUrl || !contractAddress) {
  throw new Error(
    "ZG_CHAIN_RPC_URL and ZG_CHAIN_CONTRACT_ADDRESS are required",
  );
}

const source = await readFile(
  new URL("../contracts/ZgRoutingProvenance.sol", import.meta.url),
  "utf8",
);
const file = "ZgRoutingProvenance.sol";
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { [file]: { content: source } },
      settings: {
        evmVersion: "cancun",
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
          "*": { "*": ["evm.deployedBytecode.object"] },
        },
      },
    }),
  ),
);
const compiled =
  `0x${output.contracts[file].ZgRoutingProvenance.evm.deployedBytecode.object}`.toLowerCase();
const provider = new JsonRpcProvider(rpcUrl);
const onchain = (await provider.getCode(contractAddress)).toLowerCase();
if (compiled !== onchain) {
  throw new Error("Committed source does not match deployed runtime bytecode");
}

console.log(
  JSON.stringify(
    {
      contractAddress,
      compiler: solc.version(),
      evmVersion: "cancun",
      optimizerRuns: 200,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      runtimeBytecodeKeccak256: keccak256(onchain),
      matched: true,
    },
    null,
    2,
  ),
);
