import { defineContract, http } from '@jterrazz/test';

export default defineContract({
    response: http.json({ ok: true }),
    trigger: http.get('https://example.test/latest'),
});
