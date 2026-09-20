-- A comment naming datetime('now') is prose, not state.
INSERT INTO "post" (id, title, created_at) VALUES (1, 'yesterday', datetime('now', '-1 day'));
INSERT INTO "post" (id, title, created_at) VALUES (2, 'today', CURRENT_TIMESTAMP);
INSERT INTO "post" (id, title, published_at) VALUES (3, 'live', NOW());
