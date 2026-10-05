import { describe, expect, test } from 'vitest';

import { tempRootSetup } from '../../chain/paths/temp-root.global-setup.js';
import { inPlaceSetup } from '../../expectations/in-place/in-place.global-setup.js';
import { servicesSetup } from '../../services/containers/services.global-setup.js';
import { integration } from './integration.project.js';

describe('integration', () => {
    test('integration.project — the vitest project of the specification — is named for it, and starts the run’s services after the setups every project has', () => {
        // Given - the specification’s project
        const project = integration();

        // Then - it is named for it, and starts the run’s services after the setups every project has
        expect([project.test?.name, project.test?.globalSetup]).toStrictEqual([
            'integration',
            [inPlaceSetup(), tempRootSetup(), servicesSetup()],
        ]);
    });
});
