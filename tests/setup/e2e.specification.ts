import { afterAll } from "vitest";

import { e2e } from "../../src/index.js";

export const e2eSpec = await e2e({
  projectRoot: "../fixtures/app",
});

afterAll(() => e2eSpec.cleanup());
