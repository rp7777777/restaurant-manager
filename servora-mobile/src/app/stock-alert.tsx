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

export default function StockAlertScreen() {

  const [alerts,
    setAlerts] =
      useState<any[]>([]);

  useEffect(() => {

    loadAlerts();

  }, []);

  const loadAlerts =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const snapshot =
        await getDocs(
          collection(
            db,
            "inventory"
          )
        );

      const lowStock:
        any[] = [];

      snapshot.forEach(
        (document) => {

          const item =
            document.data();

          if (
            item.userId ===
            user.uid
          ) {

            const current =
              Number(
                item.currentStock || 0
              );

            const minimum =
              Number(
                item.minimumStock || 0
              );

            if (
              current <= minimum
            ) {

              lowStock.push({

                itemName:
                  item.itemName,

                currentStock:
                  current,

                minimumStock:
                  minimum,

              });

            }

          }

        }
      );

      setAlerts(lowStock);

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            LOW STOCK ALERT
          </Text>

          <Text style={styles.subtitle}>
            Inventory Warning System
          </Text>

        </View>

        {alerts.length === 0 && (

          <Text style={styles.safe}>
            All Inventory Safe
          </Text>

        )}

        {alerts.map(
          (
            item,
            index
          ) => (

            <View
              key={index}
              style={styles.alertCard}
            >

              <Text style={styles.itemName}>
                {item.itemName}
              </Text>

              <Text style={styles.stock}>
                Current Stock:
                {" "}
                {item.currentStock}
              </Text>

              <Text style={styles.minimum}>
                Minimum Required:
                {" "}
                {item.minimumStock}
              </Text>

              <Text style={styles.warning}>
                ⚠ LOW STOCK WARNING
              </Text>

            </View>

          )
        )}

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
    backgroundColor: "#8b0000",
    padding: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },

  safe: {
    fontSize: 24,
    color: "green",
    textAlign: "center",
    marginTop: 80,
    fontWeight: "bold",
  },

  alertCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 24,
    borderRadius: 20,
    borderLeftWidth: 8,
    borderLeftColor: "red",
  },

  itemName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
  },

  stock: {
    fontSize: 18,
    color: "#444",
    marginTop: 12,
  },

  minimum: {
    fontSize: 18,
    color: "#444",
    marginTop: 8,
  },

  warning: {
    color: "red",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 18,
  },

});

