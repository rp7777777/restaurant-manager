import AuthGuard from "./auth-guard";

import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

export default function CustomerAppScreen() {

  const [orders] =
    useState([

      {
        id: 1,
        item:
          "Burger Combo",
        status:
          "Preparing",
      },

      {
        id: 2,
        item:
          "Pizza Large",
        status:
          "Delivered",
      },

      {
        id: 3,
        item:
          "Cold Coffee",
        status:
          "Pending",
      },

    ]);

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            CUSTOMER APP
          </Text>

          <Text style={styles.subtitle}>
            Customer Order Tracking
          </Text>

        </View>

        <View style={styles.banner}>

          <Text style={styles.bannerTitle}>
            Welcome To SERVORA
          </Text>

          <Text style={styles.bannerText}>
            Track your restaurant
            orders live
          </Text>

        </View>

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            ACTIVE ORDERS
          </Text>

          {orders.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.item}>
                  {item.item}
                </Text>

                <Text style={styles.status}>
                  Status:
                  {" "}
                  {item.status}
                </Text>

              </View>

            )
          )}

        </View>

        <TouchableOpacity
          style={styles.button}
        >

          <Text style={styles.buttonText}>
            PLACE NEW ORDER
          </Text>

        </TouchableOpacity>

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
      fontSize: 36,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 10,
    },

    banner: {
      backgroundColor:
        "white",
      margin: 20,
      padding: 28,
      borderRadius: 24,
      alignItems: "center",
    },

    bannerTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#00154f",
    },

    bannerText: {
      fontSize: 18,
      marginTop: 12,
      color: "#555",
      textAlign: "center",
    },

    section: {
      padding: 20,
      paddingTop: 0,
    },

    sectionTitle: {
      fontSize: 26,
      fontWeight: "bold",
      color: "#00154f",
      marginBottom: 20,
    },

    card: {
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 18,
    },

    item: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#00154f",
    },

    status: {
      fontSize: 18,
      marginTop: 12,
      color: "#444",
    },

    button: {
      backgroundColor:
        "#00154f",
      margin: 20,
      padding: 22,
      borderRadius: 18,
      alignItems: "center",
      marginBottom: 100,
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

  });

