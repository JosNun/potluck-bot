import { IPotluckStorage } from './potluck';
import { MemoryPotluckStorage } from './memory-potluck-storage';
import { SQLitePotluckStorage } from './sqlite-potluck-storage';

export type StorageType = 'memory' | 'sqlite';

export class StorageFactory {
  private static instance: IPotluckStorage;

  public static getStorage(type?: StorageType): IPotluckStorage {
    if (StorageFactory.instance) {
      return StorageFactory.instance;
    }

    const storageType = type || (process.env.STORAGE_TYPE as StorageType) || 'memory';
    
    switch (storageType) {
      case 'sqlite':
        StorageFactory.instance = new SQLitePotluckStorage();
        break;
      case 'memory':
      default:
        StorageFactory.instance = new MemoryPotluckStorage();
        break;
    }

    return StorageFactory.instance;
  }

  public static reset(): void {
    StorageFactory.instance = null as any;
  }
}