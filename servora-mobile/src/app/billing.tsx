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

import * as Print from "expo-print";

import * as Sharing from "expo-sharing";

export default function BillingScreen() {

  const [subtotal, setSubtotal] =
    useState("");

  const [taxPercent, setTaxPercent] =
    useState("10");

  const [serviceCharge, setServiceCharge] =
    useState("0");

  const [discount, setDiscount] =
    useState("0");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const paymentMethods = [

    "Cash",
    "Card",
    "Online",

  ];

  const calculateTax =
    () => {

      return (
        Number(subtotal || 0) *
        (
          Number(taxPercent) / 100
        )
      );

    };

  const calculateTotal =
    () => {

      return (
        Number(subtotal || 0) +
        calculateTax() +
        Number(serviceCharge || 0) -
        Number(discount || 0)
      );

    };

  const printReceipt =
    async () => {

      const html = `
        <html>

        <body style="
          font-family: Arial;
          padding: 30px;
        ">

          <h1>
            SERVORA ERP
          </h1>

          <h2>
            Restaurant Receipt
          </h2>

          <hr />

          <p>
            Subtotal:
            €${subtotal}
          </p>

          <p>
            Tax (${taxPercent}%):
            €${calculateTax()}
          </p>

          <p>
            Service Charge:
            €${serviceCharge}
          </p>

          <p>
            Discount:
            €${discount}
          </p>

          <hr />

          <h2>
            TOTAL:
            €${calculateTotal()}
          </h2>

          <p>
            Payment:
            ${paymentMethod}
          </p>

          <p>
            Date:
            ${new Date().toLocaleString()}
          </p>

          <br />
          <br />

          <h3>
            Thank You
          </h3>

        </body>

        </html>
      `;

      const file =
        await Print.printToFileAsync({
          html,
        });

      await Sharing.shareAsync(
        file.uri
      );

    };

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          BILLING
        </Text>

        <Text style={styles.subtitle}>
          Receipt & Payment System
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Subtotal Amount"
          keyboardType="numeric"
          value={subtotal}
          onChangeText={
            setSubtotal
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Tax %"
          keyboardType="numeric"
          value={taxPercent}
          onChangeText={
            setTaxPercent
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Service Charge"
          keyboardType="numeric"
          value={serviceCharge}
          onChangeText={
            setServiceCharge
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Discount"
          keyboardType="numeric"
          value={discount}
          onChangeText={
            setDiscount
          }
        />

        <Text style={styles.label}>
          Payment Method
        </Text>

        <View style={styles.paymentRow}>

          {paymentMethods.map(
            (item) => (

              <TouchableOpacity
                key={item}
                style={[

                  styles.paymentButton,

                  paymentMethod ===
                    item &&
                  styles.activeButton,

                ]}
                onPress={() =>
                  setPaymentMethod(
                    item
                  )
                }
              >

                <Text
                  style={
                    styles.paymentText
                  }
                >
                  {item}
                </Text>

              </TouchableOpacity>

            )
          )}

        </View>

        <View style={styles.summaryCard}>

          <Text style={styles.summaryText}>
            Tax:
            €{calculateTax()}
          </Text>

          <Text style={styles.summaryText}>
            TOTAL:
            €{calculateTotal()}
          </Text>

        </View>

        <TouchableOpacity
          style={styles.printButton}
          onPress={printReceipt}
        >

          <Text style={styles.printText}>
            PRINT RECEIPT
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

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 14,
    marginTop: 10,
  },

  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  paymentButton: {
    backgroundColor: "#dbe4ff",
    padding: 18,
    borderRadius: 18,
    width: "31%",
    alignItems: "center",
  },

  activeButton: {
    backgroundColor: "#00154f",
  },

  paymentText: {
    color: "black",
    fontWeight: "bold",
  },

  summaryCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 22,
    marginTop: 10,
  },

  summaryText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 14,
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

