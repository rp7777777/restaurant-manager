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

export default function AIInsightsScreen() {

  const [insights, setInsights] =
    useState<string[]>([]);

  const loadInsights =
    async () => {

      try {

        const salesSnapshot =
          await getDocs(
            collection(
              db,
              "sales"
            )
          );

        const inventorySnapshot =
          await getDocs(
            collection(
              db,
              "inventory"
            )
          );

        const orderSnapshot =
          await getDocs(
            collection(
              db,
              "orders"
            )
          );

        const workerSnapshot =
          await getDocs(
            collection(
              db,
              "workers"
            )
          );

        const messages: string[] = [];

        let totalSales = 0;

        const itemMap: any = {};

        salesSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            totalSales += Number(
              data.amount || 0
            );

          }
        );

        if (
          totalSales > 10000
        ) {

          messages.push(
            "🔥 Sales performance is very strong this month"
          );

        } else {

          messages.push(
            "⚠ Sales are lower than expected"
          );

        }

        inventorySnapshot.forEach(
          (docItem) => {

            const item: any =
              docItem.data();

            if (
              Number(
                item.quantity
              ) <=
              Number(
                item.minimumStock
              )
            ) {

              messages.push(
                `⚠ ${item.ingredient} stock may finish soon`
              );

            }

          }
        );

        orderSnapshot.forEach(
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
          "No Data";

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

        messages.push(
          `🔥 Top selling item is ${bestItem}`
        );

        if (
          workerSnapshot.size <
          5
        ) {

          messages.push(
            "⚠ You may need more workers for smooth operations"
          );

        } else {

          messages.push(
            "✅ Worker count is healthy"
          );

        }

        messages.push(
          "📈 Friday and weekend sales are usually highest"
        );

        messages.push(
          "🧠 AI suggests checking low stock items daily"
        );

        setInsights(messages);

      } catch (error) {

        console.log(error);

      }

    };

  useEffect(() => {

    loadInsights();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          AI INSIGHTS
        </Text>

        <Text style={styles.subtitle}>
          Smart Business Intelligence
        </Text>

      </View>

      <View style={styles.content}>

        {insights.map(
          (
            item,
            index
          ) => (

            <View
              key={index}
              style={styles.card}
            >

              <Text style={styles.message}>
                {item}
              </Text>

            </View>

          )
        )}

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 35,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logo: {
    color: "gold",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },

  content: {
    padding: 20,
    paddingBottom: 80,
  },

  card: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
    borderLeftWidth: 8,
    borderLeftColor: "#00154f",
  },

  message: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    lineHeight: 30,
  },

});

