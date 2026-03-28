import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * A parsed service from docker-compose.test.yaml.
 */
export interface ComposeService {
  name: string;
  image?: string;
  build?: string;
  ports: { container: number; host?: number }[];
  environment: Record<string, string>;
  volumes: string[];
  dependsOn: string[];
}

/**
 * Result of parsing a compose file.
 */
export interface ComposeConfig {
  services: ComposeService[];
  appService: ComposeService | null;
  infraServices: ComposeService[];
}

/**
 * Detect the service type from the image name.
 */
export function detectServiceType(
  image: string | undefined,
): "app" | "postgres" | "redis" | "unknown" {
  if (!image) {
    return "app";
  }

  const lower = image.toLowerCase();

  if (lower.startsWith("postgres")) {
    return "postgres";
  }
  if (lower.startsWith("redis")) {
    return "redis";
  }

  return "unknown";
}

/**
 * Find the compose file in the project.
 * Looks for docker/compose.test.yaml or docker-compose.test.yaml.
 */
export function findComposeFile(projectRoot: string): null | string {
  const candidates = [
    resolve(projectRoot, "docker/compose.test.yaml"),
    resolve(projectRoot, "docker/compose.test.yml"),
    resolve(projectRoot, "docker-compose.test.yaml"),
    resolve(projectRoot, "docker-compose.test.yml"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Parse a docker-compose file and extract service definitions.
 */
export function parseComposeFile(filePath: string): ComposeConfig {
  const content = readFileSync(filePath, "utf8");
  const doc = parseYaml(content);

  if (!doc?.services) {
    return { services: [], appService: null, infraServices: [] };
  }

  const services: ComposeService[] = Object.entries(doc.services).map(
    ([name, def]: [string, any]) => {
      const ports: { container: number; host?: number }[] = [];
      if (def.ports) {
        for (const port of def.ports) {
          const str = String(port);
          if (str.includes(":")) {
            const [host, container] = str.split(":");
            ports.push({ container: Number(container), host: Number(host) });
          } else {
            ports.push({ container: Number(str) });
          }
        }
      }

      const environment: Record<string, string> = {};
      if (def.environment) {
        if (Array.isArray(def.environment)) {
          for (const env of def.environment) {
            const [key, ...rest] = String(env).split("=");
            environment[key] = rest.join("=");
          }
        } else {
          Object.assign(environment, def.environment);
        }
      }

      const volumes: string[] = def.volumes ? def.volumes.map((v: string) => String(v)) : [];

      let dependsOn: string[] = [];
      if (def.depends_on) {
        dependsOn = Array.isArray(def.depends_on) ? def.depends_on : Object.keys(def.depends_on);
      }

      return {
        name,
        image: def.image,
        build: def.build,
        ports,
        environment,
        volumes,
        dependsOn,
      };
    },
  );

  const appService = services.find((s) => s.build !== undefined) ?? null;
  const infraServices = services.filter((s) => s.build === undefined);

  return { services, appService, infraServices };
}
