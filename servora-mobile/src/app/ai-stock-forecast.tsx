import AuthGuard from "./auth-guard";

import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";

export default function AiStockForecastScreen() {

  const [itemName,
    setItemName] =
      useState("");

  const [currentStock,
    setCurrentStock] =
      useState("");

  const [dailyUsage,
    setDailyUsage] =
      useState("");

  const [forecast,
    setForecast] =
      useState<any | null>(
        null
      );

  const generateForecast =
    () => {

      if (
        !itemName ||
        !currentStock ||
        !dailyUsage
      ) {

        return;

      }

      const stock =
        Number(
          currentStock
        );

      const usage =
        Number(
          dailyUsage
        );

      const daysLeft =
        Math.floor(
          stock / usage
        );

      let status =
        "GOOD";

      if (
        daysLeft <= 3
      ) {

        status =
          "CRITICAL";

      } else if (
        daysLeft <= 7
      ) {

        status =
          "LOW";

      }

      setForecast({

        itemName,

        stock,

        usage,

        daysLeft,

        status,

      });

    };

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
            AI STOCK FORECAST
          </Text>

          <Text
            style={styles.subtitle}
          >
            Predict Inventory Usage
          </Text>

        </View>

        <View
          style={styles.form}
        >

          <TextInput
            style={styles.input}
            placeholder="Item Name"
            value={itemName}
            onChangeText={
              setItemName
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Current Stock"
            keyboardType="numeric"
            value={currentStock}
            onChangeText={
              setCurrentStock
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Daily Usage"
            keyboardType="numeric"
            value={dailyUsage}
            onChangeText={
              setDailyUsage
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              generateForecast
            }
          >

            <Text
              style={styles.buttonText}
            >
              GENERATE FORECAST
            </Text>

          </TouchableOpacity>

        </View>

        {forecast && (

          <View
            style={styles.resultCard}
          >

            <Text
              style={styles.resultTitle}
            >
              FORECAST RESULT
            </Text>

            <Text
              style={styles.info}
            >
              Item:
              {" "}
              {forecast.itemName}
            </Text>

            <Text
              style={styles.info}
            >
              Current Stock:
              {" "}
              {forecast.stock}
            </Text>

            <Text
              style={styles.info}
            >
              Daily Usage:
              {" "}
              {forecast.usage}
            </Text>

            <Text
              style={styles.info}
            >
              Remaining Days:
              {" "}
              {forecast.daysLeft}
            </Text>

            <Text
              style={[

                styles.status,

                {
                  color:

                    forecast.status ===
                    "CRITICAL"

                      ? "red"

                      : forecast.status ===
                        "LOW"

                      ? "orange"

                      : "green",
                },

              ]}
            >
              {forecast.status}
            </Text>

          </View>

        )}

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

    form: {
      padding: 20,
    },

    input: {
      backgroundColor:
        "white",
      padding: 18,
      borderRadius: 18,
      marginBottom: 18,
      fontSize: 18,
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 22,
      borderRadius: 18,
      alignItems: "center",
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

    resultCard: {
      backgroundColor:
        "white",
      margin: 20,
      padding: 28,
      borderRadius: 24,
      marginBottom: 100,
    },

    resultTitle: {
      fontSize: 26,
      fontWeight: "bold",
      color: "#00154f",
      marginBottom: 20,
    },

    info: {
      fontSize: 18,
      color: "#555",
      marginBottom: 14,
    },

    status: {
      fontSize: 28,
      fontWeight: "bold",
      marginTop: 20,
      textAlign: "center",
    },

  });
