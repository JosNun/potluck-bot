import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class SQLiteAdapter {
  private static instance: SQLiteAdapter;
  private db: Database.Database;

  private constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    
    this.runMigrations();
  }

  public static getInstance(dbPath?: string): SQLiteAdapter {
    if (!SQLiteAdapter.instance) {
      const defaultPath = process.env.DATABASE_PATH || './data/potluck.db';
      SQLiteAdapter.instance = new SQLiteAdapter(dbPath || defaultPath);
    }
    return SQLiteAdapter.instance;
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  private runMigrations(): void {
    const migrations = [
      () => this.createPotlucksTable(),
      () => this.createItemsTable(), 
      () => this.createIndexes(),
    ];

    const currentVersion = this.db.pragma('user_version', { simple: true }) as number;
    
    for (let i = currentVersion; i < migrations.length; i++) {
      const migration = migrations[i];
      if (migration) {
        migration();
        this.db.pragma(`user_version = ${i + 1}`);
      }
    }
  }

  private createPotlucksTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS potlucks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT,
        theme TEXT,
        created_by TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        message_created_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);
  }

  private createItemsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS potluck_items (
        id TEXT PRIMARY KEY,
        potluck_id TEXT NOT NULL,
        name TEXT NOT NULL,
        claimed_by TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (potluck_id) REFERENCES potlucks (id) ON DELETE CASCADE
      )
    `);
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_potlucks_guild_id ON potlucks (guild_id);
      CREATE INDEX IF NOT EXISTS idx_potlucks_channel_id ON potlucks (channel_id);
      CREATE INDEX IF NOT EXISTS idx_items_potluck_id ON potluck_items (potluck_id);
    `);
  }
}