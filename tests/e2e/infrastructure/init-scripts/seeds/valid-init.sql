CREATE TABLE IF NOT EXISTS "init_test" (
    id SERIAL PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO "init_test" (value) VALUES ('initialized');
