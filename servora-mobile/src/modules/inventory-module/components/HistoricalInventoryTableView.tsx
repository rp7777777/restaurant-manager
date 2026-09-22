// ============================================
// SERVORA ERP — HistoricalInventoryTableView Component
// ✅ Migration Steps 1-5 — single table for Today and Historical.
// ✅ Out of Stock dedicated table display (Today mode only).
// ✅ Professional redesign:
//    - Letterhead: restaurant name/address/phone/email/VAT, styled
//      as a card (light-blue bg, icon circle — matches Store's own
//      "Requested by" card design language), rendered as the FIRST
//      row INSIDE the table's own bordered block (tableOuterBlock) —
//      not a separate card above the table.
//    - Single controls row: Search (green border) + Sort (Name/
//      Stock) + Full Screen + Category Dropdown.
//    - Date navigator ("< [date] >") rendered below the controls row
//      and above the table. Parent (InventoryScreen.tsx) still owns
//      the actual navigation state/logic — only passes down
//      dateLabel/onPreviousDay/onNextDay/isNextDayDisabled as props.
//    - Categories render inside ONE continuous bordered table (no
//      gap between category blocks) — category headers act as
//      in-table section dividers. Column header row shown only ONCE,
//      above the first category.
// ✅ Category dropdown: raised zIndex/elevation so it renders ABOVE
//    the table instead of behind it, kept as a ScrollView
//    (nestedScrollEnabled) so a long category list scrolls WITHIN
//    the dropdown itself rather than scrolling the parent page.
// ✅ Total QTY and Edit arrow are item-level columns, vertically
//    centered across groupHeight.
// ✅ Received Qty, Lot/Batch QTY, Total QTY are center-aligned.
// ✅ Item Name is vertically centered within its row.
// ✅ Column dividers are centralized absolute-positioned lines, one
//    continuous set spanning the WHOLE table now (not per-category).
// ✅ Rows are non-interactive as a whole — ONLY the Edit arrow icon
//    (Today mode only) opens ItemDetailsDrawer.
// ✅ Edit column is entirely excluded from the table layout in
//    Historical mode.
// ✅ "Received" header renamed to "Received Date". The receivedDate
//    cell is highlighted (bold, darker) when
//    batch.receivedDate === selectedDate.
// ✅ Category header shows the currently-viewed date on the right.
// ✅ Issue column: batches with MORE THAN 2 entries show them PAIRED.
// ✅ Edit arrow icon is red (#dc2626). Lot/Batch QTY and Total QTY
//    numbers are fixed black (#0f172a).
// ✅ Out of Stock filter (Today mode only) guards against archived
//    items leaking in via `isHistorical || item.isActive !== false`.
// ✅ Batch-level archive/restore indicators (diagonal strike,
//    "Archived"/"Restored [date]" in Issue column) — UNCHANGED.
// FROZEN
// ============================================

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Category } from "../types/category";
import {
  InventoryItem, classifyExpiry, resolveExpiryAlertDays,
} from "../types/inventory";
import { useHistoricalInventory, HistoricalItemStock } from "../hooks/useHistoricalInventory";

type HistoricalSortOption = "name-asc" | "stock-asc";
type StockStatusFilter = "all" | "lowStock" | "outOfStock" | "expiringSoon";

interface HistoricalInventoryTableViewProps {
  restaurantId:   string;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantEmail?: string;
  restaurantVatNumber?: string;
  selectedDate:   string;
  dateLabel:      string;
  onPreviousDay:  () => void;
  onNextDay:      () => void;
  isNextDayDisabled: boolean;
  categories:     Category[];
  inventoryItems: InventoryItem[];
  searchQuery:    string;
  setSearchQuery: (q: string) => void;
  categoryId:     string | null;
  setCategoryId:  (id: string | null) => void;
  onItemPress:    (item: InventoryItem) => void;
  sort:           HistoricalSortOption;
  setSort:        (s: HistoricalSortOption) => void;
  isHistorical:   boolean;
  onOpenFullScreen?: () => void;
  stockStatus?:    StockStatusFilter;
  todayISO:        string;
  categoryMapForExpiry: Map<string, Category>;
  restaurantDefaultExpiryAlertDays?: number;
}

interface HistoricalCategoryGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        HistoricalItemStock[];
}

interface OutOfStockRow {
  inventoryId:   string;
  itemName:      string;
  categoryId:    string;
  depletedSince: string | null;
}

interface OutOfStockGroup {
  categoryId:   string;
  categoryName: string;
  categoryIcon: string | undefined;
  items:        OutOfStockRow[];
}

const ROW_HEIGHT = 26;
const LEFT_COLS = { sn: 35, item: 130 };
const RIGHT_COLS = { date: 75, batch: 85, receivedQty: 70, issue: 175, stock: 70, unit: 50, expiry: 75 };
const TOTAL_COL = 75;
const ARROW_COL = 35;
const LEFT_WIDTH = LEFT_COLS.sn + LEFT_COLS.item;
const BATCH_COLS_WIDTH =
  RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty + RIGHT_COLS.issue + RIGHT_COLS.stock +
  RIGHT_COLS.unit + RIGHT_COLS.expiry;
const TABLE_WIDTH = LEFT_WIDTH + BATCH_COLS_WIDTH + TOTAL_COL + ARROW_COL;

const DIVIDER_X_POSITIONS = [
  LEFT_COLS.sn,
  LEFT_COLS.sn + LEFT_COLS.item,
  LEFT_WIDTH + RIGHT_COLS.date,
  LEFT_WIDTH + RIGHT_COLS.date + RIGHT_COLS.batch,
  LEFT_WIDTH + RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty,
  LEFT_WIDTH + RIGHT_COLS.date + RIGHT_COLS.batch + RIGHT_COLS.receivedQty + RIGHT_COLS.issue,
  LEFT_WIDTH + BATCH_COLS_WIDTH - RIGHT_COLS.unit - RIGHT_COLS.expiry,
  LEFT_WIDTH + BATCH_COLS_WIDTH - RIGHT_COLS.expiry,
  LEFT_WIDTH + BATCH_COLS_WIDTH,
  LEFT_WIDTH + BATCH_COLS_WIDTH + TOTAL_COL,
];

const OOS_TABLE_WIDTH = 900;
const OOS_COLS = { sn: 50, item: 260, date: 160, note: 180 };

const UNCATEGORIZED_ID = "__uncategorized__";

const CATEGORY_ACCENTS_HISTORICAL = [{ bg: "#1e3a5f" }, { bg: "#0f766e" }];
const CATEGORY_ACCENTS_TODAY = [{ bg: "#059669" }, { bg: "#0d9488" }];

function getBatchRowHeight(issueCount: number): number {
  if (issueCount <= 2) return ROW_HEIGHT;
  const lineCount = Math.ceil(issueCount / 2);
  return ROW_HEIGHT * lineCount;
}

function formatCategoryHeaderDate(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function HistoricalInventoryTableView({
  restaurantId, restaurantName, restaurantAddress, restaurantPhone, restaurantEmail, restaurantVatNumber,
  selectedDate, dateLabel, onPreviousDay, onNextDay, isNextDayDisabled,
  categories, inventoryItems,
  searchQuery, setSearchQuery, categoryId, setCategoryId,
  onItemPress, sort, setSort, isHistorical, onOpenFullScreen,
  stockStatus, todayISO, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
}: HistoricalInventoryTableViewProps) {
  const theme = isHistorical
    ? { headerBg: "#1e3a5f", chipActive: "#1e3a5f" }
    : { headerBg: "#059669", chipActive: "#1e293b" };
  const categoryAccents = isHistorical ? CATEGORY_ACCENTS_HISTORICAL : CATEGORY_ACCENTS_TODAY;

  const effectiveTableWidth = isHistorical ? TABLE_WIDTH - ARROW_COL : TABLE_WIDTH;

  const [tableAreaHeights, setTableAreaHeights] = useState<Record<string, number>>({});
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const { itemsWithHistoricalStock, depletedItems, loading, error } =
    useHistoricalInventory(restaurantId, selectedDate, inventoryItems);

  const inventoryItemById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const it of inventoryItems) map.set(it.id, it);
    return map;
  }, [inventoryItems]);

  const sortItems = (list: HistoricalItemStock[]): HistoricalItemStock[] => {
    const sorted = [...list];
    if (sort === "stock-asc") {
      sorted.sort((a, b) => a.historicalStock - b.historicalStock);
    } else {
      sorted.sort((a, b) => a.itemName.localeCompare(b.itemName));
    }
    return sorted;
  };

  const filteredItems = useMemo(() => {
    let result = itemsWithHistoricalStock;

    if (!isHistorical && stockStatus && stockStatus !== "all") {
      result = result.filter((histItem) => {
        const liveItem = inventoryItemById.get(histItem.inventoryId);
        if (!liveItem) return false;

        if (stockStatus === "lowStock") {
          return liveItem.currentStock > 0 && liveItem.isLowStock;
        }
        if (stockStatus === "outOfStock") {
          return liveItem.currentStock <= 0;
        }
        if (stockStatus === "expiringSoon") {
          const category = categoryMapForExpiry.get(liveItem.categoryId);
          const resolvedDays = resolveExpiryAlertDays(
            liveItem.expiryAlertDaysOverride,
            category?.expiryAlertDays,
            restaurantDefaultExpiryAlertDays
          );
          return classifyExpiry(liveItem.expiryDate, todayISO, resolvedDays) === "expiringSoon";
        }
        return true;
      });
    }

    if (categoryId) {
      result = result.filter((it) => it.categoryId === categoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((it) => it.itemName.toLowerCase().includes(q));
    }
    return result;
  }, [
    itemsWithHistoricalStock, searchQuery, categoryId, isHistorical, stockStatus,
    inventoryItemById, todayISO, categoryMapForExpiry, restaurantDefaultExpiryAlertDays,
  ]);

  const categoryGroups = useMemo<HistoricalCategoryGroup[]>(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, HistoricalItemStock[]>();

    for (const item of filteredItems) {
      const key = item.categoryId && categoryById.has(item.categoryId) ? item.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];
      list.push(item);
      byCategory.set(key, list);
    }

    const groups: HistoricalCategoryGroup[] = [];
    for (const category of categories) {
      const items = byCategory.get(category.id);
      if (!items || items.length === 0) continue;
      groups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items: sortItems(items) });
    }

    const uncategorized = byCategory.get(UNCATEGORIZED_ID);
    if (uncategorized && uncategorized.length > 0) {
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: sortItems(uncategorized) });
    }

    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [filteredItems, categories, sort]);

  const outOfStockGroups = useMemo<OutOfStockGroup[]>(() => {
    const depletedSinceByInventoryId = new Map(depletedItems.map((d) => [d.inventoryId, d.depletedSince]));
    const outOfStockItems = inventoryItems.filter(
      (item) => (isHistorical || item.isActive !== false) && item.currentStock <= 0
    );

    const rows: OutOfStockRow[] = outOfStockItems
      .filter((item) => {
        if (categoryId && item.categoryId !== categoryId) return false;
        if (searchQuery.trim() && !item.itemName.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
        return true;
      })
      .map((item) => ({
        inventoryId:   item.id,
        itemName:      item.itemName,
        categoryId:    item.categoryId,
        depletedSince: depletedSinceByInventoryId.get(item.id) ?? null,
      }));

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byCategory = new Map<string, OutOfStockRow[]>();
    for (const row of rows) {
      const key = row.categoryId && categoryById.has(row.categoryId) ? row.categoryId : UNCATEGORIZED_ID;
      const list = byCategory.get(key) ?? [];
      list.push(row);
      byCategory.set(key, list);
    }

    const groups: OutOfStockGroup[] = [];
    for (const category of categories) {
      const items = byCategory.get(category.id);
      if (!items || items.length === 0) continue;
      items.sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: category.id, categoryName: category.name, categoryIcon: category.icon, items });
    }
    const uncategorized = byCategory.get(UNCATEGORIZED_ID);
    if (uncategorized && uncategorized.length > 0) {
      uncategorized.sort((a, b) => a.itemName.localeCompare(b.itemName));
      groups.push({ categoryId: UNCATEGORIZED_ID, categoryName: "Uncategorized", categoryIcon: undefined, items: uncategorized });
    }
    groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return groups;
  }, [depletedItems, inventoryItems, categories, categoryId, searchQuery, isHistorical]);

  const selectedCategoryName = categoryId
    ? categories.find((c) => c.id === categoryId)?.name ?? "All Categories"
    : "All Categories";

  if (loading) {
    return <ActivityIndicator size="large" color={theme.headerBg} style={styles.loadingIndicator} />;
  }

  const isShowingOutOfStock = !isHistorical && stockStatus === "outOfStock";

  const letterheadMetaParts: string[] = [];
  if (restaurantPhone) letterheadMetaParts.push(`Phone: ${restaurantPhone}`);
  if (restaurantEmail) letterheadMetaParts.push(`Email: ${restaurantEmail}`);
  if (restaurantVatNumber) letterheadMetaParts.push(`VAT: ${restaurantVatNumber}`);

  const Letterhead = (restaurantName || restaurantAddress) ? (
    <View style={styles.letterheadCard}>
      <View style={styles.letterheadIconCircle}>
        <MaterialIcons name="storefront" size={16} color="#fff" />
      </View>
      <View style={styles.letterheadTextGroup}>
        {restaurantName ? <Text style={styles.letterheadName}>{restaurantName}</Text> : null}
        {restaurantAddress ? <Text style={styles.letterheadAddress}>{restaurantAddress}</Text> : null}
        {letterheadMetaParts.length > 0 ? (
          <Text style={styles.letterheadMeta}>{letterheadMetaParts.join("   •   ")}</Text>
        ) : null}
      </View>
    </View>
  ) : null;

  const ControlsRow = (
    <View style={styles.controlsRow}>
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={18} color="#059669" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      <TouchableOpacity
        style={[styles.sortChip, sort === "name-asc" && { backgroundColor: theme.chipActive, borderColor: theme.chipActive }]}
        onPress={() => setSort("name-asc")}
      >
        <MaterialIcons name="sort-by-alpha" size={13} color={sort === "name-asc" ? "#fff" : "#64748b"} />
        <Text style={[styles.sortChipText, sort === "name-asc" && styles.sortChipTextActive]}>Name</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortChip, sort === "stock-asc" && { backgroundColor: theme.chipActive, borderColor: theme.chipActive }]}
        onPress={() => setSort("stock-asc")}
      >
        <MaterialIcons name="trending-up" size={13} color={sort === "stock-asc" ? "#fff" : "#64748b"} />
        <Text style={[styles.sortChipText, sort === "stock-asc" && styles.sortChipTextActive]}>Stock</Text>
      </TouchableOpacity>

      {onOpenFullScreen && (
        <TouchableOpacity style={styles.fullScreenBtn} onPress={onOpenFullScreen}>
          <MaterialIcons name="fullscreen" size={14} color="#fff" />
          <Text style={styles.fullScreenBtnText}>Full Screen</Text>
        </TouchableOpacity>
      )}

      {categories.length > 0 && (
        <View style={styles.dropdownWrap}>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowCategoryDropdown((v) => !v)}>
            <Text style={styles.dropdownButtonText} numberOfLines={1}>{selectedCategoryName}</Text>
            <MaterialIcons name={showCategoryDropdown ? "expand-less" : "expand-more"} size={18} color="#059669" />
          </TouchableOpacity>
          {showCategoryDropdown && (
            <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setCategoryId(null); setShowCategoryDropdown(false); }}
              >
                <Text style={styles.dropdownItemText}>All Categories</Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.dropdownItem}
                  onPress={() => { setCategoryId(cat.id); setShowCategoryDropdown(false); }}
                >
                  <Text style={styles.dropdownItemText}>{cat.icon} {cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );

  const DateNav = (
    <View style={styles.dateNav}>
      <TouchableOpacity onPress={onPreviousDay} style={styles.dateNavArrow}>
        <MaterialIcons name="chevron-left" size={22} color="#1e293b" />
      </TouchableOpacity>
      <Text style={styles.dateNavLabel}>{dateLabel}</Text>
      <TouchableOpacity onPress={onNextDay} style={styles.dateNavArrow} disabled={isNextDayDisabled}>
        <MaterialIcons name="chevron-right" size={22} color={isNextDayDisabled ? "#cbd5e1" : "#1e293b"} />
      </TouchableOpacity>
    </View>
  );

  if (isShowingOutOfStock) {
    return (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {ControlsRow}
        {DateNav}

        {outOfStockGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={40} color="#cbd5e1" />
            <Text style={styles.emptyStateText}>No out-of-stock items</Text>
          </View>
        ) : (
          outOfStockGroups.map((group) => (
            <View key={group.categoryId} style={[styles.categoryBlock, { width: OOS_TABLE_WIDTH }]}>
              <View style={[styles.categoryHeader, { backgroundColor: theme.headerBg }]}>
                <Text style={styles.categoryHeaderText}>
                  {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                </Text>
                <Text style={styles.categoryHeaderDate}>{formatCategoryHeaderDate(selectedDate)}</Text>
              </View>
              <View style={styles.oosTableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.sn }]}>S.N.</Text>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.item }]}>Item Name</Text>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.date }]}>Date</Text>
                <Text style={[styles.tableHeaderCell, { width: OOS_COLS.note }]}>Note</Text>
              </View>
              {group.items.map((item, itemIndex) => (
                <View
                  key={item.inventoryId}
                  style={[styles.oosRow, itemIndex % 2 === 1 && styles.itemGroupRowAlt]}
                >
                  <Text style={[styles.leftStripCell, { width: OOS_COLS.sn }]}>{itemIndex + 1}</Text>
                  <Text style={[styles.itemNameCell, { width: OOS_COLS.item }]}>{item.itemName}</Text>
                  <Text style={[styles.leftStripCell, { width: OOS_COLS.date }]}>{item.depletedSince ?? "—"}</Text>
                  <Text style={[styles.oosNoteText, { width: OOS_COLS.note }]}>Out of stock</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  let hasShownColumnHeader = false;
  let categoryAccentIndex = 0;

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
      {ControlsRow}
      {DateNav}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {categoryGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="history" size={40} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>No stock existed on this date</Text>
        </View>
      ) : (
        <View style={[styles.tableOuterBlock, { width: effectiveTableWidth }]}>
          {Letterhead}
          {categoryGroups.map((group) => {
            const groupHeights = group.items.map((item) =>
              item.batches.reduce((sum, b) => sum + getBatchRowHeight(b.issues.length), 0)
            );
            const key = group.categoryId;
            const measuredHeight = tableAreaHeights[key] ?? 0;
            const accent = categoryAccents[categoryAccentIndex % categoryAccents.length];
            categoryAccentIndex += 1;
            const showColumnHeader = !hasShownColumnHeader;
            if (showColumnHeader) hasShownColumnHeader = true;

            return (
              <View key={key}>
                <View style={[styles.categoryHeader, { backgroundColor: accent.bg }]}>
                  <Text style={styles.categoryHeaderText}>
                    {group.categoryIcon ? `${group.categoryIcon} ` : ""}{group.categoryName.toUpperCase()}
                  </Text>
                  <Text style={styles.categoryHeaderDate}>{formatCategoryHeaderDate(selectedDate)}</Text>
                </View>

                <View
                  style={styles.tableArea}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    setTableAreaHeights((prev) =>
                      prev[key] === h ? prev : { ...prev, [key]: h }
                    );
                  }}
                >
                  {showColumnHeader && (
                    <View style={styles.tableHeaderRow}>
                      <View style={[styles.leftHeaderGroup, { width: LEFT_WIDTH }]}>
                        <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.sn }]}>S.N.</Text>
                        <Text style={[styles.tableHeaderCell, { width: LEFT_COLS.item }]}>Item Name</Text>
                      </View>
                      <View style={styles.rightHeaderGroup}>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.date }]}>Received Date</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.batch }]}>Lot/Batch No.</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.receivedQty }]}>Received Qty</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.issue }]}>Issue</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.stock }]}>Lot/Batch QTY</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.unit }]}>Unit</Text>
                        <Text style={[styles.tableHeaderCell, { width: RIGHT_COLS.expiry }]}>Expiry</Text>
                      </View>
                      <Text style={[styles.tableHeaderCell, { width: TOTAL_COL }]}>Total QTY</Text>
                      {!isHistorical && (
                        <Text style={[styles.tableHeaderCell, { width: ARROW_COL, textAlign: "center" }]}>Edit</Text>
                      )}
                    </View>
                  )}

                  {group.items.map((item, itemIndex) => {
                    const groupHeight = groupHeights[itemIndex];
                    const realItem = inventoryItemById.get(item.inventoryId);
                    const isEvenRow = itemIndex % 2 === 1;

                    return (
                      <View
                        key={item.inventoryId}
                        style={[
                          styles.itemGroupRow,
                          { minHeight: groupHeight },
                          isEvenRow && styles.itemGroupRowAlt,
                        ]}
                      >
                        <View style={[styles.leftStrip, { width: LEFT_WIDTH, minHeight: groupHeight }, isEvenRow && styles.leftStripAlt]}>
                          <Text style={[styles.leftStripCell, { width: LEFT_COLS.sn }]}>{itemIndex + 1}</Text>
                          <View style={{ width: LEFT_COLS.item }}>
                            <Text style={[styles.leftStripCell, styles.itemNameCell]}>{item.itemName}</Text>
                            {item.hasInconsistency && (
                              <View style={styles.inconsistencyBadge}>
                                <MaterialIcons name="warning" size={10} color="#b45309" />
                                <Text style={styles.inconsistencyText}>data issue</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <View style={styles.rightBatchRows}>
                          {item.batches.map((batch, batchIndex) => {
                            const batchRowHeight = getBatchRowHeight(batch.issues.length);
                            const wasReceivedToday = batch.receivedDate === selectedDate;
                            const isArchivedToday = batch.isBatchArchived && batch.batchArchivedDate === selectedDate;
                            const isRestoredToday = batch.isBatchRestoredToday;

                            return (
                              <View
                                key={batch.batchId}
                                style={[
                                  styles.batchRow,
                                  { minHeight: batchRowHeight },
                                  batchIndex < item.batches.length - 1 && styles.batchRowDivider,
                                ]}
                              >
                                <Text style={[
                                  styles.tableCell,
                                  { width: RIGHT_COLS.date },
                                  wasReceivedToday && styles.receivedDateHighlight,
                                ]}>
                                  {batch.receivedDate}
                                </Text>
                                <View style={{ width: RIGHT_COLS.batch, position: "relative" }}>
                                  <Text style={[
                                    styles.tableCell,
                                    isArchivedToday && styles.archivedBatchNoText,
                                    isRestoredToday && styles.restoredBatchNoText,
                                  ]} numberOfLines={1}>
                                    {batch.batchNo}
                                  </Text>
                                  {isArchivedToday && <View style={styles.diagonalStrike} pointerEvents="none" />}
                                </View>
                                <Text style={[styles.tableCell, styles.receivedQtyCell, { width: RIGHT_COLS.receivedQty }]}>
                                  {wasReceivedToday ? String(batch.originalQuantity) : "—"}
                                </Text>
                                <View style={{ width: RIGHT_COLS.issue }}>
                                  {isArchivedToday && (
                                    <Text style={[styles.tableCell, styles.archivedIndicatorText]}>Archived</Text>
                                  )}
                                  {isRestoredToday && (
                                    <Text style={[styles.tableCell, styles.restoredIndicatorText]}>Restored {batch.batchRestoredDate}</Text>
                                  )}
                                  {batch.issues.length === 0 ? (
                                    !isArchivedToday && !isRestoredToday && <Text style={[styles.tableCell, styles.issueCell]}>—</Text>
                                  ) : batch.issues.length <= 2 ? (
                                    <Text style={[styles.tableCell, styles.issueCell]} numberOfLines={1}>
                                      {batch.issues.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" • ")}
                                    </Text>
                                  ) : (
                                    Array.from({ length: Math.ceil(batch.issues.length / 2) }).map((_, lineIdx) => {
                                      const pair = batch.issues.slice(lineIdx * 2, lineIdx * 2 + 2);
                                      return (
                                        <Text key={lineIdx} style={[styles.tableCell, styles.issueCell, styles.issueMultiLine]} numberOfLines={1}>
                                          {pair.map((iss) => `${iss.quantity} ${batch.unit} ${iss.source}`).join(" / ")}
                                        </Text>
                                      );
                                    })
                                  )}
                                </View>
                                <Text style={[styles.tableCell, styles.batchQtyCell, { width: RIGHT_COLS.stock }]}>{batch.quantity}</Text>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.unit }]}>{batch.unit}</Text>
                                <Text style={[styles.tableCell, { width: RIGHT_COLS.expiry }]}>{batch.expiryDate ?? "—"}</Text>
                              </View>
                            );
                          })}
                        </View>

                        <View style={{ width: TOTAL_COL, minHeight: groupHeight, justifyContent: "center", alignItems: "center" }}>
                          <Text style={styles.totalCell}>{String(item.historicalStock)}</Text>
                        </View>

                        {!isHistorical && (
                          <View style={{ width: ARROW_COL, minHeight: groupHeight, justifyContent: "center", alignItems: "center" }}>
                            {realItem && (
                              <TouchableOpacity onPress={() => onItemPress(realItem)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <MaterialIcons name="chevron-right" size={16} color="#dc2626" />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {measuredHeight > 0 && DIVIDER_X_POSITIONS.map((x) => (
                    <View
                      key={x}
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: x,
                        top: 0,
                        height: measuredHeight + 4,
                        width: 1,
                        backgroundColor: "#94a3b8",
                      }}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingIndicator: { marginTop: 40 },
  body: { flex: 1 },
  bodyContent: { padding: 12, paddingTop: 4, alignItems: "center" },
  letterheadCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1.5, borderBottomColor: "#475569",
  },
  letterheadIconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#2563eb",
    alignItems: "center", justifyContent: "center",
  },
  letterheadTextGroup: { flex: 1 },
  letterheadName: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  letterheadAddress: { fontSize: 12, color: "#475569", marginTop: 1 },
  letterheadMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  controlsRow: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
    width: "100%", maxWidth: 900, marginBottom: 10, zIndex: 1000,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", flex: 1, minWidth: 160, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1.5, borderColor: "#059669",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1",
  },
  sortChipText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  sortChipTextActive: { color: "#fff" },
  fullScreenBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 4,
    backgroundColor: "#0369a1",
  },
  fullScreenBtnText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  dropdownWrap: { width: 180, position: "relative", zIndex: 1000, elevation: 20 },
  dropdownButton: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1.5, borderColor: "#059669", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#fff",
  },
  dropdownButtonText: { fontSize: 12, color: "#1e293b", fontWeight: "600", flex: 1 },
  dropdownList: {
    position: "absolute", top: "100%", right: 0,
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    marginTop: 4, maxHeight: 220, backgroundColor: "#ffffff",
    width: 180, zIndex: 1000, elevation: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 10 },
  dropdownItemText: { fontSize: 13, color: "#1e293b" },
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    width: "100%", maxWidth: 900, paddingVertical: 8, marginBottom: 10,
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0",
  },
  dateNavArrow: { padding: 4 },
  dateNavLabel: { fontSize: 14, fontWeight: "800", color: "#1e293b", minWidth: 160, textAlign: "center" },
  errorBanner: {
    backgroundColor: "#fef2f2", padding: 10, borderRadius: 6, marginBottom: 10, width: "100%", maxWidth: 500,
    borderWidth: 1, borderColor: "#fecaca",
  },
  errorBannerText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyStateText: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  tableOuterBlock: {
    borderWidth: 1.5, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryBlock: {
    marginBottom: 16, borderWidth: 1.5, borderColor: "#475569", borderRadius: 4, overflow: "hidden",
  },
  categoryHeader: {
    paddingVertical: 4, paddingHorizontal: 10, minHeight: 26,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  categoryHeaderText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.6 },
  categoryHeaderDate: { color: "#fff", fontWeight: "700", fontSize: 12 },
  tableArea: { position: "relative" },
  tableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8, marginTop: 2,
  },
  leftHeaderGroup: { flexDirection: "row" },
  rightHeaderGroup: { flexDirection: "row" },
  tableHeaderCell: { fontSize: 12, fontWeight: "800", color: "#334155", paddingHorizontal: 4, letterSpacing: 0.3 },
  itemGroupRow: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#475569" },
  itemGroupRowAlt: { backgroundColor: "#f8fafc" },
  leftStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingVertical: 4,
  },
  leftStripAlt: { backgroundColor: "#f8fafc" },
  leftStripCell: { fontSize: 11, color: "#475569", paddingHorizontal: 4 },
  itemNameCell: { fontWeight: "700", color: "#0f172a", fontSize: 11 },
  inconsistencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 1,
    marginTop: 3, marginLeft: 4, backgroundColor: "#fef3c7", borderRadius: 3, alignSelf: "flex-start",
  },
  inconsistencyText: { fontSize: 7, color: "#92400e", fontWeight: "700" },
  rightBatchRows: { flex: 1 },
  batchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  batchRowDivider: { borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  tableCell: { fontSize: 11, color: "#334155", paddingHorizontal: 4 },
  receivedDateHighlight: { color: "#0f172a", fontWeight: "800" },
  receivedQtyCell: { color: "#475569", fontWeight: "700", textAlign: "center" },
  issueCell: { color: "#b91c1c", fontWeight: "600" },
  issueMultiLine: { marginBottom: 1 },
  batchQtyCell: { fontWeight: "800", fontSize: 11, color: "#0f172a", textAlign: "center" },
  totalCell: { fontWeight: "800", fontSize: 11, color: "#0f172a", textAlign: "center" },
  archivedBatchNoText: { color: "#94a3b8" },
  diagonalStrike: {
    position: "absolute", left: 0, right: 0, top: "50%",
    height: 1.5, backgroundColor: "#dc2626",
    transform: [{ rotate: "-8deg" }],
  },
  archivedIndicatorText: { color: "#dc2626", fontWeight: "800", fontStyle: "italic" },
  oosTableHeaderRow: {
    flexDirection: "row", backgroundColor: "#f1f5f9",
    borderBottomWidth: 2, borderBottomColor: "#1e293b", paddingVertical: 8, paddingHorizontal: 10,
  },
  restoredBatchNoText: { color: "#059669" },
  restoredIndicatorText: { color: "#059669", fontWeight: "800", fontStyle: "italic" },
  oosRow: {
    flexDirection: "row", alignItems: "center",
    minHeight: ROW_HEIGHT,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 2, borderBottomColor: "#1e293b",
  },
  oosNoteText: { fontSize: 10, color: "#dc2626", fontWeight: "700" },
});