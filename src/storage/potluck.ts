export interface PotluckItem {
  id: string;
  name: string;
  claimedBy: string[];
}

export interface Potluck {
  id: string;
  name: string;
  date?: string;
  theme?: string;
  createdBy: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  messageCreatedAt?: Date;
  items: PotluckItem[];
  createdAt: Date;
}

export interface IPotluckStorage {
  createPotluck(potluck: Omit<Potluck, 'id' | 'createdAt'>): Promise<Potluck>;
  getPotluck(id: string): Promise<Potluck | null>;
  updatePotluck(potluck: Potluck): Promise<void>;
  updatePotluckMessage(potluckId: string, messageId: string, messageCreatedAt: Date): Promise<boolean>;
  claimItem(potluckId: string, itemId: string, userId: string): Promise<boolean>;
  unclaimItem(potluckId: string, itemId: string, userId: string): Promise<boolean>;
  addCustomItem(potluckId: string, itemName: string, claimedBy?: string): Promise<PotluckItem>;
  getPotlucksByGuild(guildId: string): Promise<Potluck[]>;
}