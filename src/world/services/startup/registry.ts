import type { ContainerPort, ContainerRequest } from '../containers/container.port.js';
import { ServiceContainer, serviceContainers } from '../containers/service-container.js';

/**
 * The container runtime the orchestrator starts a service's container
 * through. It is the project's served containers, or testcontainers of its
 * own (`ServiceContainer`), unless a module test registers a double in its
 * place.
 */

/** The container-runtime factory the orchestrator asks. */
export type ContainerIntegrations = {
    /** Start a single container programmatically (testcontainers). */
    createContainer: (options: ContainerRequest) => ContainerPort;
};

let containerIntegrations: ContainerIntegrations = {
    createContainer: (request) => new ServiceContainer(request, serviceContainers),
};

/** Replace the container runtime — what a module test hands the orchestrator its double through. */
export function registerContainerIntegrations(integrations: ContainerIntegrations): void {
    containerIntegrations = integrations;
}

export function getContainerIntegrations(): ContainerIntegrations {
    return containerIntegrations;
}
