import { defineStub, openai } from '@jterrazz/test';

export default defineStub({
    request: openai.chat({ user: 'Classify: hats' }),
    response: openai.reply({ category: 'APPAREL' }),
});
