import Database from "better-sqlite3";

export function createDatabase() {
  const db = new Database(":memory:");

  db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE
        )
    `);

  return db;
}
