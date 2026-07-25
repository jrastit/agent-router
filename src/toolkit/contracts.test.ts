import { describe, expect, it } from "vitest";

import type {
  ComputeExecutionAdapter,
  ModelCatalogAdapter,
  ModelRouter,
  ProvenanceVerifier,
  StorageEvidenceAdapter,
} from "./index";

describe("public toolkit contracts", () => {
  it("can be implemented without importing application infrastructure", () => {
    const catalog = {} as ModelCatalogAdapter;
    const router = {} as ModelRouter;
    const compute = {} as ComputeExecutionAdapter;
    const storage = {} as StorageEvidenceAdapter;
    const provenance = {} as ProvenanceVerifier;

    expect({ catalog, router, compute, storage, provenance }).toBeDefined();
  });
});
