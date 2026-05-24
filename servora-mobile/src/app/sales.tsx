import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

export default function SalesScreen() {

  const [sales, setSales] =
    useState<any[]>([]);

  const [totalSales, setTotalSales] =
    useState(0);

  const getSales =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "sales"
            )
          );

        const data: any[] = [];

        let total = 0;

        snapshot.forEach(
          (docItem) => {

            const saleData = {
              id: docItem.id,
              ...(docItem.data() as any),
            };

            data.push(
              saleData
            );

            total += Number(
              saleData.amount || 0
            );

          }
        );

        data.reverse();

        setSales(data);

        setTotalSales(total);

      } catch (error) {

        console.log(error);

      }

    };

  const deleteSale =
    async (id: string) => {

      Alert.alert(
        "Delete Sale",
        "Are you sure?",
        [

          {
            text: "Cancel",
          },

          {
            text: "Delete",

            style: "destructive",

            onPress:
              async () => {

                try {

                  await deleteDoc(
                    doc(
                      db,
                      "sales",
                      id
                    )
                  );

                  getSales();

                } catch (error) {

                  console.log(error);

                }

              },
          },

        ]
      );

    };

  useEffect(() => {

    getSales();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.title}>
          SALES HISTORY
        </Text>

        <Text style={styles.subtitle}>
          Total Sales:
          €{totalSales}
        </Text>

      </View>

      {sales.map((item) => (

        <View
          key={item.id}
          style={styles.card}
        >

          <View style={styles.topRow}>

            <Text style={styles.kitchen}>
              {item.kitchen}
            </Text>

            <Text style={styles.amount}>
              €{item.amount}
            </Text>

          </View>

          <Text style={styles.payment}>
            Payment:
            {" "}
            {item.paymentMethod}
          </Text>

          <Text style={styles.notes}>
            {item.notes}
          </Text>

          <Text style={styles.date}>

            {
              item.createdAt
                ?.toDate?.()
                ?.toLocaleString?.()
            }

          </Text>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() =>
              deleteSale(
                item.id
              )
            }
          >

            <Text style={styles.deleteText}>
              DELETE
            </Text>

          </TouchableOpacity>

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
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 20,
    marginTop: 12,
  },

  card: {
    backgroundColor: "white",
    margin: 20,
    padding: 22,
    borderRadius: 22,
    elevation: 4,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  kitchen: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
  },

  amount: {
    fontSize: 26,
    fontWeight: "bold",
    color: "green",
  },

  payment: {
    fontSize: 18,
    marginTop: 16,
    color: "#333",
  },

  notes: {
    fontSize: 17,
    marginTop: 10,
    color: "gray",
  },

  date: {
    fontSize: 15,
    marginTop: 14,
    color: "#888",
  },

  deleteButton: {
    backgroundColor: "red",
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  deleteText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },

});

