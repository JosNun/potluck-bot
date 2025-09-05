import { IPotluckStorage } from './potluck';
import { SQLitePotluckStorage } from './sqlite-potluck-storage';

export class StorageFactory {
  private static instance: IPotluckStorage;

  public static getStorage(): IPotluckStorage {
    if (StorageFactory.instance) {
      return StorageFactory.instance;
    }

    StorageFactory.instance = new SQLitePotluckStorage();
    return StorageFactory.instance;
  }

  public static reset(): void {
    StorageFactory.instance = null as any;
  }
}