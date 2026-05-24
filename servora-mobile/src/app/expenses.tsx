import React, {
  useEffect,
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
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase";

export default function ExpensesScreen() {

  const [expenseName, setExpenseName] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [expenses, setExpenses] =
    useState([]);

  const getExpenses = async () => {

    try {

      const querySnapshot = await getDocs(
        collection(db, "expenses")
      );

      const data: any = [];

      querySnapshot.forEach((doc) => {

        data.push({
          id: doc.id,
          ...doc.data(),
        });

      });

      setExpenses(data);

    } catch (error) {

      console.log(error);

    }

  };

  useEffect(() => {

    getExpenses();

  }, []);

  const addExpense = async () => {

    if (!expenseName || !amount) {

      Alert.alert(
        "Error",
        "Fill all fields"
      );

      return;

    }

    try {

      await addDoc(
        collection(db, "expenses"),
        {
          expenseName,
          amount,
          createdAt: new Date(),
        }
      );

      Alert.alert(
        "Success",
        "Expense Added"
      );

      setExpenseName("");

      setAmount("");

      getExpenses();

    } catch (error) {

      console.log(error);

      Alert.alert(
        "Error",
        "Failed to add expense"
      );

    }

  };

  const totalExpenses = expenses.reduce(
    (sum: number, item: any) =>
      sum + Number(item.amount),
    0
  );

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.title}>
          EXPENSE TRACKER
        </Text>

        <Text style={styles.subtitle}>
          Total Expenses: €{totalExpenses}
        </Text>

      </View>

      <View style={styles.form}>

        <Text style={styles.label}>
          Expense Name
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter expense"
          value={expenseName}
          onChangeText={setExpenseName}
        />

        <Text style={styles.label}>
          Amount
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={addExpense}
        >

          <Text style={styles.buttonText}>
            Add Expense
          </Text>

        </TouchableOpacity>

      </View>

      <Text style={styles.sectionTitle}>
        Expense History
      </Text>

      {expenses.map((item: any) => (

        <View key={item.id} style={styles.card}>

          <Text style={styles.expenseName}>
            {item.expenseName}
          </Text>

          <Text style={styles.expenseAmount}>
            €{item.amount}
          </Text>

        </View>

      ))}

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

  title: {
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

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 10,
  },

  input: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 16,
    fontSize: 20,
    marginBottom: 20,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginLeft: 20,
    marginTop: 10,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 18,
    elevation: 4,
  },

  expenseName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  expenseAmount: {
    fontSize: 20,
    color: "red",
    marginTop: 10,
    fontWeight: "bold",
  },

});