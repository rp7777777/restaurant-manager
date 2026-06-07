import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import SidebarScreen
from "./sidebar";

import AuthGuard
from "./auth-guard";

export default function DashboardScreen() {

  const router =
    useRouter();

  const menus = [

    {
      title:
        "Inventory PRO",
      route:
        "/inventory-pro",
    },

    {
      title:
        "Expense PRO",
      route:
        "/expense-pro",
    },

    {
      title:
        "Billing PRO",
      route:
        "/billing-pro",
    },

    {
      title:
        "Loyalty PRO",
      route:
        "/loyalty-pro",
    },

    {
      title:
        "Workers",
      route:
        "/workers",
    },

    {
      title:
        "Sales Analytics",
      route:
        "/sales-analytics-pro",
    },

    {
      title:
        "Attendance PRO",
      route:
        "/attendance-pro",
    },

    {
      title:
        "Salary Slip",
      route:
        "/salary-slip",
    },

  ];

  return (

    <AuthGuard>

      <View
        style={styles.mainContainer}
      >

        <View
          style={styles.sidebar}
        >

          <SidebarScreen />

        </View>

        <ScrollView
          style={styles.container}
        >

          <View style={styles.header}>

            <Text style={styles.logo}>
              SERVORA ERP
            </Text>

            <Text style={styles.subtitle}>
              Executive Dashboard
            </Text>

          </View>

          <View style={styles.grid}>

            {menus.map(
              (
                item,
                index
              ) => (

                <TouchableOpacity
                  key={index}
                  style={styles.card}
                  onPress={() =>
                    router.push(
                      item.route as any
                    )
                  }
                >

                  <Text style={styles.cardTitle}>
                    {item.title}
                  </Text>

                </TouchableOpacity>

              )
            )}

          </View>

        </ScrollView>

      </View>

    </AuthGuard>

  );

}

const styles =
  StyleSheet.create({

    mainContainer: {
      flex: 1,
      flexDirection: "row",
      backgroundColor:
        "#eef2f7",
    },

    sidebar: {
      width: 320,
      backgroundColor:
        "#eef2f7",
    },

    container: {
      flex: 1,
      backgroundColor:
        "#eef2f7",
    },

    header: {
      backgroundColor:
        "#00154f",
      padding: 35,
      borderBottomLeftRadius: 35,
      borderBottomRightRadius: 35,
    },

    logo: {
      color: "gold",
      fontSize: 42,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 10,
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent:
        "space-between",
      padding: 20,
      paddingBottom: 100,
    },

    card: {
      width: "48%",
      backgroundColor:
        "white",
      padding: 28,
      borderRadius: 24,
      marginBottom: 20,
      justifyContent:
        "center",
      alignItems: "center",
      minHeight: 140,
    },

    cardTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#00154f",
      textAlign: "center",
    },

  });

