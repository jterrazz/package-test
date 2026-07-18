import type { ContainerPort } from '../../ports/container.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import type { ComposeConfig, ComposeService } from './compose-file.js';

/**
 * Integration registry — the seam that keeps `core/` free of external
 * dependencies (CONVENTIONS I1). Core code (the orchestrator) consumes
 * container runtimes, the compose parser, and service auto-detection through
 * this registry; the concrete implementations live under `integrations/`
 * and are wired in by the package entry point (`src/index.ts`), which is the
 * composition root every consumer goes through (CONVENTIONS F1).
 */

/** A running compose stack — implemented by the compose integration. */
export interface ComposeStackPort {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getMappedPort: (serviceName: string, containerPort: number) => number;
}

/** Container-runtime factories provided by the compose and testcontainers integrations. */
export interface ContainerIntegrations {
    /** Start a single container programmatically (testcontainers). */
    createContainer: (options: {
        image: string;
        port: number;
        env?: Record<string, string>;
    }) => ContainerPort;
    /** Drive a full `docker compose` stack (compose mode). */
    createComposeStack: (composeFile: string, projectName?: string) => ComposeStackPort;
    /** Parse a compose file (yaml dependency lives in the compose integration). */
    parseComposeFile: (filePath: string) => ComposeConfig;
}

/**
 * Factory creating a {@link ServiceHandle} for a compose service that was
 * auto-detected (stack mode) but not declared in the services record.
 */
export type ComposeServiceFactory = (service: ComposeService) => ServiceHandle;

let containerIntegrations: ContainerIntegrations | null = null;
const composeServiceFactories = new Map<string, ComposeServiceFactory>();

/** Wire the container runtimes. Called by the package entry point. */
export function registerContainerIntegrations(integrations: ContainerIntegrations): void {
    containerIntegrations = integrations;
}

/** Wire a service auto-detection factory (e.g. `'postgres'`, `'redis'`). */
export function registerComposeServiceFactory(type: string, factory: ComposeServiceFactory): void {
    composeServiceFactories.set(type, factory);
}

export function getContainerIntegrations(): ContainerIntegrations {
    if (!containerIntegrations) {
        throw new Error(
            "@jterrazz/test: container integrations are not registered — import from '@jterrazz/test' (the package entry point wires them).",
        );
    }
    return containerIntegrations;
}

export function getComposeServiceFactory(type: string): ComposeServiceFactory | undefined {
    return composeServiceFactories.get(type);
}
