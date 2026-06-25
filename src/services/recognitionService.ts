import { categoryShelfLife } from "../data/fridge";
import { FoodCategory, FridgeZoneId, RecognitionResult } from "../types/inventory";

const knownFoods: Array<{
  keyword: string;
  name: string;
  category: FoodCategory;
  shelfLifeDays: number;
  suggestedZoneId: FridgeZoneId;
}> = [
  { keyword: "milk", name: "牛奶", category: "dairy", shelfLifeDays: 7, suggestedZoneId: "middle" },
  { keyword: "yogurt", name: "酸奶", category: "dairy", shelfLifeDays: 10, suggestedZoneId: "middle" },
  { keyword: "apple", name: "苹果", category: "fruit", shelfLifeDays: 14, suggestedZoneId: "upper" },
  { keyword: "tomato", name: "番茄", category: "vegetable", shelfLifeDays: 5, suggestedZoneId: "upper" },
  { keyword: "beef", name: "牛肉", category: "meat", shelfLifeDays: 2, suggestedZoneId: "lower" },
  { keyword: "chicken", name: "鸡肉", category: "meat", shelfLifeDays: 2, suggestedZoneId: "lower" },
  { keyword: "fish", name: "鱼", category: "meat", shelfLifeDays: 1, suggestedZoneId: "lower" },
  { keyword: "rice", name: "剩饭", category: "leftover", shelfLifeDays: 2, suggestedZoneId: "upper" },
  { keyword: "cola", name: "可乐", category: "drink", shelfLifeDays: 30, suggestedZoneId: "door" }
];

export interface RecognitionService {
  recognize(input: { fileName?: string; uri?: string }): Promise<RecognitionResult>;
}

export const mockRecognitionService: RecognitionService = {
  async recognize(input) {
    const target = `${input.fileName ?? ""} ${input.uri ?? ""}`.toLowerCase();
    const matched = knownFoods.find((food) => target.includes(food.keyword));
    const category = matched?.category ?? "vegetable";

    return {
      name: matched?.name ?? "新鲜食材",
      category,
      shelfLifeDays: matched?.shelfLifeDays ?? categoryShelfLife[category],
      confidence: matched ? 0.86 : 0.58,
      suggestedZoneId: matched?.suggestedZoneId ?? "upper",
      notes: matched ? "已根据图片名称进行本地模拟识别" : "当前为离线模拟识别，可手动调整后保存"
    };
  }
};
