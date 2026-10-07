export const SERVE = `node ${'server.mjs'}`;

export function appDirectory(): string {
    return new URL('../__fixtures__/app/', import.meta.url).pathname;
}

export const LABEL = `apps`;
