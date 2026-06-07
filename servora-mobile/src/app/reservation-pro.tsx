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

export default function ReservationProScreen() {

  const [customerName,
    setCustomerName] =
      useState("");

  const [tableNumber,
    setTableNumber] =
      useState("");

  const [reservationTime,
    setReservationTime] =
      useState("");

  const [reservations,
    setReservations] =
      useState<any[]>([]);

  const createReservation =
    () => {

      if (
        !customerName ||
        !tableNumber ||
        !reservationTime
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newReservation = {

        id:
          Date.now(),

        customerName,

        tableNumber,

        reservationTime,

        status:
          "Reserved",

      };

      setReservations([
        newReservation,
        ...reservations,
      ]);

      setCustomerName("");
      setTableNumber("");
      setReservationTime("");

      Alert.alert(
        "Success",
        "Reservation Created"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            RESERVATION PRO
          </Text>

          <Text style={styles.subtitle}>
            Table Reservation System
          </Text>

        </View>

        <View style={styles.form}>

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
            placeholder="Table Number"
            value={tableNumber}
            onChangeText={
              setTableNumber
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Reservation Time"
            value={reservationTime}
            onChangeText={
              setReservationTime
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={createReservation}
          >

            <Text style={styles.buttonText}>
              CREATE RESERVATION
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {reservations.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.customer}>
                  {item.customerName}
                </Text>

                <Text style={styles.info}>
                  Table:
                  {" "}
                  {item.tableNumber}
                </Text>

                <Text style={styles.info}>
                  Time:
                  {" "}
                  {item.reservationTime}
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
      color: "green",
    },

  });

