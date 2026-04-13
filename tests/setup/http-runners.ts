import type { SpecRunner } from '../../src/index.js';
import { httpComposeSpec } from './http-compose.specification.js';
import { httpSpec } from './http.specification.js';

export const httpRunners: { name: string; spec: SpecRunner }[] = [
    { name: 'app', spec: httpSpec },
    { name: 'stack', spec: httpComposeSpec },
];
