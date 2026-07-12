// ============================================
// SERVORA ERP — Category Manager Screen
// Add/Edit/Delete expense categories + subcategories
// Standalone screen — accessed via /category-manager
// FROZEN
// ============================================

import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useExpenseCategories } from "../../expenses-module/hooks/useExpenseCategories";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from "../../expenses-module/services/category-service";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { ExpenseCategoryWithSubs, ExpenseSubCategory } from "../../expenses-module/types/category-types";

const PALETTE = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#06b6d4", "#84cc16", "#ec4899", "#94a3b8",
  "#ef4444", "#f97316", "#6366f1", "#14b8a6",
];

type PendingDelete =
  | { type: "category"; category: ExpenseCategoryWithSubs }
  | { type: "subcategory"; categoryId: string; subCategory: ExpenseSubCategory }
  | null;

export default function CategoryManagerScreen() {
  const { theme, restaurantId } = useApp();
  const { categories, loading, error } = useExpenseCategories();

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(PALETTE[0]);
  const [newSubCategoryName, setNewSubCategoryName] = useState("");

  // ── Separate rename states — category and sub-category rename never share state ──
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [categoryRenameValue, setCategoryRenameValue] = useState("");
  const [renamingSubCategory, setRenamingSubCategory] = useState<{ categoryId: string; subId: string } | null>(null);
  const [subCategoryRenameValue, setSubCategoryRenameValue] = useState("");

  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const toggleExpand = useCallback((categoryId: string) => {
    setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId));
    setNewSubCategoryName("");
  }, []);

  const handleAddCategory = useCallback(async () => {
    if (!restaurantId || !newCategoryName.trim() || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      await createCategory(restaurantId, {
        name: newCategoryName.trim(),
        color: newCategoryColor,
        restaurantId,
      });
      setNewCategoryName("");
      setNewCategoryColor(PALETTE[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }, [restaurantId, newCategoryName, newCategoryColor, busy]);

  const startRenameCategory = useCallback((category: ExpenseCategoryWithSubs) => {
    setRenamingCategoryId(category.id ?? null);
    setCategoryRenameValue(category.name);
  }, []);

  const confirmRenameCategory = useCallback(async () => {
    if (!restaurantId || !renamingCategoryId || !categoryRenameValue.trim() || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      await updateCategory(restaurantId, renamingCategoryId, { name: categoryRenameValue.trim() });
      setRenamingCategoryId(null);
      setCategoryRenameValue("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rename category";
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }, [restaurantId, renamingCategoryId, categoryRenameValue, busy]);

  const requestDeleteCategory = useCallback((category: ExpenseCategoryWithSubs) => {
    setPendingDelete({ type: "category", category });
  }, []);

  const handleAddSubCategory = useCallback(
    async (categoryId: string) => {
      if (!restaurantId || !newSubCategoryName.trim() || busy) return;

      setBusy(true);
      setActionError(null);
      try {
        await createSubCategory(restaurantId, {
          categoryId,
          name: newSubCategoryName.trim(),
          restaurantId,
        });
        setNewSubCategoryName("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create sub-category";
        setActionError(message);
      } finally {
        setBusy(false);
      }
    },
    [restaurantId, newSubCategoryName, busy]
  );

  const startRenameSubCategory = useCallback((categoryId: string, sub: ExpenseSubCategory) => {
    setRenamingSubCategory({ categoryId, subId: sub.id ?? "" });
    setSubCategoryRenameValue(sub.name);
  }, []);

  const confirmRenameSubCategory = useCallback(async () => {
    if (!restaurantId || !renamingSubCategory || !subCategoryRenameValue.trim() || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      await updateSubCategory(
        restaurantId,
        renamingSubCategory.categoryId,
        renamingSubCategory.subId,
        { name: subCategoryRenameValue.trim() }
      );
      setRenamingSubCategory(null);
      setSubCategoryRenameValue("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to rename sub-category";
      setActionError(message);
    } finally {
      setBusy(false);
    }
  }, [restaurantId, renamingSubCategory, subCategoryRenameValue, busy]);

  const requestDeleteSubCategory = useCallback(
    (categoryId: string, subCategory: ExpenseSubCategory) => {
      setPendingDelete({ type: "subcategory", categoryId, subCategory });
    },
    []
  );

  const closeDeleteConfirm = useCallback(() => setPendingDelete(null), []);

  // ── Delete errors surface via the error banner, not Alert.alert() —
  //    Alert.alert() is native-only and silently no-ops on web. ──
  const confirmDeleteAction = useCallback(async () => {
    if (!pendingDelete || !restaurantId) return;

    setBusy(true);
    setActionError(null);
    try {
      if (pendingDelete.type === "category" && pendingDelete.category.id) {
        await deleteCategory(restaurantId, pendingDelete.category.id);
      } else if (pendingDelete.type === "subcategory" && pendingDelete.subCategory.id) {
        await deleteSubCategory(restaurantId, pendingDelete.categoryId, pendingDelete.subCategory.id);
      }
      setPendingDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      setActionError(message);
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, restaurantId]);

  const deleteModalConfig = (() => {
    if (!pendingDelete) return null;
    if (pendingDelete.type === "category") {
      return {
        title: "Delete Category",
        message: `Delete "${pendingDelete.category.name}"? This also deletes its sub-categories. Categories already used by expenses can't be deleted.`,
      };
    }
    return {
      title: "Delete Sub-Category",
      message: `Delete "${pendingDelete.subCategory.name}"? Sub-categories already used by expenses can't be deleted.`,
    };
  })();

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Category Manager</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Manage expense categories and sub-categories
      </Text>

      {(error || actionError) && (
        <View style={[styles.errorBanner, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
          <Text style={{ color: theme.error, fontSize: 13 }}>{error ?? actionError}</Text>
        </View>
      )}

      {/* Add new category */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Add Category</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="e.g. Marketing"
          placeholderTextColor={theme.textSecondary}
          maxLength={50}
        />
        <View style={styles.paletteRow}>
          {PALETTE.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => setNewCategoryColor(color)}
              style={[
                styles.swatch,
                { backgroundColor: color },
                newCategoryColor === color && styles.swatchSelected,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary, opacity: !newCategoryName.trim() || busy ? 0.5 : 1 }]}
          onPress={handleAddCategory}
          disabled={!newCategoryName.trim() || busy}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Category</Text>
        </TouchableOpacity>
      </View>

      {/* Category list */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
      {categories.map((category) => {
        const isExpanded = expandedCategoryId === category.id;
        const isRenaming = renamingCategoryId === category.id;

        return (
          <View key={category.id} style={[styles.categoryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.categoryHeader} onPress={() => category.id && toggleExpand(category.id)}>
              <View style={styles.categoryHeaderLeft}>
                <View style={[styles.colorDot, { backgroundColor: category.color }]} />
                {isRenaming ? (
                  <TextInput
                    style={[styles.renameInput, { color: theme.text, borderColor: theme.border }]}
                    value={categoryRenameValue}
                    onChangeText={setCategoryRenameValue}
                    autoFocus
                  />
                ) : (
                  <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
                )}
                <Text style={[styles.subCount, { color: theme.textSecondary }]}>
                  {category.subCategories.length} sub
                </Text>
              </View>
              <MaterialIcons
                name={isExpanded ? "expand-less" : "expand-more"}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <View style={styles.categoryActions}>
              {isRenaming ? (
                <>
                  <TouchableOpacity onPress={confirmRenameCategory} style={styles.iconBtn}>
                    <MaterialIcons name="check" size={18} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setRenamingCategoryId(null)} style={styles.iconBtn}>
                    <MaterialIcons name="close" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => startRenameCategory(category)} style={styles.iconBtn}>
                    <MaterialIcons name="edit" size={16} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => requestDeleteCategory(category)} style={styles.iconBtn}>
                    <MaterialIcons name="delete-outline" size={16} color={theme.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {isExpanded && (
              <View style={[styles.subSection, { borderTopColor: theme.border }]}>
                {category.subCategories.map((sub) => {
                  const isSubRenaming =
                    renamingSubCategory?.categoryId === category.id && renamingSubCategory?.subId === sub.id;
                  return (
                    <View key={sub.id} style={styles.subRow}>
                      {isSubRenaming ? (
                        <TextInput
                          style={[styles.renameInputSmall, { color: theme.text, borderColor: theme.border }]}
                          value={subCategoryRenameValue}
                          onChangeText={setSubCategoryRenameValue}
                          autoFocus
                        />
                      ) : (
                        <Text style={[styles.subName, { color: theme.text }]}>{sub.name}</Text>
                      )}
                      <View style={styles.subActions}>
                        {isSubRenaming ? (
                          <>
                            <TouchableOpacity onPress={confirmRenameSubCategory} style={styles.iconBtn}>
                              <MaterialIcons name="check" size={16} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setRenamingSubCategory(null)} style={styles.iconBtn}>
                              <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity onPress={() => startRenameSubCategory(category.id!, sub)} style={styles.iconBtn}>
                              <MaterialIcons name="edit" size={14} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => category.id && requestDeleteSubCategory(category.id, sub)} style={styles.iconBtn}>
                              <MaterialIcons name="delete-outline" size={14} color={theme.error} />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}

                <View style={styles.addSubRow}>
                  <TextInput
                    style={[styles.subInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
                    value={newSubCategoryName}
                    onChangeText={setNewSubCategoryName}
                    placeholder="New sub-category"
                    placeholderTextColor={theme.textSecondary}
                    maxLength={50}
                  />
                  <TouchableOpacity
                    style={[styles.addSubBtn, { backgroundColor: theme.primary, opacity: !newSubCategoryName.trim() || busy ? 0.5 : 1 }]}
                    onPress={() => category.id && handleAddSubCategory(category.id)}
                    disabled={!newSubCategoryName.trim() || busy}
                  >
                    <MaterialIcons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      <ConfirmModal
        visible={!!pendingDelete}
        title={deleteModalConfig?.title ?? ""}
        message={deleteModalConfig?.message ?? ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDeleteAction}
        onCancel={closeDeleteConfirm}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  errorBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  cardTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  paletteRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  swatchSelected: { borderColor: "#000" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 10 },
  categoryCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontSize: 14, fontWeight: "700" },
  subCount: { fontSize: 11 },
  categoryActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  iconBtn: { padding: 4 },
  renameInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, flex: 1 },
  renameInputSmall: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 13, flex: 1 },
  subSection: { borderTopWidth: 1, marginTop: 10, paddingTop: 10, gap: 8 },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingLeft: 18 },
  subName: { fontSize: 13 },
  subActions: { flexDirection: "row", gap: 8 },
  addSubRow: { flexDirection: "row", gap: 8, marginTop: 4, paddingLeft: 18 },
  subInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  addSubBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});