import { FoodCategory, FridgeZone } from "../types/inventory";

export const fridgeZones: FridgeZone[] = [
  {
    id: "door",
    name: "门架",
    temperature: "6-8°C",
    hint: "饮料、调味品、短期使用食材"
  },
  {
    id: "upper",
    name: "上层",
    temperature: "3-5°C",
    hint: "熟食、剩菜、即食食品"
  },
  {
    id: "middle",
    name: "中层",
    temperature: "2-4°C",
    hint: "乳制品、鸡蛋、半成品"
  },
  {
    id: "lower",
    name: "下层",
    temperature: "0-2°C",
    hint: "肉类、海鲜、需要低温的食材"
  },
  {
    id: "freezer",
    name: "冷冻室",
    temperature: "-18°C",
    hint: "长期保存肉类、速冻食品、冰品"
  }
];

export const categoryLabels: Record<FoodCategory, string> = {
  vegetable: "蔬菜",
  fruit: "水果",
  meat: "肉蛋海鲜",
  dairy: "乳制品",
  drink: "饮料",
  leftover: "剩菜熟食",
  other: "其他"
};

export const categoryShelfLife: Record<FoodCategory, number> = {
  vegetable: 5,
  fruit: 7,
  meat: 2,
  dairy: 10,
  drink: 14,
  leftover: 2,
  other: 5
};
