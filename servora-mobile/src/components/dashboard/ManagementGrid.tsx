// ============================================
// SERVORA ERP — ManagementGrid
// ✅ Module navigation grid
// ✅ route: string — Expo Router compatible
// ✅ Callback props — no hardcoded navigation
// ✅ t() — i18n compatible
// ✅ Theme compatible
// ✅ React.memo
// ✅ useWindowDimensions — orientation safe
// ✅ cardWidth — applied to card
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, Platform, useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp }        from "../../context/AppContext";
import { MENU_ITEMS }    from "../../constants/dashboard";

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface ManagementGridProps {
  onNavigate: (route: string) => void;
}

// ── Menu Card ─────────────────────────────────
interface MenuCardProps {
  labelKey:  string;
  icon:      keyof typeof MaterialIcons.glyphMap;
  color:     string;
  cardWidth: number;
  onPress:   () => void;
}

const MenuCard = memo(function MenuCard({
  labelKey, icon, color, cardWidth, onPress,
}: MenuCardProps) {
  const { theme, t } = useApp();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.card, width: cardWidth },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t(labelKey)}
    >
      <View style={[styles.iconBox, { backgroundColor: color + "18" }]}>
        <MaterialIcons name={icon} size={26} color={color} />
      </View>
      <Text
        style={[styles.label, { color: theme.text }]}
        numberOfLines={2}
      >
        {t(labelKey)}
      </Text>
    </TouchableOpacity>
  );
});

// ── Main Component ────────────────────────────
function ManagementGrid({ onNavigate }: ManagementGridProps) {
  const { theme, t } = useApp();
  const { width }    = useWindowDimensions();
  const cardWidth    = isWeb ? 120 : (width - 52) / 3;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>
        {t("management")}
      </Text>
      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => (
          <MenuCard
            key={item.route}
            labelKey={item.labelKey}
            icon={item.icon}
            color={item.color}
            cardWidth={cardWidth}
            onPress={() => onNavigate(item.route)}
          />
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  container: { marginBottom: 32 },
  title: {
    fontSize:     14,
    fontWeight:   "800",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
  },
  card: {
    borderRadius:   14,
    padding:        12,
    alignItems:     "center",
    justifyContent: "center",
    gap:             8,
    minHeight:      90,
    shadowColor:    "#000",
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.05,
    shadowRadius:   4,
    elevation:      1,
  },
  iconBox: {
    width:          46,
    height:         46,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
  },
  label: {
    fontSize:   11,
    fontWeight: "600",
    textAlign:  "center",
    lineHeight: 15,
  },
});

export default memo(ManagementGrid);