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

export default function PurchaseOrdersScreen() {

  const [supplier,
    setSupplier] =
      useState("");

  const [product,
    setProduct] =
      useState("");

  const [quantity,
    setQuantity] =
      useState("");

  const [orders,
    setOrders] =
      useState<any[]>([]);

  const createOrder =
    () => {

      if (
        !supplier ||
        !product ||
        !quantity
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

        supplier,

        product,

        quantity,

        status:
          "Pending",

      };

      setOrders([
        newOrder,
        ...orders,
      ]);

      setSupplier("");
      setProduct("");
      setQuantity("");

      Alert.alert(
        "Success",
        "Purchase Order Created"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            PURCHASE ORDERS
          </Text>

          <Text style={styles.subtitle}>
            Supplier Purchase System
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Supplier Name"
            value={supplier}
            onChangeText={
              setSupplier
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Product Name"
            value={product}
            onChangeText={
              setProduct
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Quantity"
            keyboardType="numeric"
            value={quantity}
            onChangeText={
              setQuantity
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

                <Text style={styles.supplier}>
                  {item.supplier}
                </Text>

                <Text style={styles.info}>
                  Product:
                  {" "}
                  {item.product}
                </Text>

                <Text style={styles.info}>
                  Quantity:
                  {" "}
                  {item.quantity}
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

    supplier: {
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

