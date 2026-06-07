import AuthGuard from "./auth-guard";

import React, {
  useEffect,
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

import {
  collection,
  addDoc,
  getDocs,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function ExpensesScreen() {

  const [expenseName,
    setExpenseName] =
      useState("");

  const [category,
    setCategory] =
      useState("");

  const [amount,
    setAmount] =
      useState("");

  const [note,
    setNote] =
      useState("");

  const [expenses,
    setExpenses] =
      useState<any[]>([]);

  useEffect(() => {

    loadExpenses();

  }, []);

  const loadExpenses =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const snapshot =
        await getDocs(
          collection(
            db,
            "expenses"
          )
        );

      const data:
        any[] = [];

      snapshot.forEach(
        (document) => {

          const item =
            document.data();

          if (
            item.userId ===
            user.uid
          ) {

            data.push(item);

          }

        }
      );

      setExpenses(data);

    };

  const saveExpense =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !expenseName ||
        !category ||
        !amount
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      await addDoc(

        collection(
          db,
          "expenses"
        ),

        {

          userId:
            user.uid,

          expenseName,

          category,

          amount,

          note,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Expense Saved"
      );

      setExpenseName("");
      setCategory("");
      setAmount("");
      setNote("");

      loadExpenses();

    };

  const totalExpense =
    expenses.reduce(
      (
        total,
        item
      ) =>

        total +
        Number(
          item.amount
        ),

      0
    );

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            EXPENSES
          </Text>

          <Text style={styles.subtitle}>
            Restaurant Expense Management
          </Text>

        </View>

        <View style={styles.totalCard}>

          <Text style={styles.totalTitle}>
            Total Expenses
          </Text>

          <Text style={styles.totalValue}>
            €
            {totalExpense}
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Expense Name"
            value={expenseName}
            onChangeText={
              setExpenseName
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Category"
            value={category}
            onChangeText={
              setCategory
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Amount"
            keyboardType="numeric"
            value={amount}
            onChangeText={
              setAmount
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Note"
            value={note}
            onChangeText={
              setNote
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveExpense
            }
          >

            <Text style={styles.buttonText}>
              SAVE EXPENSE
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.historyContainer}>

          <Text style={styles.sectionTitle}>
            Expense History
          </Text>

          {expenses.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.expenseCard}
              >

                <Text style={styles.expenseName}>
                  {item.expenseName}
                </Text>

                <Text style={styles.info}>
                  Category:
                  {" "}
                  {item.category}
                </Text>

                <Text style={styles.info}>
                  Amount:
                  €
                  {item.amount}
                </Text>

                <Text style={styles.note}>
                  {item.note}
                </Text>

              </View>

            )
          )}

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
    padding: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  logo: {
    fontSize: 34,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 8,
    fontSize: 16,
  },

  totalCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 28,
    borderRadius: 22,
    alignItems: "center",
  },

  totalTitle: {
    fontSize: 18,
    color: "#666",
  },

  totalValue: {
    fontSize: 38,
    fontWeight: "bold",
    color: "red",
    marginTop: 12,
  },

  form: {
    padding: 16,
  },

  input: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    fontSize: 16,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },

  historyContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  expenseCard: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 20,
    marginBottom: 16,
  },

  expenseName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 16,
    color: "#555",
    marginTop: 10,
  },

  note: {
    marginTop: 14,
    fontSize: 15,
    color: "#666",
  },

});

