import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { defaultFoodCategories, defaultFridgeZones, legacyCategoryMap, legacyZoneMap } from "./src/data/fridge";
import { addDays, formatRemaining, freshnessStatus, toISODate } from "./src/services/dateUtils";
import {
  localInventoryRepository,
  localCategoryRepository,
  localZoneRepository,
  pendingRemoteInventoryGateway
} from "./src/services/localRepository";
import { mockRecognitionService } from "./src/services/recognitionService";
import { colors } from "./src/theme/colors";
import {
  FoodCategory,
  FoodCategoryConfig,
  FoodCategoryDraft,
  FridgeZone,
  FridgeZoneDraft,
  FridgeZoneId,
  InventoryItem,
  ItemDraft
} from "./src/types/inventory";

const firstDefaultZone = defaultFridgeZones[0];
const firstDefaultCategory = defaultFoodCategories[0];
const initialZoneDraft: FridgeZoneDraft = { name: "", temperature: "", hint: "" };
const initialCategoryDraft: FoodCategoryDraft = { name: "", defaultShelfLifeDays: 5 };

function createDraft(zone: FridgeZone = firstDefaultZone, category: FoodCategoryConfig = firstDefaultCategory): ItemDraft {
  return {
    name: "",
    category: category.id,
    quantity: "1 份",
    zoneId: zone.id,
    temperature: zone.temperature,
    shelfLifeDays: category.defaultShelfLifeDays,
    notes: ""
  };
}

const seedItems: InventoryItem[] = [
  {
    id: "seed-milk",
    name: "低温鲜奶",
    category: "dairy",
    quantity: "1 瓶",
    zoneId: "chill",
    temperature: "2-6°C",
    storedAt: toISODate(addDays(new Date(), -2)),
    expiresAt: toISODate(addDays(new Date(), 4)),
    notes: "开封后优先饮用",
    source: "manual"
  },
  {
    id: "seed-spinach",
    name: "菠菜",
    category: "vegetable",
    quantity: "1 把",
    zoneId: "crisper",
    temperature: "0-4°C",
    storedAt: toISODate(addDays(new Date(), -3)),
    expiresAt: toISODate(addDays(new Date(), 1)),
    notes: "已清洗，注意控水",
    source: "manual"
  },
  {
    id: "seed-beef",
    name: "牛排",
    category: "meat",
    quantity: "2 块",
    zoneId: "freezer",
    temperature: "-18°C",
    storedAt: toISODate(addDays(new Date(), -10)),
    expiresAt: toISODate(addDays(new Date(), 40)),
    notes: "分装冷冻",
    source: "manual"
  }
];

export default function App() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [zones, setZones] = useState<FridgeZone[]>(defaultFridgeZones);
  const [foodCategories, setFoodCategories] = useState<FoodCategoryConfig[]>(defaultFoodCategories);
  const [selectedZone, setSelectedZone] = useState<FridgeZoneId | "all">("all");
  const [draft, setDraft] = useState<ItemDraft>(createDraft(defaultFridgeZones[0]));
  const [zoneDraft, setZoneDraft] = useState<FridgeZoneDraft>(initialZoneDraft);
  const [categoryDraft, setCategoryDraft] = useState<FoodCategoryDraft>(initialCategoryDraft);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"zones" | "categories">("zones");
  const [loading, setLoading] = useState(true);
  const [recognizing, setRecognizing] = useState(false);

  useEffect(() => {
    Promise.all([localInventoryRepository.list(), localZoneRepository.list(), localCategoryRepository.list()])
      .then(([storedItems, storedZones, storedCategories]) => {
        const activeZones = storedZones.length ? storedZones : defaultFridgeZones;
        const activeCategories = storedCategories.length ? storedCategories : defaultFoodCategories;
        const activeZoneIds = new Set(activeZones.map((zone) => zone.id));
        const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
        const migratedItems = (storedItems.length ? storedItems : seedItems).map((item) => {
          const nextZoneId = legacyZoneMap[item.zoneId] ?? item.zoneId;
          const nextCategoryId = legacyCategoryMap[item.category] ?? item.category;
          const zone = activeZoneIds.has(nextZoneId)
            ? activeZones.find((entry) => entry.id === nextZoneId) ?? activeZones[0]
            : activeZones[0];
          const category = activeCategoryIds.has(nextCategoryId) ? nextCategoryId : activeCategories[0].id;
          return { ...item, zoneId: zone.id, temperature: zone.temperature, category };
        });

        setZones(activeZones);
        setFoodCategories(activeCategories);
        setItems(migratedItems);
        setDraft(createDraft(activeZones[0], activeCategories[0]));
      })
      .catch(() => {
        setZones(defaultFridgeZones);
        setFoodCategories(defaultFoodCategories);
        setItems(seedItems);
        setDraft(createDraft(defaultFridgeZones[0], defaultFoodCategories[0]));
        Alert.alert("读取本地数据失败", "FreshKeep 已使用默认配置启动，你仍然可以继续添加和保存食材。");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading) {
      localInventoryRepository.save(items).catch(() => {
        console.warn("FreshKeep failed to persist inventory items.");
      });
    }
  }, [items, loading]);

  useEffect(() => {
    if (!loading) {
      localZoneRepository.save(zones).catch(() => {
        console.warn("FreshKeep failed to persist fridge zones.");
      });
    }
  }, [zones, loading]);

  useEffect(() => {
    if (!loading) {
      localCategoryRepository.save(foodCategories).catch(() => {
        console.warn("FreshKeep failed to persist food categories.");
      });
    }
  }, [foodCategories, loading]);

  const stats = useMemo(() => {
    const expiring = items.filter((item) => freshnessStatus(item.expiresAt) === "soon").length;
    const expired = items.filter((item) => freshnessStatus(item.expiresAt) === "expired").length;
    const zoneCount = zones.length;
    return { total: items.length, expiring, expired, zoneCount };
  }, [items, zones.length]);

  const filteredItems = useMemo(() => {
    const list = selectedZone === "all" ? items : items.filter((item) => item.zoneId === selectedZone);
    return [...list].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }, [items, selectedZone]);

  function updateDraft(next: Partial<ItemDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function selectCategory(category: FoodCategory) {
    const selected = foodCategories.find((item) => item.id === category) ?? foodCategories[0] ?? firstDefaultCategory;
    updateDraft({ category, shelfLifeDays: selected.defaultShelfLifeDays });
  }

  function selectZone(zoneId: FridgeZoneId) {
    const zone = zones.find((item) => item.id === zoneId) ?? zones[0] ?? firstDefaultZone;
    updateDraft({ zoneId, temperature: zone.temperature });
  }

  function openAddItemModal() {
    setDraft(createDraft(zones[0] ?? firstDefaultZone, foodCategories[0] ?? firstDefaultCategory));
    setModalVisible(true);
  }

  function editZone(zone: FridgeZone) {
    setZoneDraft(zone);
    setSettingsTab("zones");
    setSettingsModalVisible(true);
  }

  function resetSettingsDrafts() {
    setZoneDraft(initialZoneDraft);
    setCategoryDraft(initialCategoryDraft);
  }

  function saveZoneDraft() {
    const name = zoneDraft.name.trim();
    const temperature = zoneDraft.temperature.trim();
    if (!name || !temperature) {
      Alert.alert("还缺少分区信息", "请填写分区名称和温度范围。");
      return;
    }

    const nextZone: FridgeZone = {
      id: zoneDraft.id ?? `zone-${Date.now()}`,
      name,
      temperature,
      hint: zoneDraft.hint.trim()
    };

    setZones((current) => {
      const exists = current.some((zone) => zone.id === nextZone.id);
      return exists ? current.map((zone) => (zone.id === nextZone.id ? nextZone : zone)) : [...current, nextZone];
    });

    setItems((current) =>
      current.map((item) =>
        item.zoneId === nextZone.id ? { ...item, temperature: nextZone.temperature } : item
      )
    );
    setZoneDraft(initialZoneDraft);
  }

  function openSettings(tab: "zones" | "categories" = "zones") {
    resetSettingsDrafts();
    setSettingsTab(tab);
    setSettingsModalVisible(true);
  }

  function closeSettings() {
    resetSettingsDrafts();
    setSettingsModalVisible(false);
  }

  function editCategory(category: FoodCategoryConfig) {
    setCategoryDraft(category);
    setSettingsTab("categories");
    setSettingsModalVisible(true);
  }

  function saveCategoryDraft() {
    const name = categoryDraft.name.trim();
    if (!name) {
      Alert.alert("还缺少类别名称", "请填写类别名称。");
      return;
    }

    const nextCategory: FoodCategoryConfig = {
      id: categoryDraft.id ?? `category-${Date.now()}`,
      name,
      defaultShelfLifeDays: Math.max(0, categoryDraft.defaultShelfLifeDays)
    };

    setFoodCategories((current) => {
      const exists = current.some((category) => category.id === nextCategory.id);
      return exists
        ? current.map((category) => (category.id === nextCategory.id ? nextCategory : category))
        : [...current, nextCategory];
    });
    setCategoryDraft(initialCategoryDraft);
  }

  function deleteCategory(categoryId: FoodCategory) {
    if (foodCategories.length <= 1) {
      Alert.alert("至少保留一个类别", "食材需要至少一个可选择的类别。");
      return;
    }

    const category = foodCategories.find((entry) => entry.id === categoryId);
    const fallback = foodCategories.find((entry) => entry.id !== categoryId) ?? firstDefaultCategory;
    Alert.alert("删除类别", `删除“${category?.name ?? "该类别"}”后，已有食材会移动到“${fallback.name}”。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          setFoodCategories((current) => current.filter((entry) => entry.id !== categoryId));
          setItems((current) =>
            current.map((item) => (item.category === categoryId ? { ...item, category: fallback.id } : item))
          );
          if (draft.category === categoryId) {
            setDraft((current) => ({ ...current, category: fallback.id, shelfLifeDays: fallback.defaultShelfLifeDays }));
          }
        }
      }
    ]);
  }

  function deleteZone(zoneId: FridgeZoneId) {
    if (zones.length <= 1) {
      Alert.alert("至少保留一个分区", "冰箱需要至少一个可选择的位置。");
      return;
    }

    const zone = zones.find((entry) => entry.id === zoneId);
    const fallback = zones.find((entry) => entry.id !== zoneId) ?? firstDefaultZone;
    Alert.alert("删除分区", `删除“${zone?.name ?? "该分区"}”后，里面的食材会移动到“${fallback.name}”。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          setZones((current) => current.filter((entry) => entry.id !== zoneId));
          setItems((current) =>
            current.map((item) =>
              item.zoneId === zoneId
                ? { ...item, zoneId: fallback.id, temperature: fallback.temperature }
                : item
            )
          );
          if (selectedZone === zoneId) {
            setSelectedZone("all");
          }
        }
      }
    ]);
  }

  async function pickAndRecognize() {
    setRecognizing(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("需要相册权限", "允许访问相册后，FreshKeep 才能读取图片并进行本地模拟识别。");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const recognition = await mockRecognitionService.recognize({
        uri: asset.uri,
        fileName: asset.fileName ?? undefined
      });
      const zone = zones.find((item) => item.id === recognition.suggestedZoneId) ?? zones[0] ?? firstDefaultZone;
      const recognizedCategory =
        foodCategories.find((item) => item.id === recognition.category) ?? foodCategories[0] ?? firstDefaultCategory;
      setDraft({
        name: recognition.name,
        category: recognizedCategory.id,
        quantity: "1 份",
        zoneId: zone.id,
        temperature: zone.temperature,
        shelfLifeDays: recognition.shelfLifeDays || recognizedCategory.defaultShelfLifeDays,
        notes: `${recognition.notes}，置信度 ${Math.round(recognition.confidence * 100)}%`,
        imageUri: asset.uri
      });
      setModalVisible(true);
    } catch {
      Alert.alert("识别失败", "暂时无法读取图片，你可以改用手动放入。");
    } finally {
      setRecognizing(false);
    }
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      Alert.alert("还缺少名称", "请填写食材名称，方便后续查找和提醒。");
      return;
    }

    const today = new Date();
    const item: InventoryItem = {
      id: `${Date.now()}`,
      name: draft.name.trim(),
      category: draft.category,
      quantity: draft.quantity.trim() || "1 份",
      zoneId: draft.zoneId,
      temperature: draft.temperature.trim(),
      storedAt: toISODate(today),
      expiresAt: toISODate(addDays(today, Math.max(0, draft.shelfLifeDays))),
      notes: draft.notes?.trim(),
      imageUri: draft.imageUri,
      source: draft.imageUri ? "recognized" : "manual"
    };

    const nextItems = [item, ...items];
    setItems(nextItems);
    pendingRemoteInventoryGateway.sync(nextItems).catch(() => {
      console.warn("FreshKeep remote sync placeholder failed.");
    });
    setDraft(createDraft(zones[0] ?? firstDefaultZone, foodCategories[0] ?? firstDefaultCategory));
    setModalVisible(false);
  }

  function deleteItem(id: string) {
    Alert.alert("移除食材", "确认从冰箱清单中移除吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => setItems((current) => current.filter((item) => item.id !== id))
      }
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#EAF6DF", "#F7FAF3"]} style={styles.hero}>
          <View style={styles.titleRow}>
            <View style={styles.brandBlock}>
              <Pressable style={styles.brandConfigButton} onPress={() => openSettings("zones")}>
                <Ionicons name="settings-outline" size={15} color={colors.green} />
                <Text style={styles.eyebrow}>FreshKeep</Text>
              </Pressable>
              <Text style={styles.title}>冰箱食材管家</Text>
            </View>
            <View style={styles.logoMark}>
              <MaterialCommunityIcons name="fridge-outline" size={30} color={colors.green} />
            </View>
          </View>
          <Text style={styles.subtitle}>记录位置、温度和保鲜期，优先处理临期食材。</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={openAddItemModal}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>手动放入</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={pickAndRecognize} disabled={recognizing}>
              <Ionicons name="scan" size={19} color={colors.green} />
              <Text style={styles.secondaryButtonText}>{recognizing ? "识别中" : "拍照识别"}</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatCard label="食材" value={stats.total} icon="cube-outline" tone="green" />
          <StatCard label="临期" value={stats.expiring} icon="time-outline" tone="yellow" />
          <StatCard label="过期" value={stats.expired} icon="warning-outline" tone="red" />
          <StatCard label="分区" value={stats.zoneCount} icon="grid-outline" tone="blue" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>冰箱分区</Text>
          <Text style={styles.sectionMeta}>按温度管理</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneList}>
          <ZoneChip
            active={selectedZone === "all"}
            name="全部"
            temperature={`${items.length} 件`}
            onPress={() => setSelectedZone("all")}
          />
          {zones.map((zone) => (
            <ZoneChip
              key={zone.id}
              active={selectedZone === zone.id}
              name={zone.name}
              temperature={zone.temperature}
              onPress={() => setSelectedZone(zone.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>食材清单</Text>
          <Text style={styles.sectionMeta}>{filteredItems.length} 件</Text>
        </View>
        <View style={styles.list}>
          {filteredItems.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              zones={zones}
              categories={foodCategories}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
          {!filteredItems.length && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="food-apple-outline" size={38} color={colors.muted} />
              <Text style={styles.emptyTitle}>这个分区还没有食材</Text>
              <Text style={styles.emptyText}>添加物品后，FreshKeep 会按到期时间自动排序。</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Pressable style={styles.iconButton} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
              <Text style={styles.modalTitle}>放入冰箱</Text>
              <Pressable style={styles.iconButton} onPress={saveDraft}>
                <Ionicons name="checkmark" size={23} color={colors.green} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
              {draft.imageUri && <Image source={{ uri: draft.imageUri }} style={styles.previewImage} />}
              <Field label="名称">
                <TextInput
                  value={draft.name}
                  onChangeText={(name) => updateDraft({ name })}
                  placeholder="例如：草莓、牛奶、昨晚剩菜"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="数量">
                <TextInput
                  value={draft.quantity}
                  onChangeText={(quantity) => updateDraft({ quantity })}
                  placeholder="1 盒 / 300g / 2 份"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </Field>
              <Field label="类别">
                <View style={styles.optionWrap}>
                  {foodCategories.map((category) => (
                    <Pressable
                      key={category.id}
                      style={[styles.optionPill, draft.category === category.id && styles.optionPillActive]}
                      onPress={() => selectCategory(category.id)}
                    >
                      <Text style={[styles.optionText, draft.category === category.id && styles.optionTextActive]}>
                        {category.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="位置与温度">
                <View style={styles.optionWrap}>
                  {zones.map((zone) => (
                    <Pressable
                      key={zone.id}
                      style={[styles.zoneOption, draft.zoneId === zone.id && styles.zoneOptionActive]}
                      onPress={() => selectZone(zone.id)}
                    >
                      <Text style={styles.zoneOptionName}>{zone.name}</Text>
                      <Text style={styles.zoneOptionTemp}>{zone.temperature}</Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="保鲜天数">
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => updateDraft({ shelfLifeDays: Math.max(0, draft.shelfLifeDays - 1) })}
                  >
                    <Ionicons name="remove" size={18} color={colors.ink} />
                  </Pressable>
                  <TextInput
                    value={`${draft.shelfLifeDays}`}
                    onChangeText={(value) => updateDraft({ shelfLifeDays: Number(value.replace(/\D/g, "")) || 0 })}
                    keyboardType="number-pad"
                    style={styles.stepperInput}
                  />
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => updateDraft({ shelfLifeDays: draft.shelfLifeDays + 1 })}
                  >
                    <Ionicons name="add" size={18} color={colors.ink} />
                  </Pressable>
                </View>
                <Text style={styles.helperText}>预计到期：{toISODate(addDays(new Date(), draft.shelfLifeDays))}</Text>
              </Field>
              <Field label="备注">
                <TextInput
                  value={draft.notes}
                  onChangeText={(notes) => updateDraft({ notes })}
                  placeholder="开封、分装、需要优先食用等"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.noteInput]}
                  multiline
                />
              </Field>
              <Pressable style={styles.saveButton} onPress={saveDraft}>
                <Ionicons name="snow" size={19} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>保存到冰箱</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={settingsModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Pressable style={styles.iconButton} onPress={closeSettings}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
              <Text style={styles.modalTitle}>基础配置</Text>
              <Pressable style={styles.iconButton} onPress={() => setSettingsTab(settingsTab === "zones" ? "categories" : "zones")}>
                <Ionicons name={settingsTab === "zones" ? "pricetags-outline" : "snow-outline"} size={21} color={colors.green} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.segmented}>
                <Pressable
                  style={[styles.segmentButton, settingsTab === "zones" && styles.segmentButtonActive]}
                  onPress={() => setSettingsTab("zones")}
                >
                  <Text style={[styles.segmentText, settingsTab === "zones" && styles.segmentTextActive]}>冰箱分区</Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentButton, settingsTab === "categories" && styles.segmentButtonActive]}
                  onPress={() => setSettingsTab("categories")}
                >
                  <Text style={[styles.segmentText, settingsTab === "categories" && styles.segmentTextActive]}>食材类别</Text>
                </Pressable>
              </View>

              {settingsTab === "zones" ? (
                <>
                  <Field label="分区名称">
                    <TextInput
                      value={zoneDraft.name}
                      onChangeText={(name) => setZoneDraft((current) => ({ ...current, name }))}
                      placeholder="例如：门架、变温室、零度保鲜"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                  </Field>
                  <Field label="温度范围">
                    <TextInput
                      value={zoneDraft.temperature}
                      onChangeText={(temperature) => setZoneDraft((current) => ({ ...current, temperature }))}
                      placeholder="例如：2-6°C / -18°C"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                  </Field>
                  <Field label="适合存放">
                    <TextInput
                      value={zoneDraft.hint}
                      onChangeText={(hint) => setZoneDraft((current) => ({ ...current, hint }))}
                      placeholder="这个区域通常放什么"
                      placeholderTextColor={colors.muted}
                      style={[styles.input, styles.noteInput]}
                      multiline
                    />
                  </Field>
                  <Pressable style={styles.saveButton} onPress={saveZoneDraft}>
                    <Ionicons name="save-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>保存分区</Text>
                  </Pressable>

                  <View style={styles.configList}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>当前分区</Text>
                      <Text style={styles.sectionMeta}>{zones.length} 个</Text>
                    </View>
                    {zones.map((zone) => (
                      <View key={zone.id} style={styles.configRow}>
                        <Pressable style={styles.configInfo} onPress={() => editZone(zone)}>
                          <Text style={styles.configName}>{zone.name}</Text>
                          <Text style={styles.configMeta} numberOfLines={1}>
                            {zone.temperature} · {zone.hint || "暂无说明"}
                          </Text>
                        </Pressable>
                        <Pressable style={styles.smallIconButton} onPress={() => editZone(zone)}>
                          <Ionicons name="create-outline" size={18} color={colors.blue} />
                        </Pressable>
                        <Pressable style={styles.smallIconButton} onPress={() => deleteZone(zone.id)}>
                          <Ionicons name="trash-outline" size={18} color={colors.red} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Field label="类别名称">
                    <TextInput
                      value={categoryDraft.name}
                      onChangeText={(name) => setCategoryDraft((current) => ({ ...current, name }))}
                      placeholder="例如：药品、宠物食品、儿童辅食"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                    />
                  </Field>
                  <Field label="默认保鲜天数">
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() =>
                          setCategoryDraft((current) => ({
                            ...current,
                            defaultShelfLifeDays: Math.max(0, current.defaultShelfLifeDays - 1)
                          }))
                        }
                      >
                        <Ionicons name="remove" size={18} color={colors.ink} />
                      </Pressable>
                      <TextInput
                        value={`${categoryDraft.defaultShelfLifeDays}`}
                        onChangeText={(value) =>
                          setCategoryDraft((current) => ({
                            ...current,
                            defaultShelfLifeDays: Number(value.replace(/\D/g, "")) || 0
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.stepperInput}
                      />
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() =>
                          setCategoryDraft((current) => ({
                            ...current,
                            defaultShelfLifeDays: current.defaultShelfLifeDays + 1
                          }))
                        }
                      >
                        <Ionicons name="add" size={18} color={colors.ink} />
                      </Pressable>
                    </View>
                  </Field>
                  <Pressable style={styles.saveButton} onPress={saveCategoryDraft}>
                    <Ionicons name="save-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>保存类别</Text>
                  </Pressable>

                  <View style={styles.configList}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>当前类别</Text>
                      <Text style={styles.sectionMeta}>{foodCategories.length} 个</Text>
                    </View>
                    {foodCategories.map((category) => (
                      <View key={category.id} style={styles.configRow}>
                        <Pressable style={styles.configInfo} onPress={() => editCategory(category)}>
                          <Text style={styles.configName}>{category.name}</Text>
                          <Text style={styles.configMeta}>{category.defaultShelfLifeDays} 天默认保鲜期</Text>
                        </Pressable>
                        <Pressable style={styles.smallIconButton} onPress={() => editCategory(category)}>
                          <Ionicons name="create-outline" size={18} color={colors.blue} />
                        </Pressable>
                        <Pressable style={styles.smallIconButton} onPress={() => deleteCategory(category.id)}>
                          <Ionicons name="trash-outline" size={18} color={colors.red} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "green" | "yellow" | "red" | "blue";
}) {
  const toneMap = {
    green: [colors.green, colors.greenSoft],
    yellow: [colors.yellow, colors.yellowSoft],
    red: [colors.red, colors.redSoft],
    blue: [colors.blue, colors.blueSoft]
  } as const;
  const [main, soft] = toneMap[tone];
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={main} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ZoneChip({
  active,
  name,
  temperature,
  onPress
}: {
  active: boolean;
  name: string;
  temperature: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.zoneChip, active && styles.zoneChipActive]} onPress={onPress}>
      <Text style={[styles.zoneName, active && styles.zoneNameActive]}>{name}</Text>
      <Text style={[styles.zoneTemp, active && styles.zoneTempActive]}>{temperature}</Text>
    </Pressable>
  );
}

function InventoryCard({
  item,
  zones,
  categories,
  onDelete
}: {
  item: InventoryItem;
  zones: FridgeZone[];
  categories: FoodCategoryConfig[];
  onDelete: () => void;
}) {
  const status = freshnessStatus(item.expiresAt);
  const zone = zones.find((entry) => entry.id === item.zoneId);
  const category = categories.find((entry) => entry.id === item.category);
  const statusStyle = {
    fresh: [colors.green, colors.greenSoft, "新鲜"],
    soon: [colors.yellow, colors.yellowSoft, "临期"],
    expired: [colors.red, colors.redSoft, "过期"]
  } as const;
  const [main, soft, label] = statusStyle[status];

  return (
    <View style={styles.itemCard}>
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
      ) : (
        <View style={styles.itemImageFallback}>
          <MaterialCommunityIcons name="food-variant" size={24} color={colors.green} />
        </View>
      )}
      <View style={styles.itemBody}>
        <View style={styles.itemTopRow}>
          <View style={styles.itemTitleBox}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {category?.name ?? "未分类"} · {item.quantity}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: soft }]}>
            <Text style={[styles.statusText, { color: main }]}>{label}</Text>
          </View>
        </View>
        <View style={styles.itemInfoRow}>
          <InfoDot icon="location-outline" text={`${zone?.name ?? "未分区"} ${item.temperature}`} />
          <InfoDot icon="calendar-outline" text={formatRemaining(item.expiresAt)} />
        </View>
        {!!item.notes && <Text style={styles.itemNotes} numberOfLines={2}>{item.notes}</Text>}
      </View>
      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function InfoDot({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoDot}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Text style={styles.infoText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    padding: 18,
    paddingBottom: 36,
    gap: 18
  },
  hero: {
    borderRadius: 8,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.line
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  brandBlock: {
    flex: 1,
    minWidth: 0
  },
  brandConfigButton: {
    alignSelf: "flex-start",
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "700"
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  logoMark: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  actionRow: {
    flexDirection: "row",
    gap: 12
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  secondaryButtonText: {
    color: colors.green,
    fontWeight: "800",
    fontSize: 15
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statCard: {
    width: "48.5%",
    minHeight: 98,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  statValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800"
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13
  },
  zoneList: {
    gap: 10,
    paddingRight: 4
  },
  zoneChip: {
    width: 104,
    minHeight: 68,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    justifyContent: "space-between"
  },
  zoneChipActive: {
    backgroundColor: colors.green,
    borderColor: colors.green
  },
  zoneName: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14
  },
  zoneNameActive: {
    color: "#FFFFFF"
  },
  zoneTemp: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6
  },
  zoneTempActive: {
    color: "#E8F7EC"
  },
  list: {
    gap: 12
  },
  itemCard: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  itemImage: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.graySoft
  },
  itemImageFallback: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  itemBody: {
    flex: 1,
    gap: 7,
    minWidth: 0
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  itemTitleBox: {
    flex: 1,
    minWidth: 0
  },
  itemName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800"
  },
  itemInfoRow: {
    gap: 5
  },
  infoDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  infoText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12
  },
  itemNotes: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.graySoft
  },
  emptyState: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: "center",
    gap: 8
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  modalSafe: {
    flex: 1
  },
  modalHeader: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  form: {
    padding: 18,
    gap: 18,
    paddingBottom: 36
  },
  previewImage: {
    width: "100%",
    height: 190,
    borderRadius: 8,
    backgroundColor: colors.graySoft
  },
  field: {
    gap: 8
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    color: colors.ink,
    fontSize: 15
  },
  compactInput: {
    marginTop: 8
  },
  noteInput: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  segmented: {
    minHeight: 46,
    borderRadius: 8,
    padding: 4,
    backgroundColor: colors.graySoft,
    flexDirection: "row",
    gap: 4
  },
  segmentButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line
  },
  segmentText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: colors.green
  },
  optionPill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  optionPillActive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green
  },
  optionText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  optionTextActive: {
    color: colors.green
  },
  zoneOption: {
    width: "31.7%",
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 10,
    justifyContent: "space-between"
  },
  zoneOptionActive: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue
  },
  zoneOptionName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  zoneOptionTemp: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  stepperButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  stepperInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    textAlign: "center",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  helperText: {
    color: colors.muted,
    fontSize: 12
  },
  saveButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  configList: {
    gap: 10,
    marginTop: 4
  },
  configRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  configInfo: {
    flex: 1,
    minWidth: 0
  },
  configName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  configMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4
  },
  smallIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.graySoft
  }
});
