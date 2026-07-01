// ============================================
// SERVORA ERP — DashboardHeader
// ✅ Live clock
// ✅ Year selector
// ✅ Download report button
// ✅ Theme compatible
// ✅ React.memo
// ✅ TypeScript typed props
// ✅ t() — translations used
// ✅ isWeb — responsive font size
// ✅ accessibilityState — busy + disabled
// ✅ No business logic — UI only
// FROZEN
// ============================================

import React, { memo, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, StyleSheet, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useApp } from "../../context/AppContext";

const isWeb = Platform.OS === "web";

// ── Props ─────────────────────────────────────
interface DashboardHeaderProps {
  selectedYear: number;
  generating:   boolean;
  onYearPress:  () => void;
  onDownload:   () => void;
}

// ── Live Clock ────────────────────────────────
const LiveClock = memo(function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={clockStyles.container}>
      <MaterialIcons name="access-time" size={14} color="rgba(255,255,255,0.7)" />
      <Text style={clockStyles.time}>
        {now.toLocaleTimeString("en-GB", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        })}
      </Text>
      <Text style={clockStyles.date}>
        {now.toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}
      </Text>
    </View>
  );
});

const clockStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    marginTop:     6,
  },
  time: {
    color:       "#FFD700",
    fontSize:    14,
    fontWeight:  "800",
    fontVariant: ["tabular-nums"],
  },
  date: {
    color:    "rgba(255,255,255,0.65)",
    fontSize: 11,
  },
});

// ── Main Component ────────────────────────────
function DashboardHeader({
  selectedYear,
  generating,
  onYearPress,
  onDownload,
}: DashboardHeaderProps) {
  // ✅ Fix #1 — t() used for translations
  const { t } = useApp();

  return (
    <LinearGradient
      colors={["#00154f", "#0039cb"]}
      style={styles.header}
    >
      <View style={styles.row}>
        {/* ── Left ── */}
        <View style={styles.left}>
          {/* ✅ Fix #1 — t() for title */}
          <Text style={[styles.title, { fontSize: isWeb ? 22 : 18 }]}>
            {t("dashboardOverview")}
          </Text>
          <Text style={styles.sub}>
            {t("welcomeBack")} 👋
          </Text>
          <LiveClock />
        </View>

        {/* ── Right ── */}
        <View style={styles.right}>
          {/* Year selector */}
          <TouchableOpacity
            style={styles.yearBtn}
            onPress={onYearPress}
            accessibilityLabel={`Selected year ${selectedYear}, tap to change`}
          >
            <MaterialIcons name="calendar-today" size={14} color="#FFD700" />
            <Text style={styles.yearText}>{selectedYear}</Text>
            <MaterialIcons name="arrow-drop-down" size={16} color="#FFD700" />
          </TouchableOpacity>

          {/* Download button */}
          <TouchableOpacity
            style={[
              styles.downloadBtn,
              generating && styles.downloadBtnDisabled,
            ]}
            onPress={onDownload}
            disabled={generating}
            accessibilityLabel={t("downloadReport")}
            // ✅ Fix #3 — accessibilityState busy + disabled
            accessibilityState={{
              disabled: generating,
              busy:     generating,
            }}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#00154f" />
            ) : (
              <>
                <MaterialIcons name="download" size={16} color="#00154f" />
                <Text style={styles.downloadText}>
                  {t("downloadReport")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    paddingTop:        20,
    paddingBottom:     24,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    flexWrap:       "wrap",
    gap:            10,
  },
  left:  { flex: 1 },
  right: { alignItems: "flex-end", gap: 8 },
  title: {
    fontWeight: "900",
    color:      "#FFD700",
  },
  sub: {
    color:     "rgba(255,255,255,0.65)",
    fontSize:  12,
    marginTop:  3,
  },
  yearBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    backgroundColor:   "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:       8,
    borderWidth:        1,
    borderColor:        "rgba(255,215,0,0.3)",
  },
  yearText: {
    color:      "#FFD700",
    fontSize:   13,
    fontWeight: "700",
  },
  downloadBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    backgroundColor:   "#FFD700",
    paddingHorizontal: 12,
    paddingVertical:    7,
    borderRadius:       8,
  },
  downloadBtnDisabled: {
    opacity: 0.7,
  },
  downloadText: {
    color:      "#00154f",
    fontSize:   12,
    fontWeight: "800",
  },
});

export default memo(DashboardHeader);