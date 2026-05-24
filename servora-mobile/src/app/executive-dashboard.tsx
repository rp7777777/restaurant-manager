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
} from "../firebase";

export default function ExecutiveDashboardScreen() {

  const [totalSales,
    setTotalSales] =
      useState(0);

  const [totalOrders,
    setTotalOrders] =
      useState(0);

  const [totalProfit,
    setTotalProfit] =
      useState(0);

  const [topItem,
    setTopItem] =
      useState("");

  const [topWorker,
    setTopWorker] =
      useState("");

  const [businessScore,
    setBusinessScore] =
      useState(0);

  const loadAnalytics =
    async () => {

      try {

        const salesSnapshot =
          await getDocs(
            collection(
              db,
              "sales"
            )
          );

        const ordersSnapshot =
          await getDocs(
            collection(
              db,
              "orders"
            )
          );

        const workersSnapshot =
          await getDocs(
            collection(
              db,
              "workers"
            )
          );

        const expensesSnapshot =
          await getDocs(
            collection(
              db,
              "expenses"
            )
          );

        let sales = 0;

        let expenses = 0;

        const itemMap: any = {};

        salesSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            sales += Number(
              data.amount || 0
            );

          }
        );

        expensesSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            expenses += Number(
              data.amount || 0
            );

          }
        );

        ordersSnapshot.forEach(
          (docItem) => {

            const order: any =
              docItem.data();

            order.items?.forEach(
              (item: any) => {

                if (
                  itemMap[
                    item.name
                  ]
                ) {

                  itemMap[
                    item.name
                  ] +=
                    item.quantity;

                } else {

                  itemMap[
                    item.name
                  ] =
                    item.quantity;

                }

              }
            );

          }
        );

        let bestItem =
          "";

        let bestCount = 0;

        Object.keys(
          itemMap
        ).forEach((key) => {

          if (
            itemMap[key] >
            bestCount
          ) {

            bestCount =
              itemMap[key];

            bestItem =
              key;

          }

        });

        let workerName =
          "";

        if (
          workersSnapshot.docs
            .length > 0
        ) {

          workerName =
            workersSnapshot.docs[0]
              .data()?.name ||
            "No Worker";

        }

        const profit =
          sales - expenses;

        let score = 50;

        if (
          sales > 10000
        ) {

          score += 20;

        }

        if (
          profit > 0
        ) {

          score += 20;

        }

        if (
          ordersSnapshot.size >
          20
        ) {

          score += 10;

        }

        setTotalSales(sales);

        setTotalOrders(
          ordersSnapshot.size
        );

        setTotalProfit(profit);

        setTopItem(bestItem);

        setTopWorker(workerName);

        setBusinessScore(score);

      } catch (error) {

        console.log(error);

      }

    };

  useEffect(() => {

    loadAnalytics();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          EXECUTIVE PRO
        </Text>

        <Text style={styles.subtitle}>
          Enterprise Analytics Dashboard
        </Text>

      </View>

      <View style={styles.statsGrid}>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            TOTAL SALES
          </Text>

          <Text style={styles.green}>
            €{totalSales}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            TOTAL ORDERS
          </Text>

          <Text style={styles.blue}>
            {totalOrders}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            TOTAL PROFIT
          </Text>

          <Text style={styles.green}>
            €{totalProfit}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            BUSINESS SCORE
          </Text>

          <Text style={styles.gold}>
            {businessScore}/100
          </Text>

        </View>

      </View>

      <View style={styles.bigCard}>

        <Text style={styles.bigTitle}>
          TOP SELLING ITEM
        </Text>

        <Text style={styles.bigValue}>
          {topItem || "No Data"}
        </Text>

      </View>

      <View style={styles.bigCard}>

        <Text style={styles.bigTitle}>
          TOP WORKER
        </Text>

        <Text style={styles.bigValue}>
          {topWorker || "No Worker"}
        </Text>

      </View>

      <View style={styles.aiBox}>

        <Text style={styles.aiTitle}>
          AI BUSINESS ANALYSIS
        </Text>

        <Text style={styles.aiText}>
          📈 Sales performance is growing
        </Text>

        <Text style={styles.aiText}>
          🔥 Best selling item:
          {" "}
          {topItem}
        </Text>

        <Text style={styles.aiText}>
          ⚠ Monitor low stock items daily
        </Text>

        <Text style={styles.aiText}>
          👨‍🍳 Increase workers on weekends
        </Text>

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 35,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logo: {
    color: "gold",
    fontSize: 40,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
  },

  card: {
    backgroundColor: "white",
    width: "48%",
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
  },

  cardTitle: {
    fontSize: 16,
    color: "#666",
    fontWeight: "bold",
  },

  green: {
    fontSize: 34,
    fontWeight: "bold",
    color: "green",
    marginTop: 18,
  },

  blue: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#2196f3",
    marginTop: 18,
  },

  gold: {
    fontSize: 34,
    fontWeight: "bold",
    color: "gold",
    marginTop: 18,
  },

  bigCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 28,
    borderRadius: 24,
  },

  bigTitle: {
    fontSize: 20,
    color: "#555",
    fontWeight: "bold",
  },

  bigValue: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 20,
  },

  aiBox: {
    backgroundColor: "#00154f",
    margin: 20,
    padding: 28,
    borderRadius: 24,
    marginBottom: 100,
  },

  aiTitle: {
    color: "gold",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },

  aiText: {
    color: "white",
    fontSize: 18,
    marginBottom: 16,
    lineHeight: 28,
  },

});

