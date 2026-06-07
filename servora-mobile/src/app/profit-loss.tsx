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

export default function ProfitLossScreen() {

  const [revenue,
    setRevenue] =
      useState("");

  const [expense,
    setExpense] =
      useState("");

  const [note,
    setNote] =
      useState("");

  const [records,
    setRecords] =
      useState<any[]>([]);

  useEffect(() => {

    loadData();

  }, []);

  const loadData =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const snapshot =
        await getDocs(
          collection(
            db,
            "profitloss"
          )
        );

      const data:
        any[] = [];

      snapshot.forEach(
        (doc) => {

          const item =
            doc.data();

          if (
            item.userId ===
            user.uid
          ) {

            data.push(item);

          }

        }
      );

      setRecords(data);

    };

  const addRecord =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !revenue ||
        !expense
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const profit =

        Number(revenue) -
        Number(expense);

      await addDoc(

        collection(
          db,
          "profitloss"
        ),

        {

          userId:
            user.uid,

          revenue,

          expense,

          profit,

          note,

          createdAt:
            new Date(),

        }

      );

      setRevenue("");
      setExpense("");
      setNote("");

      loadData();

    };

  const totalRevenue =
    records.reduce(
      (
        total,
        item
      ) =>

        total +
        Number(
          item.revenue
        ),

      0
    );

  const totalExpense =
    records.reduce(
      (
        total,
        item
      ) =>

        total +
        Number(
          item.expense
        ),

      0
    );

  const totalProfit =
    totalRevenue -
    totalExpense;

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.title}>
            Profit & Loss
          </Text>

          <Text style={styles.subtitle}>
            Monthly Revenue Tracker
          </Text>

        </View>

        <View style={styles.summary}>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              Revenue
            </Text>

            <Text style={styles.green}>
              €
              {totalRevenue}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              Expenses
            </Text>

            <Text style={styles.red}>
              €
              {totalExpense}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              Profit
            </Text>

            <Text style={styles.blue}>
              €
              {totalProfit}
            </Text>
          </View>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Revenue"
            keyboardType="numeric"
            value={revenue}
            onChangeText={
              setRevenue
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Expense"
            keyboardType="numeric"
            value={expense}
            onChangeText={
              setExpense
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
              addRecord
            }
          >

            <Text style={styles.buttonText}>
              SAVE RECORD
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.history}>

          <Text style={styles.historyTitle}>
            Monthly Records
          </Text>

          {records.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.record}
              >

                <Text style={styles.recordText}>
                  Revenue:
                  €
                  {item.revenue}
                </Text>

                <Text style={styles.recordText}>
                  Expense:
                  €
                  {item.expense}
                </Text>

                <Text style={styles.recordText}>
                  Profit:
                  €
                  {item.profit}
                </Text>

                <Text style={styles.recordNote}>
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

  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },

  summary: {
    padding: 16,
  },

  card: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 20,
    marginBottom: 14,
  },

  cardLabel: {
    fontSize: 16,
    color: "#666",
  },

  green: {
    fontSize: 30,
    fontWeight: "bold",
    color: "green",
    marginTop: 10,
  },

  red: {
    fontSize: 30,
    fontWeight: "bold",
    color: "red",
    marginTop: 10,
  },

  blue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 10,
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

  history: {
    padding: 16,
    paddingBottom: 100,
  },

  historyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  record: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
  },

  recordText: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },

  recordNote: {
    fontSize: 15,
    color: "#666",
    marginTop: 10,
  },

});

