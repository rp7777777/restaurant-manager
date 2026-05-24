import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";

import {
  addDoc,
  collection,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

const kitchens = [

  "Main Kitchen",
  "Bar",
  "Bakery",
  "Pizza",
  "Sushi",
  "Grill",
  "Coffee",
  "Dessert",

];

const paymentMethods = [

  "Cash",
  "Card",
  "Online",
];

export default function AddSaleScreen() {

  const [kitchen, setKitchen] =
    useState("Main Kitchen");

  const [paymentMethod, setPaymentMethod] =
    useState("Cash");

  const [amount, setAmount] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const saveSale =
    async () => {

      if (!amount) {

        Alert.alert(
          "Error",
          "Enter sales amount"
        );

        return;

      }

      try {

        setLoading(true);

        await addDoc(
          collection(
            db,
            "sales"
          ),
          {
            kitchen,
            paymentMethod,
            amount:
              Number(amount),
            notes,
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Sale Added Successfully"
        );

        setAmount("");
        setNotes("");

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      } finally {

        setLoading(false);

      }

    };

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          DAILY SALES
        </Text>

        <Text style={styles.subtitle}>
          Global Restaurant ERP
        </Text>

      </View>

      <View style={styles.form}>

        <Text style={styles.label}>
          Select Kitchen
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.row}
        >

          {kitchens.map((item) => (

            <TouchableOpacity
              key={item}
              style={[
                styles.optionButton,

                kitchen === item &&
                styles.activeButton,
              ]}
              onPress={() =>
                setKitchen(item)
              }
            >

              <Text style={styles.optionText}>
                {item}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

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

                  paymentMethod === item &&
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
                    styles.optionText
                  }
                >
                  {item}
                </Text>

              </TouchableOpacity>

            )
          )}

        </View>

        <Text style={styles.label}>
          Total Sales Amount
        </Text>

        <TextInput
          style={styles.input}
          placeholder="€ 0"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>
          Notes
        </Text>

        <TextInput
          style={styles.notesInput}
          placeholder="Daily sales notes..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveSale}
        >

          <Text style={styles.saveText}>
            {loading
              ? "Saving..."
              : "SAVE SALE"}
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
  },

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 12,
    marginTop: 20,
  },

  row: {
    marginBottom: 10,
  },

  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  optionButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },

  paymentButton: {
    backgroundColor: "#dbe4ff",
    padding: 16,
    borderRadius: 18,
    width: "31%",
    alignItems: "center",
  },

  activeButton: {
    backgroundColor: "#00154f",
  },

  optionText: {
    color: "black",
    fontWeight: "bold",
  },

  input: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    fontSize: 20,
  },

  notesInput: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    height: 140,
    textAlignVertical: "top",
    fontSize: 18,
  },

  saveButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 40,
    marginBottom: 60,
  },

  saveText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

});

