import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { FixedTickerSource } from './_setup/fixed-ticker.js';
import { FrozenClock } from './_setup/frozen-clock.js';

export const ticker = new FixedTickerSource();

export const clock = new FrozenClock();

export const { cleanup, cli } = await specification.cli('./bin/shop.sh');

afterAll(cleanup);
