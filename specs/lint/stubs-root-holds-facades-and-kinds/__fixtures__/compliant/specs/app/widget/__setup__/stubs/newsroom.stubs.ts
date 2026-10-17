import { defineStubs } from '@jterrazz/test/stubs';

import articleGone from './http/article-gone.js';
import events from './http/events.js';

const newsroom = defineStubs(events);

export default newsroom;

export const withArticleGone = (id: string) => newsroom.with(articleGone(id));
