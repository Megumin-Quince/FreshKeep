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
import { categoryLabels, categoryShelfLife, fridgeZones } from "./src/data/fridge";
import { addDays, formatRemaining, freshnessStatus, toISODate } from "./src/services/dateUtils";
import { localInventoryRepository, pendingRemoteInventoryGateway } from "./src/services/localRepository";
import { mockRecognitionService } from "./src/services/recognitionService";
import { colors } from "./src/theme/colors";
import { FoodCategory, FridgeZoneId, InventoryItem, ItemDraft } from "./src/types/inventory";

const categories = Object.keys(categoryLabels) as FoodCategory[];
const firstZone = fridgeZones[1];

const initialDraft: ItemDraft = {
  name: "",
  category: "vegetable",
  quantity: "1 份",
  zoneId: firstZone.id,
  temperature: firstZone.temperature,
  shelfLifeDays: categoryShelfLife.vegetable,
  notes: ""
};

const seedItems: InventoryItem[] = [
  {
    id: "seed-milk",
    name: "低温鲜奶",
    category: "dairy",
    quantity: "1 瓶",
    zoneId: "middle",
    temperature: "2-4°C",
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
    zoneId: "upper",
    temperature: "3-5°C",
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
  const [selectedZone, setSelectedZone] = useState<FridgeZoneId | "all">("all");
  const [draft, setDraft] = useState<ItemDraft>(initialDraft);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recognizing, setRecognizing] = useState(false);

  useEffect(() => {
    localInventoryRepository.list().then((storedItems) => {
      setItems(storedItems.length ? storedItems : seedItems);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      localInventoryRepository.save(items);
    }
  }, [items, loading]);

  const stats = useMemo(() => {
    const expiring = items.filter((item) => freshnessStatus(item.expiresAt) === "soon").length;
    const expired = items.filter((item) => freshnessStatus(item.expiresAt) === "expired").length;
    const zoneCount = new Set(items.map((item) => item.zoneId)).size;
    return { total: items.length, expiring, expired, zoneCount };
  }, [items]);

  const filteredItems = useMemo(() => {
    const list = selectedZone === "all" ? items : items.filter((item) => item.zoneId === selectedZone);
    return [...list].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }, [items, selectedZone]);

  function updateDraft(next: Partial<ItemDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function selectCategory(category: FoodCategory) {
    updateDraft({ category, shelfLifeDays: categoryShelfLife[category] });
  }

  function selectZone(zoneId: FridgeZoneId) {
    const zone = fridgeZones.find((item) => item.id === zoneId) ?? firstZone;
    updateDraft({ zoneId, temperature: zone.temperature });
  }

  async function pickAndRecognize() {
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

    setRecognizing(true);
    const asset = result.assets[0];
    const recognition = await mockRecognitionService.recognize({
      uri: asset.uri,
      fileName: asset.fileName ?? undefined
    });
    const zone = fridgeZones.find((item) => item.id === recognition.suggestedZoneId) ?? firstZone;
    setDraft({
      name: recognition.name,
      category: recognition.category,
      quantity: "1 份",
      zoneId: recognition.suggestedZoneId,
      temperature: zone.temperature,
      shelfLifeDays: recognition.shelfLifeDays,
      notes: `${recognition.notes}，置信度 ${Math.round(recognition.confidence * 100)}%`,
      imageUri: asset.uri
    });
    setModalVisible(true);
    setRecognizing(false);
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
    await pendingRemoteInventoryGateway.sync(nextItems);
    setDraft(initialDraft);
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
            <View>
              <Text style={styles.eyebrow}>FreshKeep</Text>
              <Text style={styles.title}>冰箱食材管家</Text>
            </View>
            <View style={styles.logoMark}>
              <MaterialCommunityIcons name="fridge-outline" size={30} color={colors.green} />
            </View>
          </View>
          <Text style={styles.subtitle}>记录位置、温度和保鲜期，优先处理临期食材。</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => setModalVisible(true)}>
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
          {fridgeZones.map((zone) => (
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
            <InventoryCard key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
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
                  {categories.map((category) => (
                    <Pressable
                      key={category}
                      style={[styles.optionPill, draft.category === category && styles.optionPillActive]}
                      onPress={() => selectCategory(category)}
                    >
                      <Text style={[styles.optionText, draft.category === category && styles.optionTextActive]}>
                        {categoryLabels[category]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>
              <Field label="位置与温度">
                <View style={styles.optionWrap}>
                  {fridgeZones.map((zone) => (
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
                <TextInput
                  value={draft.temperature}
                  onChangeText={(temperature) => updateDraft({ temperature })}
                  placeholder="当前温度"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.compactInput]}
                />
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

function InventoryCard({ item, onDelete }: { item: InventoryItem; onDelete: () => void }) {
  const status = freshnessStatus(item.expiresAt);
  const zone = fridgeZones.find((entry) => entry.id === item.zoneId);
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
              {categoryLabels[item.category]} · {item.quantity}
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
  }
});
