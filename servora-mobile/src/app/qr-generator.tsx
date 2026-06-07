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

import QRCode
from "react-native-qrcode-svg";

export default function QrGeneratorScreen() {

  const [tableNumber,
    setTableNumber] =
      useState("");

  const [generated,
    setGenerated] =
      useState(false);

  const generateQR =
    () => {

      if (!tableNumber) {

        Alert.alert(
          "Error",
          "Enter table number"
        );

        return;

      }

      setGenerated(true);

    };

  return (

    <AuthGuard>

      <ScrollView
        contentContainerStyle={
          styles.container
        }
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            QR GENERATOR
          </Text>

          <Text style={styles.subtitle}>
            Restaurant Table QR System
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Enter Table Number"
            value={tableNumber}
            onChangeText={
              setTableNumber
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={generateQR}
          >

            <Text style={styles.buttonText}>
              GENERATE QR
            </Text>

          </TouchableOpacity>

        </View>

        {generated && (

          <View style={styles.qrContainer}>

            <QRCode
              value={
                "Table-" +
                tableNumber
              }
              size={240}
            />

            <Text style={styles.qrText}>
              Table QR:
              {" "}
              {tableNumber}
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
      flexGrow: 1,
      backgroundColor:
        "#eef2f7",
      alignItems: "center",
      paddingBottom: 100,
    },

    header: {
      width: "100%",
      backgroundColor:
        "#00154f",
      padding: 35,
      borderBottomLeftRadius: 35,
      borderBottomRightRadius: 35,
      alignItems: "center",
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

    form: {
      width: "90%",
      marginTop: 30,
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

    qrContainer: {
      backgroundColor:
        "white",
      padding: 30,
      borderRadius: 30,
      marginTop: 40,
      alignItems: "center",
    },

    qrText: {
      fontSize: 22,
      fontWeight: "bold",
      marginTop: 25,
      color: "#00154f",
    },

  });

