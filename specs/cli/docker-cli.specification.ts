import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const DOCKER_CLI_BIN = resolve(import.meta.dirname, './_fixtures/specimen-cli-docker/cli.sh');

export const { cleanup, cli, docker } = await specification.cli(DOCKER_CLI_BIN, {
    docker: {
        envVar: 'FAKE_TEST_LABEL',
        nameLabel: 'fake.world.name',
        testRunLabel: 'fake.test.run',
    },
});

afterAll(cleanup);
