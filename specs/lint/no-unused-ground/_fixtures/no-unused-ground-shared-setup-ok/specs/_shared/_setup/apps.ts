export const SERVE = `node ${'server.mjs'}`;

export function appDirectory(): string {
    return new URL('../_fixtures/app/', import.meta.url).pathname;
}

export const LABEL = `apps`;
