export type FridgeZoneId = string;

export type FreshnessStatus = "fresh" | "soon" | "expired";

export type FoodCategory = string;

export interface FridgeZone {
  id: FridgeZoneId;
  name: string;
  temperature: string;
  hint: string;
}

export interface FridgeZoneDraft {
  id?: FridgeZoneId;
  name: string;
  temperature: string;
  hint: string;
}

export interface FoodCategoryConfig {
  id: FoodCategory;
  name: string;
  defaultShelfLifeDays: number;
}

export interface FoodCategoryDraft {
  id?: FoodCategory;
  name: string;
  defaultShelfLifeDays: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: FoodCategory;
  quantity: string;
  zoneId: FridgeZoneId;
  temperature: string;
  storedAt: string;
  expiresAt: string;
  notes?: string;
  imageUri?: string;
  source: "manual" | "recognized";
  syncedAt?: string;
}

export interface ItemDraft {
  name: string;
  category: FoodCategory;
  quantity: string;
  zoneId: FridgeZoneId;
  temperature: string;
  shelfLifeDays: number;
  notes?: string;
  imageUri?: string;
}

export interface RecognitionResult {
  name: string;
  category: FoodCategory;
  shelfLifeDays: number;
  confidence: number;
  suggestedZoneId: FridgeZoneId;
  notes: string;
}
