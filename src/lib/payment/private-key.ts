import { PrivateKey } from "@hashgraph/sdk";

export function parseHederaPrivateKey(value: string): PrivateKey {
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return PrivateKey.fromStringECDSA(value.slice(2));
  }
  if (/^(302e|3030)[0-9a-fA-F]+$/.test(value)) {
    return PrivateKey.fromStringDer(value);
  }
  return PrivateKey.fromString(value);
}
