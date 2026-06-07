import AuthGuard from "./auth-guard";

import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function AiInsightsScreen() {

  const insights = [

    {
      title:
        "Sales Growth",
      message:
        "Sales increased by 18% this week compared to last week.",
    },

    {
      title:
        "Top Product",
      message:
        "Burger Combo is currently the best-selling menu item.",
    },

    {
      title:
        "Low Inventory",
      message:
        "Chicken stock may run out within 3 days.",
    },

    {
      title:
        "Peak Hours",
      message:
        "Highest customer traffic occurs between 7 PM and 9 PM.",
    },

    {
      title:
        "Profit Insight",
      message:
        "Net profit margin improved by 12% this month.",
    },

    {
      title:
        "Customer Trend",
      message:
        "Returning customers increased significantly this week.",
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
            AI INSIGHTS
          </Text>

          <Text
            style={styles.subtitle}
          >
            Smart Restaurant Intelligence
          </Text>

        </View>

        <View
          style={styles.listContainer}
        >

          {insights.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.card}
              >

                <Text
                  style={styles.title}
                >
                  {item.title}
                </Text>

                <Text
                  style={styles.message}
                >
                  {item.message}
                </Text>

              </View>

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
      fontSize: 34,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 10,
    },

    listContainer: {
      padding: 20,
      paddingBottom: 100,
    },

    card: {
      backgroundColor:
        "white",
      padding: 26,
      borderRadius: 24,
      marginBottom: 20,
    },

    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
      marginBottom: 14,
    },

    message: {
      fontSize: 18,
      color: "#555",
      lineHeight: 30,
    },

  });

