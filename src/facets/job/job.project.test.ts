import { describe, expect, test } from 'vitest';

import { tempRootSetup } from '../../chain/paths/temp-root.js';
import { inPlaceSetup } from '../../expectations/in-place/in-place-setup.js';
import { servicesSetup } from '../../services/containers/run-setup.js';
import { job } from './job.project.js';

describe('job', () => {
    test('job.project — the vitest project of the facet — is named for it, and starts the run’s services after the setups every project has', () => {
        // Given - the facet’s project
        const project = job();

        // Then - it is named for it, and starts the run’s services after the setups every project has
        expect([project.test?.name, project.test?.globalSetup]).toStrictEqual([
            'job',
            [inPlaceSetup(), tempRootSetup(), servicesSetup()],
        ]);
    });
});
