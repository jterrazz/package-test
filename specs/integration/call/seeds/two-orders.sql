CREATE TABLE IF NOT EXISTS "orders" (
    id SERIAL PRIMARY KEY,
    reference TEXT NOT NULL,
    total NUMERIC NOT NULL
);
INSERT INTO "orders" (reference, total) VALUES ('ORD-1', 42), ('ORD-2', 108);
