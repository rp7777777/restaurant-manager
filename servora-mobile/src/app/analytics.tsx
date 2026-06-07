import AuthGuard from "./auth-guard";

import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function AnalyticsScreen() {

  const [salesTotal,
    setSalesTotal] =
      useState(0);

  const [expenseTotal,
    setExpenseTotal] =
      useState(0);

  const [profit,
    setProfit] =
      useState(0);

  const [inventoryCount,
    setInventoryCount] =
      useState(0);

  useEffect(() => {

    loadAnalytics();

  }, []);

  const loadAnalytics =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      let sales = 0;
      let expenses = 0;
      let inventory = 0;

      const salesSnapshot =
        await getDocs(
          collection(
            db,
            "sales"
          )
        );

      salesSnapshot.forEach(
        (document) => {

          const item =
            document.data();

          if (
            item.userId ===
            user.uid
          ) {

            sales +=
              Number(
                item.total || 0
              );

          }

        }
      );

      const expenseSnapshot =
        await getDocs(
          collection(
            db,
            "expenses"
          )
        );

      expenseSnapshot.forEach(
        (document) => {

          const item =
            document.data();

          if (
            item.userId ===
            user.uid
          ) {

            expenses +=
              Number(
                item.amount || 0
              );

          }

        }
      );

      const inventorySnapshot =
        await getDocs(
          collection(
            db,
            "inventory"
          )
        );

      inventorySnapshot.forEach(
        (document) => {

          const item =
            document.data();

          if (
            item.userId ===
            user.uid
          ) {

            inventory +=
              Number(
                item.quantity || 0
              );

          }

        }
      );

      setSalesTotal(sales);

      setExpenseTotal(expenses);

      setProfit(
        sales - expenses
      );

      setInventoryCount(
        inventory
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            ANALYTICS
          </Text>

          <Text style={styles.subtitle}>
            Restaurant Business Overview
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            Total Sales
          </Text>

          <Text style={styles.sales}>
            €
            {salesTotal}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            Total Expenses
          </Text>

          <Text style={styles.expense}>
            €
            {expenseTotal}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            Net Profit
          </Text>

          <Text style={styles.profit}>
            €
            {profit}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            Inventory Remaining
          </Text>

          <Text style={styles.inventory}>
            {inventoryCount}
          </Text>

        </View>

        <View style={styles.summaryBox}>

          <Text style={styles.summaryTitle}>
            Business Summary
          </Text>

          <Text style={styles.summaryText}>
            Revenue and profit are
            automatically calculated
            from your sales and
            expense records.
          </Text>

          <Text style={styles.summaryText}>
            Inventory remaining stock
            updates in real-time.
          </Text>

        </View>

      </ScrollView>

    </AuthGuard>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  logo: {
    fontSize: 34,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 8,
    fontSize: 16,
  },

  card: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 28,
    borderRadius: 22,
  },

  cardTitle: {
    fontSize: 18,
    color: "#666",
  },

  sales: {
    fontSize: 38,
    fontWeight: "bold",
    color: "green",
    marginTop: 10,
  },

  expense: {
    fontSize: 38,
    fontWeight: "bold",
    color: "red",
    marginTop: 10,
  },

  profit: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 10,
  },

  inventory: {
    fontSize: 38,
    fontWeight: "bold",
    color: "orange",
    marginTop: 10,
  },

  summaryBox: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 24,
    borderRadius: 22,
    marginBottom: 100,
  },

  summaryTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 16,
  },

  summaryText: {
    fontSize: 16,
    color: "#555",
    lineHeight: 26,
    marginBottom: 12,
  },

});

