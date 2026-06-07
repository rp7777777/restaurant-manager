import AuthGuard from "./auth-guard";

import React, {
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

export default function BillingScreen() {

  const [cart,
    setCart] =
      useState<any[]>([]);

  const menuItems = [

    {
      id: 1,
      name: "Burger",
      price: 8,
    },

    {
      id: 2,
      name: "Pizza",
      price: 12,
    },

    {
      id: 3,
      name: "Cold Coffee",
      price: 5,
    },

    {
      id: 4,
      name: "French Fries",
      price: 4,
    },

  ];

  const addToBill =
    (item: any) => {

      setCart([
        ...cart,
        item,
      ]);

    };

  const total =
    cart.reduce(
      (
        sum,
        item
      ) =>

        sum +
        item.price,

      0
    );

  const completeBilling =
    () => {

      Alert.alert(
        "Success",
        "Billing Completed"
      );

      setCart([]);

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View
          style={styles.header}
        >

          <Text
            style={styles.logo}
          >
            BILLING
          </Text>

          <Text
            style={styles.subtitle}
          >
            Restaurant Billing System
          </Text>

        </View>

        <View
          style={styles.section}
        >

          <Text
            style={styles.sectionTitle}
          >
            MENU ITEMS
          </Text>

          {menuItems.map(
            (
              item
            ) => (

              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() =>
                  addToBill(
                    item
                  )
                }
              >

                <Text
                  style={styles.itemName}
                >
                  {item.name}
                </Text>

                <Text
                  style={styles.price}
                >
                  €
                  {item.price}
                </Text>

              </TouchableOpacity>

            )
          )}

        </View>

        <View
          style={styles.cartSection}
        >

          <Text
            style={styles.sectionTitle}
          >
            BILL SUMMARY
          </Text>

          {cart.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.cartItem}
              >

                <Text
                  style={styles.cartText}
                >
                  {item.name}
                </Text>

                <Text
                  style={styles.cartText}
                >
                  €
                  {item.price}
                </Text>

              </View>

            )
          )}

          <View
            style={styles.totalBox}
          >

            <Text
              style={styles.totalText}
            >
              TOTAL:
            </Text>

            <Text
              style={styles.totalAmount}
            >
              €
              {total}
            </Text>

          </View>

          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={
              completeBilling
            }
          >

            <Text
              style={styles.checkoutText}
            >
              COMPLETE BILLING
            </Text>

          </TouchableOpacity>

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
      fontSize: 38,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 10,
    },

    section: {
      padding: 20,
    },

    sectionTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#00154f",
      marginBottom: 20,
    },

    card: {
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 18,
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    itemName: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#00154f",
    },

    price: {
      fontSize: 20,
      color: "green",
      fontWeight: "bold",
    },

    cartSection: {
      padding: 20,
      paddingBottom: 100,
    },

    cartItem: {
      backgroundColor:
        "white",
      padding: 20,
      borderRadius: 20,
      marginBottom: 14,
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    cartText: {
      fontSize: 18,
      color: "#333",
    },

    totalBox: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginTop: 25,
      marginBottom: 25,
    },

    totalText: {
      fontSize: 26,
      fontWeight: "bold",
      color: "#00154f",
    },

    totalAmount: {
      fontSize: 28,
      fontWeight: "bold",
      color: "green",
    },

    checkoutButton: {
      backgroundColor:
        "#00154f",
      padding: 22,
      borderRadius: 18,
      alignItems: "center",
    },

    checkoutText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

  });

