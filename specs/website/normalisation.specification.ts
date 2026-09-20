import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

/**
 * The runner for the normalised readings: the same fixture site, with the
 * `transform` a project states when its FRAMEWORK writes something into every
 * head that the specification never asked for — a view-transitions router's
 * two metas here, and the same shape for any noise a `{{token}}` cannot name.
 */
export const { cleanup, website } = await specification.website({
    server: { command: 'node specs/_fixtures/website-app/server.mjs', ready: '/' },
    transform: (text) => text.replaceAll(/,?"framework-transitions-[a-z]+":\s*"[^"]*"/gu, ''),
});

afterAll(cleanup);
