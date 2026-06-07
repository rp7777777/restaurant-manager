import AuthGuard from "./auth-guard";

import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function SalesAnalyticsProScreen() {

  const analytics = [

    {
      title:
        "Today's Sales",
      value:
        "€2,450",
    },

    {
      title:
        "Weekly Sales",
      value:
        "€14,800",
    },

    {
      title:
        "Monthly Sales",
      value:
        "€58,300",
    },

    {
      title:
        "Top Product",
      value:
        "Burger Combo",
    },

    {
      title:
        "Orders Today",
      value:
        "186",
    },

    {
      title:
        "Average Bill",
      value:
        "€22",
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
            SALES ANALYTICS
          </Text>

          <Text
            style={styles.subtitle}
          >
            Restaurant Sales Performance
          </Text>

        </View>

        <View
          style={styles.grid}
        >

          {analytics.map(
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

  });

