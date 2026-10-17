import { defineStub, openai } from '@jterrazz/test/stubs';

import { prompt } from './classify.request.js';

export default defineStub({
    request: openai.chat({ user: prompt }),
    response: openai.reply({ category: 'APPAREL' }),
});
