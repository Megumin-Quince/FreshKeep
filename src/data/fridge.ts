import { FoodCategory, FoodCategoryConfig, FridgeZone, FridgeZoneId } from "../types/inventory";

export const defaultFridgeZones: FridgeZone[] = [
  {
    id: "chill",
    name: "冷藏区",
    temperature: "2-6°C",
    hint: "日常冷藏食材、饮料、调味品"
  },
  {
    id: "crisper",
    name: "保鲜抽屉",
    temperature: "0-4°C",
    hint: "蔬菜、水果和需要保湿的食材"
  },
  {
    id: "freezer",
    name: "冷冻室",
    temperature: "-18°C",
    hint: "长期保存肉类、速冻食品、冰品"
  }
];

export const legacyZoneMap: Record<string, FridgeZoneId> = {
  door: "chill",
  upper: "crisper",
  middle: "chill",
  lower: "crisper",
  freezer: "freezer"
};

export const defaultFoodCategories: FoodCategoryConfig[] = [
  { id: "vegetable", name: "蔬菜", defaultShelfLifeDays: 5 },
  { id: "fruit", name: "水果", defaultShelfLifeDays: 7 },
  { id: "meat", name: "肉蛋海鲜", defaultShelfLifeDays: 2 },
  { id: "dairy", name: "乳制品", defaultShelfLifeDays: 10 },
  { id: "drink", name: "饮料", defaultShelfLifeDays: 14 },
  { id: "leftover", name: "剩菜熟食", defaultShelfLifeDays: 2 },
  { id: "other", name: "其他", defaultShelfLifeDays: 5 }
];

export const legacyCategoryMap: Record<string, FoodCategory> = {
  vegetable: "vegetable",
  fruit: "fruit",
  meat: "meat",
  dairy: "dairy",
  drink: "drink",
  leftover: "leftover",
  other: "other"
};
