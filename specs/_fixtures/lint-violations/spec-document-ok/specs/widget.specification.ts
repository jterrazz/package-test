import { specification } from '@jterrazz/test';

export const { cleanup, cli } = await specification.cli('widget', {
    env: { frozen: { TZ: 'UTC' } },
    serve: {
        api: {
            command: 'node server.mjs',
            env: 'WIDGET_API_URL',
            ready: /listening on port (?<port>\d+)/,
            url: (port) => `http://127.0.0.1:${port}/`,
        },
    },
});
