import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultAppSettings, AppSettings } from "../i18n/translations";
import { FoodCategoryConfig, FridgeZone, InventoryItem } from "../types/inventory";

const inventoryStorageKey = "freshkeep.inventory.v1";
const zonesStorageKey = "freshkeep.zones.v1";
const categoriesStorageKey = "freshkeep.categories.v1";
const settingsStorageKey = "freshkeep.settings.v1";

function parseStoredArray<T>(raw: string | null, fallback: T[]): T[] {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export interface InventoryRepository {
  list(): Promise<InventoryItem[]>;
  save(items: InventoryItem[]): Promise<void>;
}

export const localInventoryRepository: InventoryRepository = {
  async list() {
    const raw = await AsyncStorage.getItem(inventoryStorageKey);
    return parseStoredArray<InventoryItem>(raw, []);
  },
  async save(items) {
    await AsyncStorage.setItem(inventoryStorageKey, JSON.stringify(items));
  }
};

export interface ZoneRepository {
  list(): Promise<FridgeZone[]>;
  save(zones: FridgeZone[]): Promise<void>;
}

export const localZoneRepository: ZoneRepository = {
  async list() {
    const raw = await AsyncStorage.getItem(zonesStorageKey);
    return parseStoredArray<FridgeZone>(raw, []);
  },
  async save(zones) {
    await AsyncStorage.setItem(zonesStorageKey, JSON.stringify(zones));
  }
};

export interface CategoryRepository {
  list(): Promise<FoodCategoryConfig[]>;
  save(categories: FoodCategoryConfig[]): Promise<void>;
}

export const localCategoryRepository: CategoryRepository = {
  async list() {
    const raw = await AsyncStorage.getItem(categoriesStorageKey);
    return parseStoredArray<FoodCategoryConfig>(raw, []);
  },
  async save(categories) {
    await AsyncStorage.setItem(categoriesStorageKey, JSON.stringify(categories));
  }
};

export interface AppSettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

export const localAppSettingsRepository: AppSettingsRepository = {
  async get() {
    const raw = await AsyncStorage.getItem(settingsStorageKey);
    if (!raw) {
      return defaultAppSettings;
    }

    try {
      return { ...defaultAppSettings, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      return defaultAppSettings;
    }
  },
  async save(settings) {
    await AsyncStorage.setItem(settingsStorageKey, JSON.stringify(settings));
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
