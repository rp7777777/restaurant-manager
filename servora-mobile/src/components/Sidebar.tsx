import React from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

import { router } from "expo-router";

export default function Sidebar() {
  return (
    <ScrollView style={styles.sidebar}>
      <Text style={styles.logo}>
        SERVORA
      </Text>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() =>
          router.push("/restaurants")
        }
      >
        <Text style={styles.menuText}>
          Restaurants
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() =>
          router.push("/sales")
        }
      >
        <Text style={styles.menuText}>
          Daily Sales
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() =>
          router.push("/inventory")
        }
      >
        <Text style={styles.menuText}>
          Inventory
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() =>
          router.push("/expenses")
        }
      >
        <Text style={styles.menuText}>
          Expenses
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() =>
          router.push("/settings")
        }
      >
        <Text style={styles.menuText}>
          Settings
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: "#00154f",
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  logo: {
    color: "gold",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
  },

  menuItem: {
    backgroundColor: "#01246b",
    padding: 18,
    borderRadius: 14,
    marginBottom: 16,
  },

  menuText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
});