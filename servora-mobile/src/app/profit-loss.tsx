import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase";

export default function ProfitLossScreen() {

  const [totalSales, setTotalSales] =
    useState(0);

  const [totalExpenses, setTotalExpenses] =
    useState(0);

  const [profit, setProfit] =
    useState(0);

  const getData = async () => {

    try {

      const salesSnapshot = await getDocs(
        collection(db, "sales")
      );

      let salesTotal = 0;

      salesSnapshot.forEach((doc) => {

        const data: any = doc.data();

        salesTotal += Number(data.amount);

      });

      const expensesSnapshot = await getDocs(
        collection(db, "expenses")
      );

      let expenseTotal = 0;

      expensesSnapshot.forEach((doc) => {

        const data: any = doc.data();

        expenseTotal += Number(data.amount);

      });

      setTotalSales(salesTotal);

      setTotalExpenses(expenseTotal);

      setProfit(
        salesTotal - expenseTotal
      );

    } catch (error) {

      console.log(error);

    }

  };

  useEffect(() => {

    getData();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.title}>
          PROFIT & LOSS
        </Text>

        <Text style={styles.subtitle}>
          Restaurant Financial Analytics
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.cardTitle}>
          Total Sales
        </Text>

        <Text style={styles.greenText}>
          €{totalSales}
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.cardTitle}>
          Total Expenses
        </Text>

        <Text style={styles.redText}>
          €{totalExpenses}
        </Text>

      </View>

      <View style={styles.card}>

        <Text style={styles.cardTitle}>
          Net Profit
        </Text>

        <Text style={styles.blueText}>
          €{profit}
        </Text>

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

  card: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    padding: 25,
    borderRadius: 20,
    elevation: 4,
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 15,
  },

  greenText: {
    color: "green",
    fontSize: 32,
    fontWeight: "bold",
  },

  redText: {
    color: "red",
    fontSize: 32,
    fontWeight: "bold",
  },

  blueText: {
    color: "#007bff",
    fontSize: 32,
    fontWeight: "bold",
  },

});