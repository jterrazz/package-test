import type { ContainerPort } from '../../ports/container.port.js';

/**
 * Integration registry — the seam that keeps `specification/` free of external
 * dependencies (CONVENTIONS I1). Core code (the orchestrator) consumes the
 * container runtime through this registry; the concrete implementation lives
 * under `integrations/` and is wired in by the package entry point
 * (`src/index.ts`), which is the composition root every consumer goes through
 * (CONVENTIONS F1).
 */

/** The container-runtime factory the testcontainers integration provides. */
export type ContainerIntegrations = {
    /** Start a single container programmatically (testcontainers). */
    createContainer: (options: {
        image: string;
        port: number;
        env?: Record<string, string>;
    }) => ContainerPort;
};

let containerIntegrations: ContainerIntegrations | null = null;

/** Wire the container runtime. Called by the package entry point. */
export function registerContainerIntegrations(integrations: ContainerIntegrations): void {
    containerIntegrations = integrations;
}

export function getContainerIntegrations(): ContainerIntegrations {
    if (!containerIntegrations) {
        throw new Error(
            "@jterrazz/test: container integrations are not registered — import from '@jterrazz/test' (the package entry point wires them).",
        );
    }
    return containerIntegrations;
}
