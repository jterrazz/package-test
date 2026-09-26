import { defineContracts } from '@jterrazz/test';
import type { Contracts } from '@jterrazz/test';

import events from './http/events.js';

export const newsroom: Contracts = defineContracts(events);
