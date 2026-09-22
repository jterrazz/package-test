import { specification } from '@jterrazz/test';

export const { cleanup, cli } = await specification.cli('widget', {
    env: { frozen: { TZ: 'UTC' } },
    serve: {
        console: {
            command: 'node console.mjs',
            env: 'WIDGET_CONSOLE_URL',
            ready: /listening on port (?<port>\d+)/,
            url: (port) => `http://127.0.0.1:${port}/`,
        },
    },
});
