import { IPotluckStorage, Potluck, PotluckItem } from './potluck';
import { randomUUID } from 'crypto';

export class MemoryPotluckStorage implements IPotluckStorage {
  private potlucks: Map<string, Potluck> = new Map();

  async createPotluck(potluckData: Omit<Potluck, 'id' | 'createdAt'>): Promise<Potluck> {
    const potluck: Potluck = {
      ...potluckData,
      id: randomUUID(),
      createdAt: new Date(),
    };
    
    this.potlucks.set(potluck.id, potluck);
    return potluck;
  }

  async getPotluck(id: string): Promise<Potluck | null> {
    return this.potlucks.get(id) || null;
  }

  async updatePotluck(potluck: Potluck): Promise<void> {
    this.potlucks.set(potluck.id, potluck);
  }

  async updatePotluckMessage(potluckId: string, messageId: string, messageCreatedAt: Date): Promise<boolean> {
    const potluck = this.potlucks.get(potluckId);
    if (!potluck) return false;

    potluck.messageId = messageId;
    potluck.messageCreatedAt = messageCreatedAt;
    return true;
  }

  async claimItem(potluckId: string, itemId: string, userId: string): Promise<boolean> {
    const potluck = this.potlucks.get(potluckId);
    if (!potluck) return false;

    const item = potluck.items.find(i => i.id === itemId);
    if (!item) return false;

    if (!item.claimedBy.includes(userId)) {
      item.claimedBy.push(userId);
    }

    return true;
  }

  async unclaimItem(potluckId: string, itemId: string, userId: string): Promise<boolean> {
    const potluck = this.potlucks.get(potluckId);
    if (!potluck) return false;

    const item = potluck.items.find(i => i.id === itemId);
    if (!item) return false;

    const index = item.claimedBy.indexOf(userId);
    if (index > -1) {
      item.claimedBy.splice(index, 1);
      return true;
    }

    return false;
  }

  async addCustomItem(potluckId: string, itemName: string, claimedBy?: string): Promise<PotluckItem> {
    const potluck = this.potlucks.get(potluckId);
    if (!potluck) throw new Error('Potluck not found');

    const newItem: PotluckItem = {
      id: randomUUID(),
      name: itemName.trim(),
      claimedBy: claimedBy ? [claimedBy] : [],
    };

    potluck.items.push(newItem);
    return newItem;
  }

  async getPotlucksByGuild(guildId: string): Promise<Potluck[]> {
    return Array.from(this.potlucks.values()).filter(p => p.guildId === guildId);
  }
}