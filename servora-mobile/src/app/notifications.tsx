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

export default function NotificationsScreen() {

  const [notifications, setNotifications] =
    useState<any[]>([]);

  const loadNotifications =
    async () => {

      try {

        const orderSnapshot =
          await getDocs(
            collection(
              db,
              "orders"
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

        const data: any[] = [];

        orderSnapshot.forEach(
          (docItem) => {

            const order: any =
              docItem.data();

            data.push({
              type: "ORDER",
              message:
                `New order from Table ${order.tableNumber}`,
              createdAt:
                order.createdAt,
            });

            if (
              order.status ===
              "READY"
            ) {

              data.push({
                type: "READY",
                message:
                  `Order ready for Table ${order.tableNumber}`,
                createdAt:
                  order.createdAt,
              });

            }

          }
        );

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

              data.push({
                type: "LOW_STOCK",
                message:
                  `${item.ingredient} stock is low`,
                createdAt:
                  item.createdAt,
              });

            }

          }
        );

        payrollSnapshot.forEach(
          (docItem) => {

            const payroll: any =
              docItem.data();

            if (
              !payroll.paid
            ) {

              data.push({
                type: "PAYROLL",
                message:
                  `${payroll.workerName} payroll pending`,
                createdAt:
                  payroll.createdAt,
              });

            }

          }
        );

        data.sort(
          (a, b) => {

            const first =
              a.createdAt
                ?.toDate?.()
                ?.getTime?.() || 0;

            const second =
              b.createdAt
                ?.toDate?.()
                ?.getTime?.() || 0;

            return second - first;

          }
        );

        setNotifications(data);

      } catch (error) {

        console.log(error);

      }

    };

  useEffect(() => {

    loadNotifications();

    const interval =
      setInterval(() => {

        loadNotifications();

      }, 5000);

    return () =>
      clearInterval(interval);

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          NOTIFICATIONS
        </Text>

        <Text style={styles.subtitle}>
          Real-Time Alert Center
        </Text>

      </View>

      <View style={styles.content}>

        {notifications.map(
          (
            item,
            index
          ) => {

            const isOrder =
              item.type ===
              "ORDER";

            const isReady =
              item.type ===
              "READY";

            const isLowStock =
              item.type ===
              "LOW_STOCK";

            const isPayroll =
              item.type ===
              "PAYROLL";

            return (

              <View
                key={index}
                style={[

                  styles.card,

                  isOrder &&
                  styles.orderCard,

                  isReady &&
                  styles.readyCard,

                  isLowStock &&
                  styles.lowStockCard,

                  isPayroll &&
                  styles.payrollCard,

                ]}
              >

                <Text style={styles.message}>
                  {item.message}
                </Text>

                <Text style={styles.date}>

                  {
                    item.createdAt
                      ?.toDate?.()
                      ?.toLocaleString?.()
                  }

                </Text>

              </View>

            );

          }
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
    borderRadius: 22,
    marginBottom: 20,
  },

  orderCard: {
    borderLeftWidth: 8,
    borderLeftColor: "#0057ff",
  },

  readyCard: {
    borderLeftWidth: 8,
    borderLeftColor: "green",
  },

  lowStockCard: {
    borderLeftWidth: 8,
    borderLeftColor: "red",
  },

  payrollCard: {
    borderLeftWidth: 8,
    borderLeftColor: "#ff9800",
  },

  message: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
  },

  date: {
    marginTop: 12,
    color: "gray",
    fontSize: 15,
  },

});

