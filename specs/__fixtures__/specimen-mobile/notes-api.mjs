// The API Specimen's notes screen reads — started as a `process()` service
// beside the app. Zero dependencies; it binds port 0 and prints the port it
// got.
import { createServer } from 'node:http';

const notes = [{ title: 'Buy oat milk' }, { title: 'Call the plumber' }];

const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/notes') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(notes));
        return;
    }
    response.writeHead(404);
    response.end();
});

server.listen(0, '127.0.0.1', () => {
    console.log(`listening on port ${server.address().port}`);
});
