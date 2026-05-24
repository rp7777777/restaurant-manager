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

import QRCode from "react-native-qrcode-svg";

import * as Print from "expo-print";

import * as Sharing from "expo-sharing";

export default function QRGeneratorScreen() {

  const [branchName,
    setBranchName] =
      useState("");

  const [tableName,
    setTableName] =
      useState("");

  const generateQRValue =
    () => {

      return JSON.stringify({

        branch:
          branchName,

        table:
          tableName,

        type:
          "SERVORA_QR",

      });

    };

  const printQR =
    async () => {

      if (
        !branchName ||
        !tableName
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const qrData =
        generateQRValue();

      const html = `
        <html>

        <body style="
          font-family: Arial;
          text-align: center;
          padding: 40px;
        ">

          <h1>
            SERVORA ERP
          </h1>

          <h2>
            QR Table Card
          </h2>

          <hr />

          <h3>
            ${branchName}
          </h3>

          <h1>
            ${tableName}
          </h1>

          <p>
            Scan to Order
          </p>

          <div style="
            margin-top: 30px;
          ">

            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                qrData
              )}"
            />

          </div>

          <br />
          <br />

          <p>
            Powered by SERVORA
          </p>

        </body>

        </html>
      `;

      try {

        const file =
          await Print.printToFileAsync({
            html,
          });

        await Sharing.shareAsync(
          file.uri
        );

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          QR GENERATOR
        </Text>

        <Text style={styles.subtitle}>
          Smart Table QR System
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Branch Name"
          value={branchName}
          onChangeText={
            setBranchName
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Table Name"
          value={tableName}
          onChangeText={
            setTableName
          }
        />

        {branchName &&
          tableName && (

          <View style={styles.qrBox}>

            <QRCode
              value={
                generateQRValue()
              }
              size={240}
            />

            <Text style={styles.qrText}>
              {branchName}
            </Text>

            <Text style={styles.qrTable}>
              {tableName}
            </Text>

          </View>

        )}

        <TouchableOpacity
          style={styles.printButton}
          onPress={printQR}
        >

          <Text style={styles.printText}>
            PRINT QR CARD
          </Text>

        </TouchableOpacity>

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  header: {
    backgroundColor: "#00154f",
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

  form: {
    padding: 20,
    paddingBottom: 80,
  },

  input: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    fontSize: 18,
    marginBottom: 18,
  },

  qrBox: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 20,
  },

  qrText: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
  },

  qrTable: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: "bold",
    color: "green",
  },

  printButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 30,
  },

  printText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

});

