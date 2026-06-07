import AuthGuard from "./auth-guard";
import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import { router } from "expo-router";

import { LinearGradient } from "expo-linear-gradient";

import {
  MaterialIcons,
} from "@expo/vector-icons";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase";

export default function DashboardScreen() {

  const [totalSales, setTotalSales] =
    useState(0);

  useEffect(() => {

    const unsubscribe =
      onSnapshot(
        collection(db, "sales"),
        (snapshot) => {

          let total = 0;

          snapshot.forEach((doc) => {

            const data =
              doc.data();

            total += Number(
              data.totalSale || 0
            );

          });

          setTotalSales(total);

        }
      );

    return () =>
      unsubscribe();

  }, []);

  return (
    <AuthGuard>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >

        <LinearGradient
          colors={[
            "#00154f",
            "#0039cb",
          ]}
          style={styles.header}
        >

          <Text style={styles.logo}>
            SERVORA ERP
          </Text>

          <Text style={styles.subtitle}>
            Restaurant Management System
          </Text>

        </LinearGradient>

        <View style={styles.summaryRow}>

          <LinearGradient
            colors={[
              "#00b09b",
              "#96c93d",
            ]}
            style={styles.card}
          >

            <MaterialIcons
              name="point-of-sale"
              size={40}
              color="#fff"
            />

            <Text style={styles.cardTitle}>
              Total Sales
            </Text>

            <Text style={styles.cardValue}>
              €{totalSales}
            </Text>

          </LinearGradient>

          <LinearGradient
            colors={[
              "#11998e",
              "#38ef7d",
            ]}
            style={styles.card}
          >

            <MaterialIcons
              name="trending-up"
              size={40}
              color="#fff"
            />

            <Text style={styles.cardTitle}>
              Net Profit
            </Text>

            <Text style={styles.cardValue}>
              €{totalSales}
            </Text>

          </LinearGradient>

        </View>

        <Text style={styles.sectionTitle}>
          Management
        </Text>

        <View style={styles.grid}>

          <TouchableOpacity
            style={styles.menuCard}
            onPress={() =>
              router.push("/add-sale" as any)
           }
         >
          <MaterialIcons
            name="shopping-cart"
            size={50}
            color="#00154f"
          />

         <Text style={styles.menuText}>
           Sales Entry
         </Text>
       </TouchableOpacity>

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
    paddingTop: 70,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logo: {
    fontSize: 38,
    fontWeight: "bold",
    color: "gold",
  },

  subtitle: {
    color: "#fff",
    fontSize: 18,
    marginTop: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 20,
  },

  card: {
    width: "48%",
    borderRadius: 24,
    padding: 20,
    minHeight: 150,
    justifyContent: "space-between",
  },

  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  cardValue: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 30,
    marginLeft: 20,
    marginBottom: 20,
  },

  grid: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 40,
    alignItems: "center",
  },

  menuText: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
  },

});