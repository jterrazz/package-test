import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { FrozenClock } from './__setup__/clock.adapter.js';
import { FixedTickerSource } from './__setup__/ticker-source.adapter.js';

export const ticker = new FixedTickerSource();

export const clock = new FrozenClock();

export const { cleanup, cli } = await specification.cli('./bin/shop.sh');

afterAll(cleanup);
