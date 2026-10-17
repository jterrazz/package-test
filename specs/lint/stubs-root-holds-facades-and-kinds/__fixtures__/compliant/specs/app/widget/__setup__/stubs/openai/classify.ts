import { defineStub, openai } from '@jterrazz/test/stubs';

export default defineStub({
    request: openai.chat({ user: 'Classify: hats' }),
    response: openai.reply({ category: 'APPAREL' }),
});
