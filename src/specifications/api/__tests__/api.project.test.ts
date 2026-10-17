import { describe, expect, test } from 'vitest';

import { tempRootSetup } from '../../../chain/paths/temp-root.global-setup.js';
import { inPlaceSetup } from '../../../expectations/in-place/in-place.global-setup.js';
import { servicesSetup } from '../../../services/containers/services.global-setup.js';
import { api } from '../api.project.js';
import { routeCoverageSetup } from '../routes/route-coverage.global-setup.js';

describe('api', () => {
    test("api.project — the vitest project of the specification — is named for it, and starts the run's services after the setups every project has and judges its routes", () => {
        // Given - the specification's project
        const project = api();

        // Then - it is named for it, and starts the run's services after the setups every project has and judges its routes
        expect([project.test?.name, project.test?.globalSetup]).toStrictEqual([
            'api',
            [inPlaceSetup(), tempRootSetup(), servicesSetup(), routeCoverageSetup()],
        ]);
    });
});
