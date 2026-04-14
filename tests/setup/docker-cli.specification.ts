import { resolve } from 'node:path';

import { docker, spec } from '../../src/index.js';

const DOCKER_CLI_BIN = resolve(import.meta.dirname, './fixtures/docker-cli/cli.sh');

export const dockerCliSpec = await spec(
    docker(DOCKER_CLI_BIN, {
        envVar: 'FAKE_TEST_LABEL',
        nameLabel: 'fake.world.name',
        testRunLabel: 'fake.test.run',
    }),
    { root: './fixtures' },
);
