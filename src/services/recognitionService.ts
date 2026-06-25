import { defaultFoodCategories } from "../data/fridge";
import { LanguageCode, translations } from "../i18n/translations";
import { FoodCategory, FridgeZoneId, RecognitionResult } from "../types/inventory";

const knownFoods: Array<{
  keyword: string;
  nameKey: keyof typeof translations.en;
  category: FoodCategory;
  shelfLifeDays: number;
  suggestedZoneId: FridgeZoneId;
}> = [
  { keyword: "milk", nameKey: "foodMilk", category: "dairy", shelfLifeDays: 7, suggestedZoneId: "chill" },
  { keyword: "yogurt", nameKey: "foodYogurt", category: "dairy", shelfLifeDays: 10, suggestedZoneId: "chill" },
  { keyword: "apple", nameKey: "foodApple", category: "fruit", shelfLifeDays: 14, suggestedZoneId: "crisper" },
  { keyword: "tomato", nameKey: "foodTomato", category: "vegetable", shelfLifeDays: 5, suggestedZoneId: "crisper" },
  { keyword: "beef", nameKey: "foodBeef", category: "meat", shelfLifeDays: 2, suggestedZoneId: "crisper" },
  { keyword: "chicken", nameKey: "foodChicken", category: "meat", shelfLifeDays: 2, suggestedZoneId: "crisper" },
  { keyword: "fish", nameKey: "foodFish", category: "meat", shelfLifeDays: 1, suggestedZoneId: "crisper" },
  { keyword: "rice", nameKey: "foodRice", category: "leftover", shelfLifeDays: 2, suggestedZoneId: "chill" },
  { keyword: "cola", nameKey: "foodCola", category: "drink", shelfLifeDays: 30, suggestedZoneId: "chill" }
];

export interface RecognitionService {
  recognize(input: { fileName?: string; uri?: string; language: LanguageCode }): Promise<RecognitionResult>;
}

export const mockRecognitionService: RecognitionService = {
  async recognize(input) {
    const target = `${input.fileName ?? ""} ${input.uri ?? ""}`.toLowerCase();
    const matched = knownFoods.find((food) => target.includes(food.keyword));
    const category = matched?.category ?? "vegetable";
    const defaultCategory = defaultFoodCategories.find((item) => item.id === category) ?? defaultFoodCategories[0];
    const t = translations[input.language];

    return {
      name: matched ? t[matched.nameKey] : t.foodGeneric,
      category,
      shelfLifeDays: matched?.shelfLifeDays ?? defaultCategory.defaultShelfLifeDays,
      confidence: matched ? 0.86 : 0.58,
      suggestedZoneId: matched?.suggestedZoneId ?? "crisper",
      notes: matched ? t.localRecognitionMatched : t.localRecognitionFallback
    };
  }
};
