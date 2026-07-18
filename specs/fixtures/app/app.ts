import { Hono } from 'hono';

interface AppOptions {
    databaseUrl: string;
    analyticsDatabaseUrl?: string;
    redisUrl?: string;
}

export function createApp(options: AppOptions) {
    const app = new Hono();

    async function query(sql: string, params: unknown[] = []) {
        const { Client } = await import('pg');
        const client = new Client({ connectionString: options.databaseUrl });
        await client.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            await client.end();
        }
    }

    async function analyticsQuery(sql: string, params: unknown[] = []) {
        if (!options.analyticsDatabaseUrl) {
            throw new Error('Analytics database not configured');
        }
        const { Client } = await import('pg');
        const client = new Client({ connectionString: options.analyticsDatabaseUrl });
        await client.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            await client.end();
        }
    }

    app.get('/users', async (c) => {
        const users = await query('SELECT name, email FROM "users" ORDER BY id');
        return c.json({ users });
    });

    app.get('/users/:id', async (c) => {
        const id = Number(c.req.param('id'));
        const rows = await query('SELECT name, email FROM "users" WHERE id = $1', [id]);

        if (rows.length === 0) {
            return c.json({ error: 'User not found' }, 404);
        }

        return c.json({ user: rows[0] });
    });

    app.post('/users', async (c) => {
        const body = await c.req.json();
        const rows = await query(
            'INSERT INTO "users" (name, email) VALUES ($1, $2) RETURNING name, email',
            [body.name, body.email],
        );

        // Log event to analytics database if available
        if (options.analyticsDatabaseUrl) {
            await analyticsQuery('INSERT INTO "events" (type, payload) VALUES ($1, $2)', [
                'user_created',
                JSON.stringify({ name: body.name, email: body.email }),
            ]);
        }

        return c.json({ user: rows[0] }, 201);
    });

    app.put('/users/:id', async (c) => {
        const id = Number(c.req.param('id'));
        const body = await c.req.json();
        const rows = await query(
            'UPDATE "users" SET name = $1, email = $2 WHERE id = $3 RETURNING name, email',
            [body.name, body.email, id],
        );

        if (rows.length === 0) {
            return c.json({ error: 'User not found' }, 404);
        }

        return c.json({ user: rows[0] });
    });

    app.get('/session', (c) => {
        const id = crypto.randomUUID();
        return c.json({
            echo: { sessionId: id },
            id,
            startedAt: new Date().toISOString(),
            ttl: 3600,
        });
    });

    app.post('/echo', async (c) => {
        const body = await c.req.json().catch(() => null);
        return c.json({
            body,
            headers: {
                'x-chain': c.req.header('x-chain') ?? null,
                'x-file': c.req.header('x-file') ?? null,
            },
        });
    });

    app.post('/echo-raw', async (c) => {
        // Echo the request body verbatim — used to assert raw (non-JSON)
        // body passthrough from requests/*.http files.
        const raw = await c.req.text();
        return c.json({ raw });
    });

    app.get('/events', async (c) => {
        const events = await analyticsQuery('SELECT type, payload FROM "events" ORDER BY id');
        return c.json({ events });
    });

    app.delete('/users/:id', async (c) => {
        const id = Number(c.req.param('id'));
        const rows = await query('DELETE FROM "users" WHERE id = $1 RETURNING name', [id]);

        if (rows.length === 0) {
            return c.json({ error: 'User not found' }, 404);
        }

        return c.json({ deleted: true });
    });

    return app;
}
