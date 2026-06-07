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

export default function DeliveryProScreen() {

  const [customer,
    setCustomer] =
      useState("");

  const [address,
    setAddress] =
      useState("");

  const [orderItem,
    setOrderItem] =
      useState("");

  const [deliveries,
    setDeliveries] =
      useState<any[]>([]);

  const createDelivery =
    () => {

      if (
        !customer ||
        !address ||
        !orderItem
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newDelivery = {

        id:
          Date.now(),

        customer,

        address,

        orderItem,

        status:
          "Pending",

      };

      setDeliveries([
        newDelivery,
        ...deliveries,
      ]);

      setCustomer("");
      setAddress("");
      setOrderItem("");

      Alert.alert(
        "Success",
        "Delivery Created"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            DELIVERY PRO
          </Text>

          <Text style={styles.subtitle}>
            Delivery Management System
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Customer Name"
            value={customer}
            onChangeText={
              setCustomer
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Delivery Address"
            value={address}
            onChangeText={
              setAddress
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Order Item"
            value={orderItem}
            onChangeText={
              setOrderItem
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={createDelivery}
          >

            <Text style={styles.buttonText}>
              CREATE DELIVERY
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {deliveries.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.customer}>
                  {item.customer}
                </Text>

                <Text style={styles.info}>
                  Address:
                  {" "}
                  {item.address}
                </Text>

                <Text style={styles.info}>
                  Order:
                  {" "}
                  {item.orderItem}
                </Text>

                <Text style={styles.status}>
                  Status:
                  {" "}
                  {item.status}
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

    customer: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    info: {
      fontSize: 18,
      marginTop: 12,
      color: "#444",
    },

    status: {
      fontSize: 18,
      marginTop: 14,
      fontWeight: "bold",
      color: "orange",
    },

  });

