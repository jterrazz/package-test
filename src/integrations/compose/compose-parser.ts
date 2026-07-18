import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

import type {
    ComposeConfig,
    ComposeService,
} from '../../core/specification/shared/compose-file.js';

/**
 * Parse a docker-compose file and extract service definitions.
 */
export function parseComposeFile(filePath: string): ComposeConfig {
    const content = readFileSync(filePath, 'utf8');
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
                    if (str.includes(':')) {
                        const [host, container] = str.split(':');
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
                        const [key, ...rest] = String(env).split('=');
                        environment[key] = rest.join('=');
                    }
                } else {
                    Object.assign(environment, def.environment);
                }
            }

            const volumes: string[] = def.volumes ? def.volumes.map((v: string) => String(v)) : [];

            let dependsOn: string[] = [];
            if (def.depends_on) {
                dependsOn = Array.isArray(def.depends_on)
                    ? def.depends_on
                    : Object.keys(def.depends_on);
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
