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

export default function BillingProScreen() {

  const [customer,
    setCustomer] =
      useState("");

  const [amount,
    setAmount] =
      useState("");

  const [bills,
    setBills] =
      useState<any[]>([]);

  const addBill =
    () => {

      if (
        !customer ||
        !amount
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newBill = {

        id:
          Date.now(),

        customer,

        amount,

      };

      setBills([
        newBill,
        ...bills,
      ]);

      setCustomer("");
      setAmount("");

      Alert.alert(
        "Success",
        "Bill Created"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            BILLING PRO
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Customer Name"
            value={customer}
            onChangeText={setCustomer}
          />

          <TextInput
            style={styles.input}
            placeholder="Amount"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={addBill}
          >

            <Text style={styles.buttonText}>
              CREATE BILL
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.list}>

          {bills.map((item) => (

            <View
              key={item.id}
              style={styles.card}
            >

              <Text style={styles.name}>
                {item.customer}
              </Text>

              <Text style={styles.info}>
                €
                {item.amount}
              </Text>

            </View>

          ))}

        </View>

      </ScrollView>

    </AuthGuard>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 35,
  },

  logo: {
    color: "gold",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 25,
  },

  form: {
    padding: 20,
  },

  input: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 18,
    marginBottom: 18,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 22,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },

  list: {
    padding: 20,
  },

  card: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 18,
  },

  name: {
    fontSize: 22,
    fontWeight: "bold",
  },

  info: {
    fontSize: 18,
    marginTop: 10,
  },

});

