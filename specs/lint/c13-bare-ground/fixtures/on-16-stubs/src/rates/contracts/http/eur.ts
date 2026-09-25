import { defineContract, http } from '@jterrazz/test';

export default defineContract({
    request: http.get('https://rates.test/eur'),
    response: http.json({ rate: 1.07 }),
});
