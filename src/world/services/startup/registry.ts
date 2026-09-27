import type { ContainerPort, ContainerRequest } from '../containers/container.port.js';
import { ServiceContainer, serviceContainers } from '../containers/service-container.adapter.js';

export type ContainerIntegrations = {
    /** Start a single container programmatically (testcontainers). */
    createContainer: (options: ContainerRequest) => ContainerPort;
};

let containerIntegrations: ContainerIntegrations = {
    createContainer: (request) => new ServiceContainer(request, serviceContainers),
};

export function registerContainerIntegrations(integrations: ContainerIntegrations): void {
    containerIntegrations = integrations;
}

export function getContainerIntegrations(): ContainerIntegrations {
    return containerIntegrations;
}
