import AuthGuard from "./auth-guard";

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

export default function ExploreScreen() {

  const router =
    useRouter();

  const modules = [

    {
      title:
        "Inventory",
      route:
        "/inventory",
    },

    {
      title:
        "Sales",
      route:
        "/sales",
    },

    {
      title:
        "Billing",
      route:
        "/billing",
    },

    {
      title:
        "Payroll",
      route:
        "/payroll",
    },

    {
      title:
        "Kitchen",
      route:
        "/kitchen",
    },

    {
      title:
        "Expenses",
      route:
        "/expenses",
    },

    {
      title:
        "Reservations",
      route:
        "/reservation-pro",
    },

    {
      title:
        "Delivery",
      route:
        "/delivery-pro",
    },

    {
      title:
        "Suppliers",
      route:
        "/suppliers",
    },

    {
      title:
        "POS System",
      route:
        "/pos",
    },

  ];

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View
          style={styles.header}
        >

          <Text
            style={styles.logo}
          >
            EXPLORE
          </Text>

          <Text
            style={styles.subtitle}
          >
            Explore SERVORA Modules
          </Text>

        </View>

        <View
          style={styles.grid}
        >

          {modules.map(
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

                <Text
                  style={styles.cardTitle}
                >
                  {item.title}
                </Text>

              </TouchableOpacity>

            )
          )}

        </View>

      </ScrollView>

    </AuthGuard>

  );

}

const styles =
  StyleSheet.create({

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

