import { defineStubs } from '@jterrazz/test';

import events from './http/events.js';
import classify from './openai/classify.js';

export default defineStubs(events, classify);
