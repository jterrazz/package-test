import { defineContract, http } from '@jterrazz/test';

export default (id: string) =>
    defineContract({
        request: http.get(`/articles/${id}`),
        response: http.error(410, { error: 'gone' }),
    });
