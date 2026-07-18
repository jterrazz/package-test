import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
): 'app' | 'postgres' | 'redis' | 'unknown' {
    if (!image) {
        return 'app';
    }

    const lower = image.toLowerCase();

    if (lower.startsWith('postgres')) {
        return 'postgres';
    }
    if (lower.startsWith('redis')) {
        return 'redis';
    }

    return 'unknown';
}

/**
 * Find the compose file in the project.
 * Looks for docker/compose.test.yaml or docker-compose.test.yaml.
 */
export function findComposeFile(projectRoot: string): null | string {
    const candidates = [
        resolve(projectRoot, 'docker/compose.test.yaml'),
        resolve(projectRoot, 'docker/compose.test.yml'),
        resolve(projectRoot, 'docker-compose.test.yaml'),
        resolve(projectRoot, 'docker-compose.test.yml'),
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}
