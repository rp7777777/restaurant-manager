import AuthGuard from "./auth-guard";

import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function ExecutiveDashboardScreen() {

  const stats = [

    {
      title:
        "Total Revenue",
      value:
        "€124,500",
    },

    {
      title:
        "Net Profit",
      value:
        "€48,200",
    },

    {
      title:
        "Total Orders",
      value:
        "5,820",
    },

    {
      title:
        "Employees",
      value:
        "84",
    },

    {
      title:
        "Branches",
      value:
        "12",
    },

    {
      title:
        "Customers",
      value:
        "18,450",
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
            EXECUTIVE DASHBOARD
          </Text>

          <Text
            style={styles.subtitle}
          >
            SERVORA Business Overview
          </Text>

        </View>

        <View
          style={styles.grid}
        >

          {stats.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.card}
              >

                <Text
                  style={styles.cardTitle}
                >
                  {item.title}
                </Text>

                <Text
                  style={styles.cardValue}
                >
                  {item.value}
                </Text>

              </View>

            )
          )}

        </View>

        <View
          style={styles.summaryBox}
        >

          <Text
            style={styles.summaryTitle}
          >
            BUSINESS SUMMARY
          </Text>

          <Text
            style={styles.summaryText}
          >
            Restaurant performance
            is growing strongly with
            increased revenue,
            customer engagement,
            and operational efficiency.
          </Text>

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
      fontSize: 34,
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
    },

    card: {
      width: "48%",
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 20,
      alignItems: "center",
      justifyContent:
        "center",
      minHeight: 150,
    },

    cardTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#555",
      textAlign: "center",
    },

    cardValue: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#00154f",
      marginTop: 16,
      textAlign: "center",
    },

    summaryBox: {
      backgroundColor:
        "white",
      margin: 20,
      padding: 28,
      borderRadius: 24,
      marginBottom: 100,
    },

    summaryTitle: {
      fontSize: 26,
      fontWeight: "bold",
      color: "#00154f",
      marginBottom: 18,
    },

    summaryText: {
      fontSize: 18,
      color: "#555",
      lineHeight: 30,
    },

  });

