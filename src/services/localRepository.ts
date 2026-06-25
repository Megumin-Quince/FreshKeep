import AsyncStorage from "@react-native-async-storage/async-storage";
import { InventoryItem } from "../types/inventory";

const storageKey = "freshkeep.inventory.v1";

export interface InventoryRepository {
  list(): Promise<InventoryItem[]>;
  save(items: InventoryItem[]): Promise<void>;
}

export const localInventoryRepository: InventoryRepository = {
  async list() {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as InventoryItem[]) : [];
  },
  async save(items) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(items));
  }
};

export interface RemoteInventoryGateway {
  sync(items: InventoryItem[]): Promise<InventoryItem[]>;
}

export const pendingRemoteInventoryGateway: RemoteInventoryGateway = {
  async sync(items) {
    return items;
  }
};
