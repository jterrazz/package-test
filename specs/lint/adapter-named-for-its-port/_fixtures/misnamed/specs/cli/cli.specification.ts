import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { FixedTickerSource } from './_setup/fixed-ticker.js';

export const ticker = new FixedTickerSource();

export const { cleanup, cli } = await specification.cli('./bin/shop.sh');

afterAll(cleanup);
