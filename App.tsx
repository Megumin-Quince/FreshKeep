import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getLocales } from "expo-localization";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  StyleProp,
  Text,
  TextInput,
  useColorScheme,
  View,
  ViewStyle
} from "react-native";
import {
  builtInCategoryNames,
  builtInZoneHints,
  builtInZoneNames,
  createDefaultFoodCategories,
  createDefaultFridgeZones,
  defaultFoodCategories,
  defaultFridgeZones,
  legacyCategoryMap,
  legacyZoneMap
} from "./src/data/fridge";
import { addDays, daysUntil, freshnessStatus, toISODate } from "./src/services/dateUtils";
import {
  localAppSettingsRepository,
  localCategoryRepository,
  localInventoryRepository,
  localZoneRepository,
  pendingRemoteInventoryGateway
} from "./src/services/localRepository";
import { mockRecognitionService } from "./src/services/recognitionService";
import { AppTheme, createTheme, ResolvedThemeMode } from "./src/theme/colors";
import {
  AppSettings,
  defaultAppSettings,
  interpolate,
  LanguageCode,
  LanguageMode,
  languageFromLocale,
  resolveLanguage,
  ThemeMode,
  TranslationKey,
  translations
} from "./src/i18n/translations";
import {
  FoodCategory,
  FoodCategoryConfig,
  FoodCategoryDraft,
  FreshnessStatus,
  FridgeZone,
  FridgeZoneDraft,
  FridgeZoneId,
  InventoryItem,
  ItemDraft
} from "./src/types/inventory";

type SettingsTab = "zones" | "categories" | "preferences";
type AppStyles = ReturnType<typeof createStyles>;
type TFunc = (key: TranslationKey, values?: Record<string, string | number>) => string;

const firstDefaultZone = defaultFridgeZones[0];
const firstDefaultCategory = defaultFoodCategories[0];
const initialZoneDraft: FridgeZoneDraft = { name: "", temperature: "", hint: "" };
const initialCategoryDraft: FoodCategoryDraft = { name: "", defaultShelfLifeDays: 5 };

const seedDisplayKeys: Record<string, { name: TranslationKey; quantity: TranslationKey; notes: TranslationKey }> = {
  "seed-milk": { name: "seedMilkName", quantity: "seedMilkQuantity", notes: "seedMilkNotes" },
  "seed-spinach": { name: "seedSpinachName", quantity: "seedSpinachQuantity", notes: "seedSpinachNotes" },
  "seed-beef": { name: "seedBeefName", quantity: "seedBeefQuantity", notes: "seedBeefNotes" }
};

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

function createSeedItems(language: LanguageCode): InventoryItem[] {
  const t = translations[language];
  return [
    {
      id: "seed-milk",
      name: t.seedMilkName,
      category: "dairy",
      quantity: t.seedMilkQuantity,
      zoneId: "chill",
      temperature: "2-6°C",
      storedAt: toISODate(addDays(new Date(), -2)),
      expiresAt: toISODate(addDays(new Date(), 4)),
      notes: t.seedMilkNotes,
      source: "manual"
    },
    {
      id: "seed-spinach",
      name: t.seedSpinachName,
      category: "vegetable",
      quantity: t.seedSpinachQuantity,
      zoneId: "crisper",
      temperature: "0-4°C",
      storedAt: toISODate(addDays(new Date(), -3)),
      expiresAt: toISODate(addDays(new Date(), 1)),
      notes: t.seedSpinachNotes,
      source: "manual"
    },
    {
      id: "seed-beef",
      name: t.seedBeefName,
      category: "meat",
      quantity: t.seedBeefQuantity,
      zoneId: "freezer",
      temperature: "-18°C",
      storedAt: toISODate(addDays(new Date(), -10)),
      expiresAt: toISODate(addDays(new Date(), 40)),
      notes: t.seedBeefNotes,
      source: "manual"
    }
  ];
}

function isBuiltInText(value: string | undefined, candidates?: string[]) {
  return !!value && !!candidates?.includes(value);
}

function resolveThemeMode(themeMode: ThemeMode, systemMode: ResolvedThemeMode): ResolvedThemeMode {
  return themeMode === "system" ? systemMode : themeMode;
}

export default function App() {
  const deviceLanguage = useMemo(() => languageFromLocale(getLocales()[0]?.languageCode), []);
  const systemTheme = useColorScheme() === "dark" ? "dark" : "light";

  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const language = resolveLanguage(settings.languageMode, deviceLanguage);
  const themeMode = resolveThemeMode(settings.themeMode, systemTheme);
  const theme = useMemo(() => createTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const t = useCallback<TFunc>(
    (key, values) => {
      const template = translations[language][key] ?? translations.en[key] ?? key;
      return values ? interpolate(template, values) : template;
    },
    [language]
  );

  const localizedDefaultZones = useMemo(() => createDefaultFridgeZones(language), [language]);
  const localizedDefaultCategories = useMemo(() => createDefaultFoodCategories(language), [language]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [zones, setZones] = useState<FridgeZone[]>(defaultFridgeZones);
  const [foodCategories, setFoodCategories] = useState<FoodCategoryConfig[]>(defaultFoodCategories);
  const [selectedZone, setSelectedZone] = useState<FridgeZoneId | "all">("all");
  const [draft, setDraft] = useState<ItemDraft>(createDraft(defaultFridgeZones[0]));
  const [zoneDraft, setZoneDraft] = useState<FridgeZoneDraft>(initialZoneDraft);
  const [categoryDraft, setCategoryDraft] = useState<FoodCategoryDraft>(initialCategoryDraft);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("zones");
  const [loading, setLoading] = useState(true);
  const [recognizing, setRecognizing] = useState(false);

  const displayZoneName = useCallback(
    (zone?: FridgeZone) => {
      if (!zone) {
        return t("unassigned");
      }
      const localized = localizedDefaultZones.find((entry) => entry.id === zone.id);
      return localized && isBuiltInText(zone.name, builtInZoneNames[zone.id]) ? localized.name : zone.name;
    },
    [localizedDefaultZones, t]
  );

  const displayZoneHint = useCallback(
    (zone: FridgeZone) => {
      const localized = localizedDefaultZones.find((entry) => entry.id === zone.id);
      return localized && isBuiltInText(zone.hint, builtInZoneHints[zone.id]) ? localized.hint : zone.hint;
    },
    [localizedDefaultZones]
  );

  const displayCategoryName = useCallback(
    (category?: FoodCategoryConfig) => {
      if (!category) {
        return t("uncategorized");
      }
      const localized = localizedDefaultCategories.find((entry) => entry.id === category.id);
      return localized && isBuiltInText(category.name, builtInCategoryNames[category.id]) ? localized.name : category.name;
    },
    [localizedDefaultCategories, t]
  );

  const getItemName = useCallback(
    (item: InventoryItem) => {
      const keys = seedDisplayKeys[item.id];
      return keys ? t(keys.name) : item.name;
    },
    [t]
  );

  const getItemQuantity = useCallback(
    (item: InventoryItem) => {
      const keys = seedDisplayKeys[item.id];
      return keys ? t(keys.quantity) : item.quantity;
    },
    [t]
  );

  const getItemNotes = useCallback(
    (item: InventoryItem) => {
      const keys = seedDisplayKeys[item.id];
      return keys ? t(keys.notes) : item.notes;
    },
    [t]
  );

  const remainingText = useCallback(
    (expiresAt: string) => {
      const remaining = daysUntil(expiresAt);
      if (remaining < 0) {
        return t("expiredDays", { days: Math.abs(remaining) });
      }
      if (remaining === 0) {
        return t("expiresToday");
      }
      if (remaining === 1) {
        return t("expiresTomorrow");
      }
      return t("expiresInDays", { days: remaining });
    },
    [t]
  );

  useEffect(() => {
    Promise.all([
      localAppSettingsRepository.get(),
      localInventoryRepository.list(),
      localZoneRepository.list(),
      localCategoryRepository.list()
    ])
      .then(([storedSettings, storedItems, storedZones, storedCategories]) => {
        const resolvedLanguage = resolveLanguage(storedSettings.languageMode, deviceLanguage);
        const defaultZonesForLanguage = createDefaultFridgeZones(resolvedLanguage);
        const defaultCategoriesForLanguage = createDefaultFoodCategories(resolvedLanguage);
        const activeZones = storedZones.length ? storedZones : defaultZonesForLanguage;
        const activeCategories = storedCategories.length ? storedCategories : defaultCategoriesForLanguage;
        const activeZoneIds = new Set(activeZones.map((zone) => zone.id));
        const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
        const migratedItems = (storedItems.length ? storedItems : createSeedItems(resolvedLanguage)).map((item) => {
          const nextZoneId = legacyZoneMap[item.zoneId] ?? item.zoneId;
          const nextCategoryId = legacyCategoryMap[item.category] ?? item.category;
          const zone = activeZoneIds.has(nextZoneId)
            ? activeZones.find((entry) => entry.id === nextZoneId) ?? activeZones[0]
            : activeZones[0];
          const category = activeCategoryIds.has(nextCategoryId) ? nextCategoryId : activeCategories[0].id;
          return { ...item, zoneId: zone.id, temperature: zone.temperature, category };
        });

        setSettings(storedSettings);
        setZones(activeZones);
        setFoodCategories(activeCategories);
        setItems(migratedItems);
        setDraft(createDraft(activeZones[0], activeCategories[0]));
      })
      .catch(() => {
        const fallbackText = translations[deviceLanguage];
        const fallbackZones = createDefaultFridgeZones(deviceLanguage);
        const fallbackCategories = createDefaultFoodCategories(deviceLanguage);
        setZones(fallbackZones);
        setFoodCategories(fallbackCategories);
        setItems(createSeedItems(deviceLanguage));
        setDraft(createDraft(fallbackZones[0], fallbackCategories[0]));
        Alert.alert(fallbackText.readFailedTitle, fallbackText.readFailedMessage);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [deviceLanguage]);

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

  useEffect(() => {
    if (!loading) {
      localAppSettingsRepository.save(settings).catch(() => {
        console.warn("FreshKeep failed to persist app settings.");
      });
    }
  }, [settings, loading]);

  const stats = useMemo(() => {
    const expiring = items.filter((item) => freshnessStatus(item.expiresAt) === "soon").length;
    const expired = items.filter((item) => freshnessStatus(item.expiresAt) === "expired").length;
    return { total: items.length, expiring, expired, zoneCount: zones.length };
  }, [items, zones.length]);

  const filteredItems = useMemo(() => {
    const list = selectedZone === "all" ? items : items.filter((item) => item.zoneId === selectedZone);
    return [...list].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }, [items, selectedZone]);

  function updateDraft(next: Partial<ItemDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function updateLanguageMode(languageMode: LanguageMode) {
    setSettings((current) => ({ ...current, languageMode }));
  }

  function updateThemeMode(nextThemeMode: ThemeMode) {
    setSettings((current) => ({ ...current, themeMode: nextThemeMode }));
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
    setZoneDraft({ ...zone, name: displayZoneName(zone), hint: displayZoneHint(zone) });
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
      Alert.alert(t("missingZoneTitle"), t("missingZoneMessage"));
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

  function openSettings(tab: SettingsTab = "zones") {
    resetSettingsDrafts();
    setSettingsTab(tab);
    setSettingsModalVisible(true);
  }

  function closeSettings() {
    resetSettingsDrafts();
    setSettingsModalVisible(false);
  }

  function editCategory(category: FoodCategoryConfig) {
    setCategoryDraft({ ...category, name: displayCategoryName(category) });
    setSettingsTab("categories");
    setSettingsModalVisible(true);
  }

  function saveCategoryDraft() {
    const name = categoryDraft.name.trim();
    if (!name) {
      Alert.alert(t("missingCategoryTitle"), t("missingCategoryMessage"));
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
      Alert.alert(t("keepOneCategoryTitle"), t("keepOneCategoryMessage"));
      return;
    }

    const category = foodCategories.find((entry) => entry.id === categoryId);
    const fallback = foodCategories.find((entry) => entry.id !== categoryId) ?? firstDefaultCategory;
    Alert.alert(
      t("deleteCategoryTitle"),
      t("deleteCategoryMessage", {
        name: displayCategoryName(category),
        fallback: displayCategoryName(fallback)
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () => {
            setFoodCategories((current) => current.filter((entry) => entry.id !== categoryId));
            setItems((current) =>
              current.map((item) => (item.category === categoryId ? { ...item, category: fallback.id } : item))
            );
            if (draft.category === categoryId) {
              setDraft((current) => ({
                ...current,
                category: fallback.id,
                shelfLifeDays: fallback.defaultShelfLifeDays
              }));
            }
          }
        }
      ]
    );
  }

  function deleteZone(zoneId: FridgeZoneId) {
    if (zones.length <= 1) {
      Alert.alert(t("keepOneZoneTitle"), t("keepOneZoneMessage"));
      return;
    }

    const zone = zones.find((entry) => entry.id === zoneId);
    const fallback = zones.find((entry) => entry.id !== zoneId) ?? firstDefaultZone;
    Alert.alert(
      t("deleteZoneTitle"),
      t("deleteZoneMessage", { name: displayZoneName(zone), fallback: displayZoneName(fallback) }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
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
      ]
    );
  }

  async function pickAndRecognize() {
    setRecognizing(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("needPhotoPermissionTitle"), t("needPhotoPermissionMessage"));
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
        fileName: asset.fileName ?? undefined,
        language
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
        notes: `${recognition.notes}, ${t("confidence", { value: Math.round(recognition.confidence * 100) })}`,
        imageUri: asset.uri
      });
      setModalVisible(true);
    } catch {
      Alert.alert(t("recognitionFailedTitle"), t("recognitionFailedMessage"));
    } finally {
      setRecognizing(false);
    }
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      Alert.alert(t("missingNameTitle"), t("missingNameMessage"));
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
    Alert.alert(t("removeItemTitle"), t("removeItemMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: () => setItems((current) => current.filter((item) => item.id !== id))
      }
    ]);
  }

  return (
    <View style={styles.root}>
      <LiquidBackground styles={styles} theme={theme} />
      <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <GlassSurface styles={styles} theme={theme} style={styles.hero} intensity={58}>
          <LinearGradient
            pointerEvents="none"
            colors={
              theme.isDark
                ? ["rgba(117, 209, 151, 0.2)", "rgba(96, 208, 204, 0.08)", "rgba(255, 255, 255, 0.02)"]
                : ["rgba(255, 255, 255, 0.72)", "rgba(221, 239, 227, 0.42)", "rgba(255, 255, 255, 0.12)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlow}
          />
          <View style={styles.titleRow}>
            <View style={styles.brandBlock}>
              <Pressable style={styles.brandConfigButton} onPress={() => openSettings("preferences")}>
                <Ionicons name="settings-outline" size={15} color={theme.green} />
                <Text style={styles.eyebrow}>{t("appName")}</Text>
              </Pressable>
              <Text style={styles.title}>{t("appTitle")}</Text>
            </View>
            <GlassSurface styles={styles} theme={theme} style={styles.logoMark}>
              <MaterialCommunityIcons name="fridge-outline" size={30} color={theme.green} />
            </GlassSurface>
          </View>
          <Text style={styles.subtitle}>{t("heroSubtitle")}</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={openAddItemModal}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{t("manualAdd")}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={pickAndRecognize} disabled={recognizing}>
              <Ionicons name="scan" size={19} color={theme.green} />
              <Text style={styles.secondaryButtonText}>{recognizing ? t("recognizing") : t("recognize")}</Text>
            </Pressable>
          </View>
        </GlassSurface>

        <View style={styles.statsGrid}>
          <StatCard label={t("statItems")} value={stats.total} icon="cube-outline" tone="green" theme={theme} styles={styles} />
          <StatCard label={t("statSoon")} value={stats.expiring} icon="time-outline" tone="yellow" theme={theme} styles={styles} />
          <StatCard label={t("statExpired")} value={stats.expired} icon="warning-outline" tone="red" theme={theme} styles={styles} />
          <StatCard label={t("statZones")} value={stats.zoneCount} icon="grid-outline" tone="blue" theme={theme} styles={styles} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("zonesSection")}</Text>
          <Text style={styles.sectionMeta}>{t("temperatureManaged")}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneList}>
          <ZoneChip
            active={selectedZone === "all"}
            name={t("all")}
            temperature={`${items.length} ${t("pieces")}`}
            onPress={() => setSelectedZone("all")}
            theme={theme}
            styles={styles}
          />
          {zones.map((zone) => (
            <ZoneChip
              key={zone.id}
              active={selectedZone === zone.id}
              name={displayZoneName(zone)}
              temperature={zone.temperature}
              onPress={() => setSelectedZone(zone.id)}
              theme={theme}
              styles={styles}
            />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("itemList")}</Text>
          <Text style={styles.sectionMeta}>
            {filteredItems.length} {t("pieces")}
          </Text>
        </View>
        <View style={styles.list}>
          {filteredItems.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              zones={zones}
              categories={foodCategories}
              onDelete={() => deleteItem(item.id)}
              theme={theme}
              styles={styles}
              t={t}
              statusLabel={(status) => t(status)}
              displayCategoryName={displayCategoryName}
              displayZoneName={displayZoneName}
              itemName={getItemName(item)}
              itemQuantity={getItemQuantity(item)}
              itemNotes={getItemNotes(item)}
              remainingText={remainingText(item.expiresAt)}
            />
          ))}
          {!filteredItems.length && (
            <GlassSurface styles={styles} theme={theme} style={styles.emptyState}>
              <MaterialCommunityIcons name="food-apple-outline" size={38} color={theme.muted} />
              <Text style={styles.emptyTitle}>{t("emptyZoneTitle")}</Text>
              <Text style={styles.emptyText}>{t("emptyZoneText")}</Text>
            </GlassSurface>
          )}
        </View>
      </ScrollView>

      <ItemModal
        visible={modalVisible}
        close={() => setModalVisible(false)}
        save={saveDraft}
        draft={draft}
        updateDraft={updateDraft}
        selectCategory={selectCategory}
        selectZone={selectZone}
        categories={foodCategories}
        zones={zones}
        displayCategoryName={displayCategoryName}
        displayZoneName={displayZoneName}
        theme={theme}
        styles={styles}
        t={t}
      />

      <SettingsModal
        visible={settingsModalVisible}
        close={closeSettings}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        settings={settings}
        updateLanguageMode={updateLanguageMode}
        updateThemeMode={updateThemeMode}
        zoneDraft={zoneDraft}
        setZoneDraft={setZoneDraft}
        saveZoneDraft={saveZoneDraft}
        zones={zones}
        editZone={editZone}
        deleteZone={deleteZone}
        displayZoneName={displayZoneName}
        displayZoneHint={displayZoneHint}
        categoryDraft={categoryDraft}
        setCategoryDraft={setCategoryDraft}
        saveCategoryDraft={saveCategoryDraft}
        foodCategories={foodCategories}
        editCategory={editCategory}
        deleteCategory={deleteCategory}
        displayCategoryName={displayCategoryName}
        theme={theme}
        styles={styles}
        t={t}
      />
      </SafeAreaView>
    </View>
  );
}

function LiquidBackground({ styles, theme }: { styles: AppStyles; theme: AppTheme }) {
  return (
    <View pointerEvents="none" style={styles.liquidBackdrop}>
      <LinearGradient
        colors={
          theme.isDark
            ? ["#07110D", "#0D1A14", "#10261D", "#07110D"]
            : ["#F6FAF3", "#EAF6DF", "#DDEBFA", "#F7FAF3"]
        }
        style={styles.liquidBase}
      />
      <LinearGradient
        colors={
          theme.isDark
            ? ["rgba(117, 209, 151, 0)", "rgba(117, 209, 151, 0.24)", "rgba(96, 208, 204, 0.08)"]
            : ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.74)", "rgba(59, 143, 91, 0.12)"]
        }
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.liquidRibbonTop}
      />
      <LinearGradient
        colors={
          theme.isDark
            ? ["rgba(131, 183, 235, 0.04)", "rgba(96, 208, 204, 0.18)", "rgba(117, 209, 151, 0.02)"]
            : ["rgba(77, 130, 184, 0.08)", "rgba(255, 255, 255, 0.5)", "rgba(117, 209, 151, 0.16)"]
        }
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.liquidRibbonMid}
      />
      <LinearGradient
        colors={
          theme.isDark
            ? ["rgba(255, 255, 255, 0.02)", "rgba(246, 199, 98, 0.1)", "rgba(0, 0, 0, 0)"]
            : ["rgba(255, 255, 255, 0.1)", "rgba(246, 199, 98, 0.18)", "rgba(255, 255, 255, 0)"]
        }
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.liquidRibbonLow}
      />
    </View>
  );
}

function GlassSurface({
  children,
  styles,
  theme,
  style,
  intensity = 32
}: {
  children: React.ReactNode;
  styles: AppStyles;
  theme: AppTheme;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}) {
  const surfaceStyle = [styles.glassSurface, style];
  const content = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[theme.glassHighlight, theme.glassLowlight, "rgba(255, 255, 255, 0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassDepth}
      />
      {children}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255, 255, 255, 0.58)", "rgba(255, 255, 255, 0.06)", "rgba(255, 255, 255, 0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={styles.glassSpecular}
      />
      <View pointerEvents="none" style={styles.glassRim} />
    </>
  );
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint={theme.isDark ? "dark" : "light"} style={surfaceStyle}>
        {content}
      </BlurView>
    );
  }
  return <View style={surfaceStyle}>{content}</View>;
}

function StatCard({
  label,
  value,
  icon,
  tone,
  theme,
  styles
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "green" | "yellow" | "red" | "blue";
  theme: AppTheme;
  styles: AppStyles;
}) {
  const toneMap = {
    green: [theme.green, theme.greenSoft],
    yellow: [theme.yellow, theme.yellowSoft],
    red: [theme.red, theme.redSoft],
    blue: [theme.blue, theme.blueSoft]
  } as const;
  const [main, soft] = toneMap[tone];
  return (
    <GlassSurface styles={styles} theme={theme} style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={main} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </GlassSurface>
  );
}

function ZoneChip({
  active,
  name,
  temperature,
  onPress,
  theme,
  styles
}: {
  active: boolean;
  name: string;
  temperature: string;
  onPress: () => void;
  theme: AppTheme;
  styles: AppStyles;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassSurface styles={styles} theme={theme} style={[styles.zoneChip, active && styles.zoneChipActive]}>
        <Text style={[styles.zoneName, active && styles.zoneNameActive]}>{name}</Text>
        <Text style={[styles.zoneTemp, active && styles.zoneTempActive]}>{temperature}</Text>
      </GlassSurface>
    </Pressable>
  );
}

function InventoryCard({
  item,
  zones,
  categories,
  onDelete,
  theme,
  styles,
  statusLabel,
  displayCategoryName,
  displayZoneName,
  itemName,
  itemQuantity,
  itemNotes,
  remainingText
}: {
  item: InventoryItem;
  zones: FridgeZone[];
  categories: FoodCategoryConfig[];
  onDelete: () => void;
  theme: AppTheme;
  styles: AppStyles;
  t: TFunc;
  statusLabel: (status: FreshnessStatus) => string;
  displayCategoryName: (category?: FoodCategoryConfig) => string;
  displayZoneName: (zone?: FridgeZone) => string;
  itemName: string;
  itemQuantity: string;
  itemNotes?: string;
  remainingText: string;
}) {
  const status = freshnessStatus(item.expiresAt);
  const zone = zones.find((entry) => entry.id === item.zoneId);
  const category = categories.find((entry) => entry.id === item.category);
  const statusStyle = {
    fresh: [theme.green, theme.greenSoft],
    soon: [theme.yellow, theme.yellowSoft],
    expired: [theme.red, theme.redSoft]
  } as const;
  const [main, soft] = statusStyle[status];

  return (
    <GlassSurface styles={styles} theme={theme} style={styles.itemCard}>
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
      ) : (
        <View style={styles.itemImageFallback}>
          <MaterialCommunityIcons name="food-variant" size={24} color={theme.green} />
        </View>
      )}
      <View style={styles.itemBody}>
        <View style={styles.itemTopRow}>
          <View style={styles.itemTitleBox}>
            <Text style={styles.itemName} numberOfLines={1}>
              {itemName}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {displayCategoryName(category)} · {itemQuantity}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: soft }]}>
            <Text style={[styles.statusText, { color: main }]}>{statusLabel(status)}</Text>
          </View>
        </View>
        <View style={styles.itemInfoRow}>
          <InfoDot icon="location-outline" text={`${displayZoneName(zone)} ${item.temperature}`} theme={theme} styles={styles} />
          <InfoDot icon="calendar-outline" text={remainingText} theme={theme} styles={styles} />
        </View>
        {!!itemNotes && <Text style={styles.itemNotes} numberOfLines={2}>{itemNotes}</Text>}
      </View>
      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color={theme.muted} />
      </Pressable>
    </GlassSurface>
  );
}

function InfoDot({
  icon,
  text,
  theme,
  styles
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  theme: AppTheme;
  styles: AppStyles;
}) {
  return (
    <View style={styles.infoDot}>
      <Ionicons name={icon} size={14} color={theme.muted} />
      <Text style={styles.infoText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: AppStyles }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ItemModal({
  visible,
  close,
  save,
  draft,
  updateDraft,
  selectCategory,
  selectZone,
  categories,
  zones,
  displayCategoryName,
  displayZoneName,
  theme,
  styles,
  t
}: {
  visible: boolean;
  close: () => void;
  save: () => void;
  draft: ItemDraft;
  updateDraft: (next: Partial<ItemDraft>) => void;
  selectCategory: (category: FoodCategory) => void;
  selectZone: (zoneId: FridgeZoneId) => void;
  categories: FoodCategoryConfig[];
  zones: FridgeZone[];
  displayCategoryName: (category?: FoodCategoryConfig) => string;
  displayZoneName: (zone?: FridgeZone) => string;
  theme: AppTheme;
  styles: AppStyles;
  t: TFunc;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.iconButton} onPress={close}>
              <Ionicons name="close" size={22} color={theme.ink} />
            </Pressable>
            <Text style={styles.modalTitle}>{t("addItemTitle")}</Text>
            <Pressable style={styles.iconButton} onPress={save}>
              <Ionicons name="checkmark" size={23} color={theme.green} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            {draft.imageUri && <Image source={{ uri: draft.imageUri }} style={styles.previewImage} />}
            <Field label={t("name")} styles={styles}>
              <TextInput
                value={draft.name}
                onChangeText={(name) => updateDraft({ name })}
                placeholder={t("namePlaceholder")}
                placeholderTextColor={theme.muted}
                style={styles.input}
              />
            </Field>
            <Field label={t("quantity")} styles={styles}>
              <TextInput
                value={draft.quantity}
                onChangeText={(quantity) => updateDraft({ quantity })}
                placeholder={t("quantityPlaceholder")}
                placeholderTextColor={theme.muted}
                style={styles.input}
              />
            </Field>
            <Field label={t("category")} styles={styles}>
              <View style={styles.optionWrap}>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[styles.optionPill, draft.category === category.id && styles.optionPillActive]}
                    onPress={() => selectCategory(category.id)}
                  >
                    <Text style={[styles.optionText, draft.category === category.id && styles.optionTextActive]}>
                      {displayCategoryName(category)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label={t("locationAndTemperature")} styles={styles}>
              <View style={styles.optionWrap}>
                {zones.map((zone) => (
                  <Pressable
                    key={zone.id}
                    style={[styles.zoneOption, draft.zoneId === zone.id && styles.zoneOptionActive]}
                    onPress={() => selectZone(zone.id)}
                  >
                    <Text style={styles.zoneOptionName}>{displayZoneName(zone)}</Text>
                    <Text style={styles.zoneOptionTemp}>{zone.temperature}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label={t("freshnessDays")} styles={styles}>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => updateDraft({ shelfLifeDays: Math.max(0, draft.shelfLifeDays - 1) })}
                >
                  <Ionicons name="remove" size={18} color={theme.ink} />
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
                  <Ionicons name="add" size={18} color={theme.ink} />
                </Pressable>
              </View>
              <Text style={styles.helperText}>{t("expectedExpiry")}{toISODate(addDays(new Date(), draft.shelfLifeDays))}</Text>
            </Field>
            <Field label={t("notes")} styles={styles}>
              <TextInput
                value={draft.notes}
                onChangeText={(notes) => updateDraft({ notes })}
                placeholder={t("notesPlaceholder")}
                placeholderTextColor={theme.muted}
                style={[styles.input, styles.noteInput]}
                multiline
              />
            </Field>
            <Pressable style={styles.saveButton} onPress={save}>
              <Ionicons name="snow" size={19} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>{t("saveItem")}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SettingsModal({
  visible,
  close,
  settingsTab,
  setSettingsTab,
  settings,
  updateLanguageMode,
  updateThemeMode,
  zoneDraft,
  setZoneDraft,
  saveZoneDraft,
  zones,
  editZone,
  deleteZone,
  displayZoneName,
  displayZoneHint,
  categoryDraft,
  setCategoryDraft,
  saveCategoryDraft,
  foodCategories,
  editCategory,
  deleteCategory,
  displayCategoryName,
  theme,
  styles,
  t
}: {
  visible: boolean;
  close: () => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  settings: AppSettings;
  updateLanguageMode: (mode: LanguageMode) => void;
  updateThemeMode: (mode: ThemeMode) => void;
  zoneDraft: FridgeZoneDraft;
  setZoneDraft: React.Dispatch<React.SetStateAction<FridgeZoneDraft>>;
  saveZoneDraft: () => void;
  zones: FridgeZone[];
  editZone: (zone: FridgeZone) => void;
  deleteZone: (zoneId: FridgeZoneId) => void;
  displayZoneName: (zone?: FridgeZone) => string;
  displayZoneHint: (zone: FridgeZone) => string;
  categoryDraft: FoodCategoryDraft;
  setCategoryDraft: React.Dispatch<React.SetStateAction<FoodCategoryDraft>>;
  saveCategoryDraft: () => void;
  foodCategories: FoodCategoryConfig[];
  editCategory: (category: FoodCategoryConfig) => void;
  deleteCategory: (categoryId: FoodCategory) => void;
  displayCategoryName: (category?: FoodCategoryConfig) => string;
  theme: AppTheme;
  styles: AppStyles;
  t: TFunc;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.iconButton} onPress={close}>
              <Ionicons name="close" size={22} color={theme.ink} />
            </Pressable>
            <Text style={styles.modalTitle}>{t("settingsTitle")}</Text>
            <View style={styles.iconButton}>
              <Ionicons name="sparkles-outline" size={21} color={theme.green} />
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            <View style={styles.segmented}>
              <SegmentButton active={settingsTab === "zones"} label={t("tabZones")} onPress={() => setSettingsTab("zones")} styles={styles} />
              <SegmentButton active={settingsTab === "categories"} label={t("tabCategories")} onPress={() => setSettingsTab("categories")} styles={styles} />
              <SegmentButton active={settingsTab === "preferences"} label={t("tabPreferences")} onPress={() => setSettingsTab("preferences")} styles={styles} />
            </View>

            {settingsTab === "zones" && (
              <>
                <Field label={t("zoneName")} styles={styles}>
                  <TextInput
                    value={zoneDraft.name}
                    onChangeText={(name) => setZoneDraft((current) => ({ ...current, name }))}
                    placeholder={t("zoneNamePlaceholder")}
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                  />
                </Field>
                <Field label={t("temperatureRange")} styles={styles}>
                  <TextInput
                    value={zoneDraft.temperature}
                    onChangeText={(temperature) => setZoneDraft((current) => ({ ...current, temperature }))}
                    placeholder={t("temperaturePlaceholder")}
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                  />
                </Field>
                <Field label={t("zoneHint")} styles={styles}>
                  <TextInput
                    value={zoneDraft.hint}
                    onChangeText={(hint) => setZoneDraft((current) => ({ ...current, hint }))}
                    placeholder={t("zoneHintPlaceholder")}
                    placeholderTextColor={theme.muted}
                    style={[styles.input, styles.noteInput]}
                    multiline
                  />
                </Field>
                <Pressable style={styles.saveButton} onPress={saveZoneDraft}>
                  <Ionicons name="save-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{t("saveZone")}</Text>
                </Pressable>
                <ConfigListHeader title={t("currentZones")} count={`${zones.length}`} styles={styles} />
                {zones.map((zone) => (
                  <ConfigRow
                    key={zone.id}
                    title={displayZoneName(zone)}
                    meta={`${zone.temperature} · ${displayZoneHint(zone) || t("noDescription")}`}
                    edit={() => editZone(zone)}
                    remove={() => deleteZone(zone.id)}
                    theme={theme}
                    styles={styles}
                  />
                ))}
              </>
            )}

            {settingsTab === "categories" && (
              <>
                <Field label={t("categoryName")} styles={styles}>
                  <TextInput
                    value={categoryDraft.name}
                    onChangeText={(name) => setCategoryDraft((current) => ({ ...current, name }))}
                    placeholder={t("categoryNamePlaceholder")}
                    placeholderTextColor={theme.muted}
                    style={styles.input}
                  />
                </Field>
                <Field label={t("defaultFreshnessDays")} styles={styles}>
                  <Stepper
                    value={categoryDraft.defaultShelfLifeDays}
                    setValue={(value) => setCategoryDraft((current) => ({ ...current, defaultShelfLifeDays: value }))}
                    theme={theme}
                    styles={styles}
                  />
                </Field>
                <Pressable style={styles.saveButton} onPress={saveCategoryDraft}>
                  <Ionicons name="save-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{t("saveCategory")}</Text>
                </Pressable>
                <ConfigListHeader title={t("currentCategories")} count={`${foodCategories.length}`} styles={styles} />
                {foodCategories.map((category) => (
                  <ConfigRow
                    key={category.id}
                    title={displayCategoryName(category)}
                    meta={t("defaultFreshnessPeriod", { days: category.defaultShelfLifeDays })}
                    edit={() => editCategory(category)}
                    remove={() => deleteCategory(category.id)}
                    theme={theme}
                    styles={styles}
                  />
                ))}
              </>
            )}

            {settingsTab === "preferences" && (
              <>
                <Field label={t("language")} styles={styles}>
                  <View style={styles.optionWrap}>
                    <ModeOption active={settings.languageMode === "system"} label={t("followSystem")} icon="phone-portrait-outline" onPress={() => updateLanguageMode("system")} theme={theme} styles={styles} />
                    <ModeOption active={settings.languageMode === "en"} label={t("english")} icon="language-outline" onPress={() => updateLanguageMode("en")} theme={theme} styles={styles} />
                    <ModeOption active={settings.languageMode === "zh"} label={t("chinese")} icon="language-outline" onPress={() => updateLanguageMode("zh")} theme={theme} styles={styles} />
                  </View>
                </Field>
                <Field label={t("appearance")} styles={styles}>
                  <View style={styles.optionWrap}>
                    <ModeOption active={settings.themeMode === "system"} label={t("followSystem")} icon="contrast-outline" onPress={() => updateThemeMode("system")} theme={theme} styles={styles} />
                    <ModeOption active={settings.themeMode === "light"} label={t("light")} icon="sunny-outline" onPress={() => updateThemeMode("light")} theme={theme} styles={styles} />
                    <ModeOption active={settings.themeMode === "dark"} label={t("dark")} icon="moon-outline" onPress={() => updateThemeMode("dark")} theme={theme} styles={styles} />
                  </View>
                </Field>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SegmentButton({ active, label, onPress, styles }: { active: boolean; label: string; onPress: () => void; styles: AppStyles }) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  value,
  setValue,
  theme,
  styles
}: {
  value: number;
  setValue: (value: number) => void;
  theme: AppTheme;
  styles: AppStyles;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepperButton} onPress={() => setValue(Math.max(0, value - 1))}>
        <Ionicons name="remove" size={18} color={theme.ink} />
      </Pressable>
      <TextInput
        value={`${value}`}
        onChangeText={(next) => setValue(Number(next.replace(/\D/g, "")) || 0)}
        keyboardType="number-pad"
        style={styles.stepperInput}
      />
      <Pressable style={styles.stepperButton} onPress={() => setValue(value + 1)}>
        <Ionicons name="add" size={18} color={theme.ink} />
      </Pressable>
    </View>
  );
}

function ModeOption({
  active,
  label,
  icon,
  onPress,
  theme,
  styles
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  theme: AppTheme;
  styles: AppStyles;
}) {
  return (
    <Pressable style={[styles.modeOption, active && styles.modeOptionActive]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={active ? theme.green : theme.muted} />
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ConfigListHeader({ title, count, styles }: { title: string; count: string; styles: AppStyles }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionMeta}>{count}</Text>
    </View>
  );
}

function ConfigRow({
  title,
  meta,
  edit,
  remove,
  theme,
  styles
}: {
  title: string;
  meta: string;
  edit: () => void;
  remove: () => void;
  theme: AppTheme;
  styles: AppStyles;
}) {
  return (
    <GlassSurface styles={styles} theme={theme} style={styles.configRow}>
      <Pressable style={styles.configInfo} onPress={edit}>
        <Text style={styles.configName}>{title}</Text>
        <Text style={styles.configMeta} numberOfLines={1}>{meta}</Text>
      </Pressable>
      <Pressable style={styles.smallIconButton} onPress={edit}>
        <Ionicons name="create-outline" size={18} color={theme.blue} />
      </Pressable>
      <Pressable style={styles.smallIconButton} onPress={remove}>
        <Ionicons name="trash-outline" size={18} color={theme.red} />
      </Pressable>
    </GlassSurface>
  );
}

function createStyles(theme: AppTheme) {
  const webGlassFilter =
    Platform.OS === "web"
      ? ({
          backdropFilter: "blur(26px) saturate(190%)",
          WebkitBackdropFilter: "blur(26px) saturate(190%)"
        } as ViewStyle & Record<string, string>)
      : {};

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background
    },
    safeArea: {
      flex: 1,
      backgroundColor: "transparent"
    },
    liquidBackdrop: {
      ...StyleSheet.absoluteFillObject,
      overflow: "hidden"
    },
    liquidBase: {
      ...StyleSheet.absoluteFillObject
    },
    liquidRibbonTop: {
      position: "absolute",
      top: 10,
      left: -120,
      right: -70,
      height: 245,
      opacity: theme.isDark ? 0.82 : 1,
      borderRadius: 8,
      transform: [{ rotate: "-10deg" }]
    },
    liquidRibbonMid: {
      position: "absolute",
      top: 245,
      left: -170,
      right: -130,
      height: 230,
      opacity: theme.isDark ? 0.9 : 1,
      borderRadius: 8,
      transform: [{ rotate: "11deg" }]
    },
    liquidRibbonLow: {
      position: "absolute",
      bottom: 34,
      left: -120,
      right: -150,
      height: 190,
      opacity: theme.isDark ? 0.72 : 0.95,
      borderRadius: 8,
      transform: [{ rotate: "-7deg" }]
    },
    container: {
      padding: 18,
      paddingBottom: 36,
      gap: 18,
      position: "relative"
    },
    glassSurface: {
      overflow: "hidden",
      position: "relative",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.glassStroke,
      backgroundColor: theme.glass,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8,
      ...webGlassFilter
    },
    glassDepth: {
      ...StyleSheet.absoluteFillObject,
      opacity: theme.isDark ? 0.82 : 0.96
    },
    glassSpecular: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "48%",
      opacity: theme.isDark ? 0.2 : 0.42
    },
    glassRim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 8,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderColor: theme.glassStroke
    },
    hero: {
      borderRadius: 8,
      padding: 18,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.glassStroke,
      backgroundColor: theme.glass,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 34,
      shadowOffset: { width: 0, height: 18 }
    },
    heroGlow: {
      ...StyleSheet.absoluteFillObject,
      opacity: theme.isDark ? 0.78 : 0.94
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
      backgroundColor: theme.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.line
    },
    eyebrow: {
      color: theme.green,
      fontSize: 13,
      fontWeight: "700"
    },
    title: {
      color: theme.ink,
      fontSize: 30,
      fontWeight: "800",
      marginTop: 4
    },
    subtitle: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22
    },
    logoMark: {
      width: 54,
      height: 54,
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
      backgroundColor: theme.green,
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
      backgroundColor: theme.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.line,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8
    },
    secondaryButtonText: {
      color: theme.green,
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
      color: theme.ink,
      fontSize: 24,
      fontWeight: "800"
    },
    statLabel: {
      color: theme.muted,
      fontSize: 13,
      marginTop: 2
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    sectionTitle: {
      color: theme.ink,
      fontSize: 19,
      fontWeight: "800"
    },
    sectionMeta: {
      color: theme.muted,
      fontSize: 13
    },
    zoneList: {
      gap: 10,
      paddingRight: 4
    },
    zoneChip: {
      width: 104,
      minHeight: 68,
      padding: 12,
      justifyContent: "space-between"
    },
    zoneChipActive: {
      backgroundColor: theme.isDark ? "rgba(117, 209, 151, 0.22)" : "rgba(59, 143, 91, 0.14)",
      borderColor: theme.green
    },
    zoneName: {
      color: theme.ink,
      fontWeight: "800",
      fontSize: 14
    },
    zoneNameActive: {
      color: theme.green
    },
    zoneTemp: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 6
    },
    zoneTempActive: {
      color: theme.green
    },
    list: {
      gap: 12
    },
    itemCard: {
      padding: 12,
      flexDirection: "row",
      gap: 12,
      alignItems: "center"
    },
    itemImage: {
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: theme.graySoft
    },
    itemImageFallback: {
      width: 58,
      height: 58,
      borderRadius: 8,
      backgroundColor: theme.greenSoft,
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
      color: theme.ink,
      fontSize: 16,
      fontWeight: "800"
    },
    itemMeta: {
      color: theme.muted,
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
      color: theme.muted,
      fontSize: 12
    },
    itemNotes: {
      color: theme.ink,
      fontSize: 12,
      lineHeight: 17
    },
    deleteButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.graySoft
    },
    emptyState: {
      padding: 24,
      alignItems: "center",
      gap: 8
    },
    emptyTitle: {
      color: theme.ink,
      fontSize: 16,
      fontWeight: "800"
    },
    emptyText: {
      color: theme.muted,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 19
    },
    modalRoot: {
      flex: 1,
      backgroundColor: theme.background
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
      borderBottomColor: theme.line,
      backgroundColor: theme.surface
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.line
    },
    modalTitle: {
      color: theme.ink,
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
      backgroundColor: theme.graySoft
    },
    field: {
      gap: 8
    },
    fieldLabel: {
      color: theme.ink,
      fontSize: 14,
      fontWeight: "800"
    },
    input: {
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      paddingHorizontal: 13,
      color: theme.ink,
      fontSize: 15
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
      backgroundColor: theme.graySoft,
      flexDirection: "row",
      gap: 4
    },
    segmentButton: {
      flex: 1,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6
    },
    segmentButtonActive: {
      backgroundColor: theme.surfaceStrong,
      borderWidth: 1,
      borderColor: theme.line
    },
    segmentText: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "800"
    },
    segmentTextActive: {
      color: theme.green
    },
    optionPill: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      paddingHorizontal: 12,
      paddingVertical: 9
    },
    optionPillActive: {
      backgroundColor: theme.greenSoft,
      borderColor: theme.green
    },
    optionText: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "700"
    },
    optionTextActive: {
      color: theme.green
    },
    modeOption: {
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 7
    },
    modeOptionActive: {
      backgroundColor: theme.greenSoft,
      borderColor: theme.green
    },
    zoneOption: {
      width: "31.7%",
      minHeight: 64,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      padding: 10,
      justifyContent: "space-between"
    },
    zoneOptionActive: {
      backgroundColor: theme.blueSoft,
      borderColor: theme.blue
    },
    zoneOptionName: {
      color: theme.ink,
      fontSize: 13,
      fontWeight: "800"
    },
    zoneOptionTemp: {
      color: theme.muted,
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
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      alignItems: "center",
      justifyContent: "center"
    },
    stepperInput: {
      flex: 1,
      height: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surfaceStrong,
      textAlign: "center",
      color: theme.ink,
      fontSize: 16,
      fontWeight: "800"
    },
    helperText: {
      color: theme.muted,
      fontSize: 12
    },
    saveButton: {
      height: 50,
      borderRadius: 8,
      backgroundColor: theme.green,
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
    configRow: {
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
      color: theme.ink,
      fontSize: 15,
      fontWeight: "800"
    },
    configMeta: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 4
    },
    smallIconButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.graySoft
    }
  });
}
