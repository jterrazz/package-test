import { defineContracts } from '@jterrazz/test';

import articleGone from './http/article-gone.js';
import events from './http/events.js';

const newsroom = defineContracts(events);

export default newsroom;

export const withArticleGone = (id: string) => newsroom.with(articleGone(id));
