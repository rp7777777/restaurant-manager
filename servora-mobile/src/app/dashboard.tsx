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

export default function DashboardScreen() {

  const [todaySales, setTodaySales] =
    useState(0);

  const [todayOrders, setTodayOrders] =
    useState(0);

  const [workers, setWorkers] =
    useState(0);

  const [lowStock, setLowStock] =
    useState(0);

  const [pendingPayroll, setPendingPayroll] =
    useState(0);

  const [topItem, setTopItem] =
    useState("No Data");

  const loadDashboard =
    async () => {

      try {

        const salesSnapshot =
          await getDocs(
            collection(
              db,
              "sales"
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

        const inventorySnapshot =
          await getDocs(
            collection(
              db,
              "inventory"
            )
          );

        const payrollSnapshot =
          await getDocs(
            collection(
              db,
              "payroll"
            )
          );

        let salesTotal = 0;

        let lowStockCount = 0;

        let unpaidCount = 0;

        const itemMap: any = {};

        salesSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            salesTotal += Number(
              data.amount || 0
            );

          }
        );

        inventorySnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            if (
              Number(
                data.quantity
              ) <=
              Number(
                data.minimumStock
              )
            ) {

              lowStockCount++;

            }

          }
        );

        payrollSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            if (!data.paid) {

              unpaidCount++;

            }

          }
        );

        orderSnapshot.forEach(
          (docItem) => {

            const data: any =
              docItem.data();

            data.items?.forEach(
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

        let highestItem =
          "No Data";

        let highestCount = 0;

        Object.keys(
          itemMap
        ).forEach((key) => {

          if (
            itemMap[key] >
            highestCount
          ) {

            highestCount =
              itemMap[key];

            highestItem =
              key;

          }

        });

        setTodaySales(
          salesTotal
        );

        setTodayOrders(
          orderSnapshot.size
        );

        setWorkers(
          workerSnapshot.size
        );

        setLowStock(
          lowStockCount
        );

        setPendingPayroll(
          unpaidCount
        );

        setTopItem(
          highestItem
        );

      } catch (error) {

        console.log(error);

      }

    };

  useEffect(() => {

    loadDashboard();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          SERVORA ERP
        </Text>

        <Text style={styles.subtitle}>
          Executive Dashboard
        </Text>

      </View>

      <View style={styles.grid}>

        <View style={styles.card}>

          <Text style={styles.label}>
            Today Sales
          </Text>

          <Text style={styles.green}>
            €{todaySales}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.label}>
            Orders
          </Text>

          <Text style={styles.blue}>
            {todayOrders}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.label}>
            Workers
          </Text>

          <Text style={styles.blue}>
            {workers}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.label}>
            Low Stock
          </Text>

          <Text style={styles.red}>
            {lowStock}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.label}>
            Pending Payroll
          </Text>

          <Text style={styles.red}>
            {pendingPayroll}
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.label}>
            Top Selling Item
          </Text>

          <Text style={styles.green}>
            {topItem}
          </Text>

        </View>

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

  grid: {
    padding: 20,
  },

  card: {
    backgroundColor: "white",
    padding: 28,
    borderRadius: 24,
    marginBottom: 22,
  },

  label: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 14,
  },

  green: {
    color: "green",
    fontSize: 34,
    fontWeight: "bold",
  },

  blue: {
    color: "#0057ff",
    fontSize: 34,
    fontWeight: "bold",
  },

  red: {
    color: "red",
    fontSize: 34,
    fontWeight: "bold",
  },

});

