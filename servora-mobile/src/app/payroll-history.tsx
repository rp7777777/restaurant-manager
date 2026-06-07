import AuthGuard from "./auth-guard";

import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function PayrollHistoryScreen() {

  const [history] =
    useState([

      {
        id: 1,
        employee:
          "John Doe",
        month:
          "April 2026",
        salary:
          "€2200",
        status:
          "Paid",
      },

      {
        id: 2,
        employee:
          "Maria Silva",
        month:
          "April 2026",
        salary:
          "€1850",
        status:
          "Paid",
      },

      {
        id: 3,
        employee:
          "Alex Brown",
        month:
          "March 2026",
        salary:
          "€2400",
        status:
          "Pending",
      },

    ]);

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            PAYROLL HISTORY
          </Text>

          <Text style={styles.subtitle}>
            Employee Salary Records
          </Text>

        </View>

        <View style={styles.listContainer}>

          {history.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.employee}>
                  {item.employee}
                </Text>

                <Text style={styles.info}>
                  Month:
                  {" "}
                  {item.month}
                </Text>

                <Text style={styles.info}>
                  Salary:
                  {" "}
                  {item.salary}
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
      fontSize: 34,
      fontWeight: "bold",
      marginTop: 25,
    },

    subtitle: {
      color: "white",
      fontSize: 18,
      marginTop: 10,
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

    employee: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    info: {
      fontSize: 18,
      color: "#555",
      marginTop: 12,
    },

    status: {
      fontSize: 18,
      fontWeight: "bold",
      color: "green",
      marginTop: 14,
    },

  });

