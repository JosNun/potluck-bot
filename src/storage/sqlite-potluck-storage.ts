import { IPotluckStorage, Potluck, PotluckItem } from './potluck';
import { SQLiteAdapter } from './sqlite-adapter';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

export class SQLitePotluckStorage implements IPotluckStorage {
  private db: Database.Database;
  private insertPotluck!: Database.Statement;
  private insertItem!: Database.Statement;
  private selectPotluck!: Database.Statement;
  private selectItems!: Database.Statement;
  private updatePotluckStmt!: Database.Statement;
  private updatePotluckMessageStmt!: Database.Statement;
  private updateItemClaims!: Database.Statement;
  private selectPotlucksByGuild!: Database.Statement;
  private deleteItem!: Database.Statement;

  constructor(dbPath?: string) {
    const adapter = SQLiteAdapter.getInstance(dbPath);
    this.db = adapter.getDatabase();
    this.prepareStatements();
  }

  private prepareStatements(): void {
    this.insertPotluck = this.db.prepare(`
      INSERT INTO potlucks (id, name, date, theme, created_by, guild_id, channel_id, message_id, message_created_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertItem = this.db.prepare(`
      INSERT INTO potluck_items (id, potluck_id, name, claimed_by)
      VALUES (?, ?, ?, ?)
    `);

    this.selectPotluck = this.db.prepare(`
      SELECT * FROM potlucks WHERE id = ?
    `);

    this.selectItems = this.db.prepare(`
      SELECT * FROM potluck_items WHERE potluck_id = ?
    `);

    this.updatePotluckStmt = this.db.prepare(`
      UPDATE potlucks 
      SET name = ?, date = ?, theme = ?, message_id = ?, message_created_at = ?
      WHERE id = ?
    `);

    this.updatePotluckMessageStmt = this.db.prepare(`
      UPDATE potlucks 
      SET message_id = ?, message_created_at = ?
      WHERE id = ?
    `);

    this.updateItemClaims = this.db.prepare(`
      UPDATE potluck_items 
      SET claimed_by = ?
      WHERE id = ?
    `);

    this.selectPotlucksByGuild = this.db.prepare(`
      SELECT * FROM potlucks WHERE guild_id = ?
    `);

    this.deleteItem = this.db.prepare(`
      DELETE FROM potluck_items WHERE id = ?
    `);
  }

  async createPotluck(potluckData: Omit<Potluck, 'id' | 'createdAt'>): Promise<Potluck> {
    const potluck: Potluck = {
      ...potluckData,
      id: randomUUID(),
      createdAt: new Date(),
    };

    const transaction = this.db.transaction(() => {
      this.insertPotluck.run(
        potluck.id,
        potluck.name,
        potluck.date || null,
        potluck.theme || null,
        potluck.createdBy,
        potluck.guildId,
        potluck.channelId,
        potluck.messageId || null,
        potluck.messageCreatedAt?.getTime() || null,
        potluck.createdAt.getTime()
      );

      for (const item of potluck.items) {
        this.insertItem.run(
          item.id,
          potluck.id,
          item.name,
          JSON.stringify(item.claimedBy)
        );
      }
    });

    transaction();
    return potluck;
  }

  async getPotluck(id: string): Promise<Potluck | null> {
    const potluckRow = this.selectPotluck.get(id) as any;
    if (!potluckRow) return null;

    const itemRows = this.selectItems.all(id) as any[];
    const items: PotluckItem[] = itemRows.map(row => ({
      id: row.id,
      name: row.name,
      claimedBy: JSON.parse(row.claimed_by),
    }));

    return {
      id: potluckRow.id,
      name: potluckRow.name,
      date: potluckRow.date || undefined,
      theme: potluckRow.theme || undefined,
      createdBy: potluckRow.created_by,
      guildId: potluckRow.guild_id,
      channelId: potluckRow.channel_id,
      messageId: potluckRow.message_id || undefined,
      messageCreatedAt: potluckRow.message_created_at ? new Date(potluckRow.message_created_at) : undefined,
      items,
      createdAt: new Date(potluckRow.created_at),
    };
  }

  async updatePotluck(potluck: Potluck): Promise<void> {
    const transaction = this.db.transaction(() => {
      this.updatePotluckStmt.run(
        potluck.name,
        potluck.date || null,
        potluck.theme || null,
        potluck.messageId || null,
        potluck.messageCreatedAt?.getTime() || null,
        potluck.id
      );

      this.db.prepare('DELETE FROM potluck_items WHERE potluck_id = ?').run(potluck.id);

      for (const item of potluck.items) {
        this.insertItem.run(
          item.id,
          potluck.id,
          item.name,
          JSON.stringify(item.claimedBy)
        );
      }
    });

    transaction();
  }

  async updatePotluckMessage(potluckId: string, messageId: string, messageCreatedAt: Date): Promise<boolean> {
    const result = this.updatePotluckMessageStmt.run(messageId, messageCreatedAt.getTime(), potluckId);
    return result.changes > 0;
  }

  async claimItem(potluckId: string, itemId: string, userId: string): Promise<boolean> {
    const potluck = await this.getPotluck(potluckId);
    if (!potluck) return false;

    const item = potluck.items.find(i => i.id === itemId);
    if (!item) return false;

    if (!item.claimedBy.includes(userId)) {
      item.claimedBy.push(userId);
      this.updateItemClaims.run(JSON.stringify(item.claimedBy), itemId);
    }

    return true;
  }

  async unclaimItem(potluckId: string, itemId: string, userId: string): Promise<boolean> {
    const potluck = await this.getPotluck(potluckId);
    if (!potluck) return false;

    const item = potluck.items.find(i => i.id === itemId);
    if (!item) return false;

    const index = item.claimedBy.indexOf(userId);
    if (index > -1) {
      item.claimedBy.splice(index, 1);
      this.updateItemClaims.run(JSON.stringify(item.claimedBy), itemId);
      return true;
    }

    return false;
  }

  async addCustomItem(potluckId: string, itemName: string, claimedBy?: string): Promise<PotluckItem> {
    const potluck = await this.getPotluck(potluckId);
    if (!potluck) throw new Error('Potluck not found');

    const newItem: PotluckItem = {
      id: randomUUID(),
      name: itemName.trim(),
      claimedBy: claimedBy ? [claimedBy] : [],
    };

    this.insertItem.run(
      newItem.id,
      potluckId,
      newItem.name,
      JSON.stringify(newItem.claimedBy)
    );

    return newItem;
  }

  async getPotlucksByGuild(guildId: string): Promise<Potluck[]> {
    const potluckRows = this.selectPotlucksByGuild.all(guildId) as any[];
    const potlucks: Potluck[] = [];

    for (const row of potluckRows) {
      const itemRows = this.selectItems.all(row.id) as any[];
      const items: PotluckItem[] = itemRows.map(itemRow => ({
        id: itemRow.id,
        name: itemRow.name,
        claimedBy: JSON.parse(itemRow.claimed_by),
      }));

      potlucks.push({
        id: row.id,
        name: row.name,
        date: row.date || undefined,
        theme: row.theme || undefined,
        createdBy: row.created_by,
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: row.message_id || undefined,
        messageCreatedAt: row.message_created_at ? new Date(row.message_created_at) : undefined,
        items,
        createdAt: new Date(row.created_at),
      });
    }

    return potlucks;
  }
}