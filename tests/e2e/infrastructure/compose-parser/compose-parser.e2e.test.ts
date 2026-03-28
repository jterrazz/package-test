import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import {
  detectServiceType,
  findComposeFile,
  parseComposeFile,
} from "../../../../src/infrastructure/compose-parser.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/app");

describe("compose parser", () => {
  describe("findComposeFile", () => {
    test("finds docker/compose.test.yaml", () => {
      const result = findComposeFile(FIXTURES_DIR);

      expect(result).not.toBeNull();
      expect(result).toContain("compose.test.yaml");
    });

    test("returns null when no compose file exists", () => {
      const result = findComposeFile("/tmp/nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("parseComposeFile", () => {
    test("parses services from compose file", () => {
      const composePath = findComposeFile(FIXTURES_DIR)!;
      const config = parseComposeFile(composePath);

      expect(config.services.length).toBeGreaterThan(0);
    });

    test("detects app service (has build)", () => {
      const composePath = findComposeFile(FIXTURES_DIR)!;
      const config = parseComposeFile(composePath);

      expect(config.appService).not.toBeNull();
      expect(config.appService!.build).toBeDefined();
    });

    test("detects infra services (no build)", () => {
      const composePath = findComposeFile(FIXTURES_DIR)!;
      const config = parseComposeFile(composePath);

      expect(config.infraServices.length).toBeGreaterThan(0);
      expect(config.infraServices.every((s) => s.build === undefined)).toBe(true);
    });

    test("extracts environment variables", () => {
      const composePath = findComposeFile(FIXTURES_DIR)!;
      const config = parseComposeFile(composePath);
      const db = config.services.find((s) => s.name === "db");

      expect(db).toBeDefined();
      expect(db!.environment.POSTGRES_USER).toBe("test");
      expect(db!.environment.POSTGRES_DB).toBe("test");
    });

    test("extracts ports", () => {
      const composePath = findComposeFile(FIXTURES_DIR)!;
      const config = parseComposeFile(composePath);
      const app = config.appService;

      expect(app).not.toBeNull();
      expect(app!.ports.length).toBeGreaterThan(0);
      expect(app!.ports[0].container).toBe(3000);
    });

    test("extracts depends_on", () => {
      const composePath = findComposeFile(FIXTURES_DIR)!;
      const config = parseComposeFile(composePath);
      const app = config.appService;

      expect(app!.dependsOn).toContain("db");
    });
  });

  describe("detectServiceType", () => {
    test("detects postgres", () => {
      expect(detectServiceType("postgres:17")).toBe("postgres");
      expect(detectServiceType("postgres")).toBe("postgres");
    });

    test("detects redis", () => {
      expect(detectServiceType("redis:7")).toBe("redis");
      expect(detectServiceType("redis:7-alpine")).toBe("redis");
    });

    test("detects app (no image = build)", () => {
      expect(detectServiceType(undefined)).toBe("app");
    });

    test("returns unknown for unrecognized images", () => {
      expect(detectServiceType("elasticsearch:8")).toBe("unknown");
      expect(detectServiceType("nginx:latest")).toBe("unknown");
    });
  });
});
