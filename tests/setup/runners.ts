import type { SpecificationRunner } from '../../src/specification/specification.js';
import { e2eSpec } from './e2e.specification.js';
import { integrationSpec } from './integration.specification.js';

export const runners: { name: string; spec: SpecificationRunner }[] = [
    { name: 'integration', spec: integrationSpec },
    { name: 'e2e', spec: e2eSpec },
];
