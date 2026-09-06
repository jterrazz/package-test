import { defineContract, openai } from '@jterrazz/test';

export default defineContract({
    request: openai.chat({ user: 'Classify: hats' }),
    response: openai.reply({ category: 'APPAREL' }),
});
