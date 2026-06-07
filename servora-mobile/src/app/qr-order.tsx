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

export default function QrOrderScreen() {

  const [tableNumber,
    setTableNumber] =
      useState("");

  const [customerName,
    setCustomerName] =
      useState("");

  const [orderItems,
    setOrderItems] =
      useState("");

  const [orders,
    setOrders] =
      useState<any[]>([]);

  const createOrder =
    () => {

      if (
        !tableNumber ||
        !customerName ||
        !orderItems
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newOrder = {

        id:
          Date.now(),

        tableNumber,

        customerName,

        orderItems,

      };

      setOrders([
        newOrder,
        ...orders,
      ]);

      setTableNumber("");
      setCustomerName("");
      setOrderItems("");

      Alert.alert(
        "Success",
        "QR Order Created"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            QR ORDER
          </Text>

          <Text style={styles.subtitle}>
            QR Table Ordering System
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Table Number"
            value={tableNumber}
            onChangeText={
              setTableNumber
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Customer Name"
            value={customerName}
            onChangeText={
              setCustomerName
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Order Items"
            value={orderItems}
            onChangeText={
              setOrderItems
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={createOrder}
          >

            <Text style={styles.buttonText}>
              CREATE ORDER
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {orders.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.table}>
                  Table:
                  {" "}
                  {item.tableNumber}
                </Text>

                <Text style={styles.info}>
                  Customer:
                  {" "}
                  {item.customerName}
                </Text>

                <Text style={styles.info}>
                  Items:
                  {" "}
                  {item.orderItems}
                </Text>

              </View>

            )
          )}

        </View>

      </ScrollView>

    </AuthGuard>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        "#eef2f7",
    },

    header: {
      backgroundColor:
        "#00154f",
      padding: 35,
      borderBottomLeftRadius: 35,
      borderBottomRightRadius: 35,
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
      padding: 20,
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

    listContainer: {
      padding: 20,
      paddingBottom: 100,
    },

    card: {
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 20,
    },

    table: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    info: {
      fontSize: 18,
      marginTop: 12,
      color: "#444",
    },

  });

