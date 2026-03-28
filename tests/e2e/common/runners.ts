import { afterAll, beforeAll } from "vitest";

import type { SpecificationRunner } from "../../../src/specification/specification.js";
import { e2eSpec, startServer, stopServer } from "../e2e-runner/e2e.specification.js";
import { integrationSpec } from "../integration-runner/integration.specification.js";

beforeAll(() => {
  startServer();
});

afterAll(() => {
  stopServer();
});

export const runners: { name: string; spec: SpecificationRunner }[] = [
  { name: "integration", spec: integrationSpec },
  { name: "e2e", spec: e2eSpec },
];
