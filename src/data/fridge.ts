import { FoodCategory, FoodCategoryConfig, FridgeZone, FridgeZoneId } from "../types/inventory";
import { LanguageCode, translations } from "../i18n/translations";

export function createDefaultFridgeZones(language: LanguageCode): FridgeZone[] {
  const t = translations[language];
  return [
    {
      id: "chill",
      name: t.defaultZoneChillName,
      temperature: "2-6°C",
      hint: t.defaultZoneChillHint
    },
    {
      id: "crisper",
      name: t.defaultZoneCrisperName,
      temperature: "0-4°C",
      hint: t.defaultZoneCrisperHint
    },
    {
      id: "freezer",
      name: t.defaultZoneFreezerName,
      temperature: "-18°C",
      hint: t.defaultZoneFreezerHint
    }
  ];
}

export const defaultFridgeZones: FridgeZone[] = createDefaultFridgeZones("zh");

export const builtInZoneIds = new Set(defaultFridgeZones.map((zone) => zone.id));

export const builtInZoneNames: Record<FridgeZoneId, string[]> = {
  chill: [translations.zh.defaultZoneChillName, translations.en.defaultZoneChillName],
  crisper: [translations.zh.defaultZoneCrisperName, translations.en.defaultZoneCrisperName],
  freezer: [translations.zh.defaultZoneFreezerName, translations.en.defaultZoneFreezerName]
};

export const builtInZoneHints: Record<FridgeZoneId, string[]> = {
  chill: [translations.zh.defaultZoneChillHint, translations.en.defaultZoneChillHint],
  crisper: [translations.zh.defaultZoneCrisperHint, translations.en.defaultZoneCrisperHint],
  freezer: [translations.zh.defaultZoneFreezerHint, translations.en.defaultZoneFreezerHint]
};

export const legacyFridgeZones: FridgeZone[] = [
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

export function createDefaultFoodCategories(language: LanguageCode): FoodCategoryConfig[] {
  const t = translations[language];
  return [
    { id: "vegetable", name: t.categoryVegetable, defaultShelfLifeDays: 5 },
    { id: "fruit", name: t.categoryFruit, defaultShelfLifeDays: 7 },
    { id: "meat", name: t.categoryMeat, defaultShelfLifeDays: 2 },
    { id: "dairy", name: t.categoryDairy, defaultShelfLifeDays: 10 },
    { id: "drink", name: t.categoryDrink, defaultShelfLifeDays: 14 },
    { id: "leftover", name: t.categoryLeftover, defaultShelfLifeDays: 2 },
    { id: "other", name: t.categoryOther, defaultShelfLifeDays: 5 }
  ];
}

export const defaultFoodCategories: FoodCategoryConfig[] = createDefaultFoodCategories("zh");

export const builtInCategoryIds = new Set(defaultFoodCategories.map((category) => category.id));

export const builtInCategoryNames: Record<FoodCategory, string[]> = {
  vegetable: [translations.zh.categoryVegetable, translations.en.categoryVegetable],
  fruit: [translations.zh.categoryFruit, translations.en.categoryFruit],
  meat: [translations.zh.categoryMeat, translations.en.categoryMeat],
  dairy: [translations.zh.categoryDairy, translations.en.categoryDairy],
  drink: [translations.zh.categoryDrink, translations.en.categoryDrink],
  leftover: [translations.zh.categoryLeftover, translations.en.categoryLeftover],
  other: [translations.zh.categoryOther, translations.en.categoryOther]
};

export const legacyCategoryMap: Record<string, FoodCategory> = {
  vegetable: "vegetable",
  fruit: "fruit",
  meat: "meat",
  dairy: "dairy",
  drink: "drink",
  leftover: "leftover",
  other: "other"
};
