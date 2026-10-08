import { resolve } from 'node:path';

import { CURRENCY } from '../../__setup__/currency.js';

export const ROWS = [{ currency: CURRENCY, item: 'book' }];

export const PROJECT = resolve(import.meta.dirname, '..', '..', '..', '..');
