import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/** The `transform` a project states when its framework writes into every head what the spec never asked for: a view-transitions router's two metas here. */
export const { cleanup, website } = await specification.website({
    server: {
        command: 'node specs/website/_fixtures/specimen-website/server.mjs',
        ready: /listening on port (?<port>\d+)/u,
    },
    transform: (text) =>
        text
            .replaceAll(/,?"framework-transitions-[a-z]+":\s*"[^"]*"/gu, '')
            .replaceAll(/build [0-9a-f]{4}/gu, 'build <stamp>'),
});

afterAll(cleanup);
