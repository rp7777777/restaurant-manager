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

export default function AnalyticsScreen() {

  const [totalSales, setTotalSales] =
    useState(0);

  const [totalExpenses, setTotalExpenses] =
    useState(0);

  const [profit, setProfit] =
    useState(0);

  const [topKitchen, setTopKitchen] =
    useState("");

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

        const expenseSnapshot =
          await getDocs(
            collection(
              db,
              "expenses"
            )
          );

        let salesTotal = 0;

        let expenseTotal = 0;

        const kitchenMap: any = {};

        salesSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            salesTotal += Number(
              data.amount || 0
            );

            if (
              kitchenMap[
                data.kitchen
              ]
            ) {

              kitchenMap[
                data.kitchen
              ] += Number(
                data.amount
              );

            } else {

              kitchenMap[
                data.kitchen
              ] = Number(
                data.amount
              );

            }

          }
        );

        expenseSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            expenseTotal += Number(
              data.amount || 0
            );

          }
        );

        let highestKitchen = "";

        let highestAmount = 0;

        Object.keys(
          kitchenMap
        ).forEach((key) => {

          if (
            kitchenMap[key] >
            highestAmount
          ) {

            highestAmount =
              kitchenMap[key];

            highestKitchen =
              key;

          }

        });

        setTotalSales(
          salesTotal
        );

        setTotalExpenses(
          expenseTotal
        );

        setProfit(
          salesTotal -
          expenseTotal
        );

        setTopKitchen(
          highestKitchen
        );

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
          ANALYTICS
        </Text>

        <Text style={styles.subtitle}>
          Global Restaurant ERP
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.label}>
          Total Sales
        </Text>

        <Text style={styles.green}>
          €{totalSales}
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.label}>
          Total Expenses
        </Text>

        <Text style={styles.red}>
          €{totalExpenses}
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.label}>
          Net Profit
        </Text>

        <Text style={styles.green}>
          €{profit}
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.label}>
          Top Kitchen
        </Text>

        <Text style={styles.blue}>
          {topKitchen || "No Data"}
        </Text>

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
    fontSize: 38,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },

  card: {
    backgroundColor: "white",
    margin: 20,
    padding: 28,
    borderRadius: 24,
    elevation: 4,
  },

  label: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 12,
  },

  green: {
    color: "green",
    fontSize: 34,
    fontWeight: "bold",
  },

  red: {
    color: "red",
    fontSize: 34,
    fontWeight: "bold",
  },

  blue: {
    color: "#0057ff",
    fontSize: 34,
    fontWeight: "bold",
  },

});

