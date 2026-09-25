import { defineStubs } from '../../../../src/index.js';
import latestNews from './http/latest-news.js';

/**
 * The facade the specs import (C10): the default export is the world under
 * stub, the named exports would be its scenarios.
 */
export default defineStubs(latestNews);
