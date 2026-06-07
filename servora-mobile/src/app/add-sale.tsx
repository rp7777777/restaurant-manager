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
  Alert,
} from "react-native";

import { router } from "expo-router";

import {
  createSale,
} from "./services/sales-service";

export default function AddSaleScreen() {

  const [date] =
    useState(
      new Date()
        .toISOString()
        .split("T")[0]
    );

  const [morningSale,
    setMorningSale] =
    useState("");

  const [afternoonSale,
    setAfternoonSale] =
    useState("");

  const [nightSale,
    setNightSale] =
    useState("");

  const [paymentMethod,
    setPaymentMethod] =
    useState("Cash");

  const [note,
    setNote] =
    useState("");

  const totalSale =

    Number(
      morningSale || 0
    ) +

    Number(
      afternoonSale || 0
    ) +

    Number(
      nightSale || 0
    );

  const saveDailySale =
    async () => {

      try {

        if (
          totalSale <= 0
        ) {

          Alert.alert(
            "Error",
            "Enter sales amount"
          );

          return;

        }

        await createSale({
          date,

          morningSale:
            Number(
              morningSale || 0
            ),

          afternoonSale:
            Number(
              afternoonSale || 0
            ),

          nightSale:
            Number(
              nightSale || 0
            ),

          totalSale,

          paymentMethod,

          note,
        });

        Alert.alert(
          "Success",
          "Daily Sales Saved"
        );

        router.push(
          "/sales" as any
        );

      } catch (error: any) {

        console.log(
          "SALE ERROR",
          error
        );

        Alert.alert(
          "Error",
          String(error)
        );

      }

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
            DAILY SALES
          </Text>

          <Text
            style={styles.subtitle}
          >
            Shift Sales Entry
          </Text>

        </View>

        <View
          style={styles.form}
        >

          <Text
            style={styles.date}
          >
            Date: {date}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Morning Sale (€)"
            keyboardType="numeric"
            value={morningSale}
            onChangeText={
              setMorningSale
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Afternoon Sale (€)"
            keyboardType="numeric"
            value={afternoonSale}
            onChangeText={
              setAfternoonSale
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Night Sale (€)"
            keyboardType="numeric"
            value={nightSale}
            onChangeText={
              setNightSale
            }
          />

          <Text
            style={styles.label}
          >
            Payment Method
          </Text>

          <View
            style={styles.paymentRow}
          >

            {[
              "Cash",
              "Card",
              "MBWay",
              "Other",
            ].map(
              (
                item
              ) => (

                <TouchableOpacity
                  key={item}
                  style={[
                    styles.paymentButton,

                    paymentMethod ===
                      item &&
                      styles.activePayment,
                  ]}
                  onPress={() =>
                    setPaymentMethod(
                      item
                    )
                  }
                >

                  <Text
                    style={[
                      styles.paymentText,

                      paymentMethod ===
                        item &&
                        styles.activePaymentText,
                    ]}
                  >
                    {item}
                  </Text>

                </TouchableOpacity>

              )
            )}

          </View>

          <TextInput
            style={[
              styles.input,
              styles.noteInput,
            ]}
            placeholder="Notes"
            value={note}
            onChangeText={
              setNote
            }
            multiline
          />

          <View
            style={styles.totalBox}
          >

            <Text
              style={styles.totalLabel}
            >
              Total Sale
            </Text>

            <Text
              style={styles.totalValue}
            >
              €{totalSale}
            </Text>

          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveDailySale
            }
          >

            <Text
              style={styles.buttonText}
            >
              SAVE SALES
            </Text>

          </TouchableOpacity>

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
      padding: 25,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },

    logo: {
      color: "gold",
      fontSize: 32,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "#fff",
      marginTop: 8,
      fontSize: 16,
    },

    form: {
      padding: 20,
    },

    date: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#00154f",
      marginBottom: 20,
    },

    label: {
      fontSize: 16,
      fontWeight: "bold",
      marginBottom: 10,
      color: "#00154f",
    },

    input: {
      backgroundColor:
        "#fff",
      padding: 18,
      borderRadius: 15,
      marginBottom: 15,
      fontSize: 16,
    },

    noteInput: {
      height: 100,
      textAlignVertical:
        "top",
    },

    paymentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 15,
    },

    paymentButton: {
      backgroundColor:
        "#fff",
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 10,
      marginRight: 10,
      marginBottom: 10,
    },

    activePayment: {
      backgroundColor:
        "#00154f",
    },

    paymentText: {
      color: "#00154f",
      fontWeight: "600",
    },

    activePaymentText: {
      color: "#fff",
    },

    totalBox: {
      backgroundColor:
        "#fff",
      padding: 20,
      borderRadius: 15,
      marginBottom: 20,
    },

    totalLabel: {
      fontSize: 16,
      color: "#666",
    },

    totalValue: {
      fontSize: 32,
      fontWeight: "bold",
      color: "green",
      marginTop: 10,
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 18,
      borderRadius: 15,
      alignItems: "center",
    },

    buttonText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "bold",
    },

  });