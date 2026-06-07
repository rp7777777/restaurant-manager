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
} from "react-native";

export default function KitchenScreen() {

  const [orders,
    setOrders] =
      useState([

        {
          id: 1,
          item:
            "Burger Combo",
          table:
            "Table 1",
          status:
            "Preparing",
        },

        {
          id: 2,
          item:
            "Pizza Large",
          table:
            "Table 4",
          status:
            "Pending",
        },

        {
          id: 3,
          item:
            "Cold Coffee",
          table:
            "Table 2",
          status:
            "Ready",
        },

      ]);

  const markReady =
    (id: number) => {

      const updatedOrders =
        orders.map(
          (
            item
          ) =>

            item.id === id

              ? {
                  ...item,
                  status: "Ready",
                }

              : item
        );

      setOrders(
        updatedOrders
      );

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
            KITCHEN
          </Text>

          <Text
            style={styles.subtitle}
          >
            Live Kitchen Orders
          </Text>

        </View>

        <View
          style={styles.ordersContainer}
        >

          {orders.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text
                  style={styles.item}
                >
                  {item.item}
                </Text>

                <Text
                  style={styles.info}
                >
                  {item.table}
                </Text>

                <Text
                  style={styles.status}
                >
                  Status:
                  {" "}
                  {item.status}
                </Text>

                <TouchableOpacity
                  style={styles.button}
                  onPress={() =>
                    markReady(
                      item.id
                    )
                  }
                >

                  <Text
                    style={styles.buttonText}
                  >
                    MARK READY
                  </Text>

                </TouchableOpacity>

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
      fontSize: 38,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 10,
    },

    ordersContainer: {
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

    item: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    info: {
      fontSize: 18,
      marginTop: 12,
      color: "#555",
    },

    status: {
      fontSize: 18,
      marginTop: 12,
      color: "orange",
      fontWeight: "bold",
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 18,
      borderRadius: 18,
      alignItems: "center",
      marginTop: 20,
    },

    buttonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },

  });

