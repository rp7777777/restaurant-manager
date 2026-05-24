import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SERVORA 🚀</Text>

      <Text style={styles.subTitle}>
        Restaurant ERP Mobile
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          App Working Successfully 😭🔥
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#001B5E",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFD700",
    marginBottom: 10,
  },

  subTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    marginBottom: 40,
  },

  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#001B5E",
  },
});

