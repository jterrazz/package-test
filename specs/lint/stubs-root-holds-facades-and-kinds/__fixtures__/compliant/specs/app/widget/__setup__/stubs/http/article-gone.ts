import { defineStub, http } from '@jterrazz/test/stubs';

export default (id: string) =>
    defineStub({
        request: http.get(`/articles/${id}`),
        response: http.error(410, { error: 'gone' }),
    });
