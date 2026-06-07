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

export default function NotificationScreen() {

  const [notifications,
    setNotifications] =
      useState([

        {
          id: 1,
          title:
            "New Order Received",
          message:
            "Table 4 placed a new order",
        },

        {
          id: 2,
          title:
            "Inventory Alert",
          message:
            "Chicken stock running low",
        },

        {
          id: 3,
          title:
            "Worker Attendance",
          message:
            "John checked in at 9:00 AM",
        },

      ]);

  const clearAll =
    () => {

      setNotifications([]);

      Alert.alert(
        "Success",
        "Notifications Cleared"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            NOTIFICATIONS
          </Text>

          <Text style={styles.subtitle}>
            Live Restaurant Alerts
          </Text>

        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearAll}
        >

          <Text style={styles.clearText}>
            CLEAR ALL
          </Text>

        </TouchableOpacity>

        <View style={styles.listContainer}>

          {notifications.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.title}>
                  {item.title}
                </Text>

                <Text style={styles.message}>
                  {item.message}
                </Text>

              </View>

            )
          )}

          {notifications.length === 0 && (

            <View style={styles.emptyCard}>

              <Text style={styles.emptyText}>
                No Notifications
              </Text>

            </View>

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

    clearButton: {
      backgroundColor:
        "#00154f",
      margin: 20,
      padding: 18,
      borderRadius: 18,
      alignItems: "center",
    },

    clearText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

    listContainer: {
      padding: 20,
      paddingTop: 0,
      paddingBottom: 100,
    },

    card: {
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 20,
    },

    title: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#00154f",
    },

    message: {
      fontSize: 18,
      marginTop: 12,
      color: "#555",
      lineHeight: 28,
    },

    emptyCard: {
      backgroundColor:
        "white",
      padding: 40,
      borderRadius: 24,
      alignItems: "center",
    },

    emptyText: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#888",
    },

  });

