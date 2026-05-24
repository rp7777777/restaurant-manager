import React, {
  useEffect,
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

import {
  addDoc,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

export default function StoreRequestsScreen() {

  const [department,
    setDepartment] =
      useState("");

  const [ingredient,
    setIngredient] =
      useState("");

  const [quantity,
    setQuantity] =
      useState("");

  const [requests,
    setRequests] =
      useState<any[]>([]);

  const loadRequests =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "storeRequests"
            )
          );

        const data: any[] = [];

        snapshot.forEach(
          (docItem) => {

            data.push({
              id: docItem.id,
              ...(docItem.data() as any),
            });

          }
        );

        data.reverse();

        setRequests(data);

      } catch (error) {

        console.log(error);

      }

    };

  const sendRequest =
    async () => {

      if (
        !department ||
        !ingredient ||
        !quantity
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      try {

        await addDoc(
          collection(
            db,
            "storeRequests"
          ),
          {
            department,
            ingredient,
            quantity,
            status:
              "PENDING",
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Request Sent To Store"
        );

        setDepartment("");
        setIngredient("");
        setQuantity("");

        loadRequests();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const updateStatus =
    async (
      id: string,
      status: string
    ) => {

      try {

        await updateDoc(
          doc(
            db,
            "storeRequests",
            id
          ),
          {
            status,
          }
        );

        loadRequests();

      } catch (error) {

        console.log(error);

      }

    };

  useEffect(() => {

    loadRequests();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          STORE REQUESTS
        </Text>

        <Text style={styles.subtitle}>
          Kitchen To Store System
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Department"
          value={department}
          onChangeText={
            setDepartment
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Ingredient"
          value={ingredient}
          onChangeText={
            setIngredient
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
          style={styles.sendButton}
          onPress={sendRequest}
        >

          <Text style={styles.sendText}>
            SEND REQUEST
          </Text>

        </TouchableOpacity>

      </View>

      <View style={styles.listBox}>

        <Text style={styles.listTitle}>
          REQUEST HISTORY
        </Text>

        {requests.map((item) => (

          <View
            key={item.id}
            style={styles.card}
          >

            <Text style={styles.department}>
              {item.department}
            </Text>

            <Text style={styles.info}>
              Ingredient:
              {" "}
              {item.ingredient}
            </Text>

            <Text style={styles.info}>
              Quantity:
              {" "}
              {item.quantity}
            </Text>

            <Text
              style={[

                styles.status,

                item.status ===
                  "APPROVED" &&
                styles.approved,

                item.status ===
                  "REJECTED" &&
                styles.rejected,

                item.status ===
                  "PENDING" &&
                styles.pending,

              ]}
            >

              {item.status}

            </Text>

            <View style={styles.buttonRow}>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.approveButton,
                ]}
                onPress={() =>
                  updateStatus(
                    item.id,
                    "APPROVED"
                  )
                }
              >

                <Text style={styles.buttonText}>
                  APPROVE
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.rejectButton,
                ]}
                onPress={() =>
                  updateStatus(
                    item.id,
                    "REJECTED"
                  )
                }
              >

                <Text style={styles.buttonText}>
                  REJECT
                </Text>

              </TouchableOpacity>

            </View>

            <Text style={styles.date}>

              {
                item.createdAt
                  ?.toDate?.()
                  ?.toLocaleString?.()
              }

            </Text>

          </View>

        ))}

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#00154f",
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
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    fontSize: 18,
    marginBottom: 18,
  },

  sendButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
  },

  sendText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

  listBox: {
    padding: 20,
    paddingBottom: 100,
  },

  listTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
  },

  department: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 18,
    marginTop: 12,
    color: "#444",
  },

  status: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: "bold",
  },

  approved: {
    color: "green",
  },

  rejected: {
    color: "red",
  },

  pending: {
    color: "#ff9800",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },

  actionButton: {
    width: "48%",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  approveButton: {
    backgroundColor: "green",
  },

  rejectButton: {
    backgroundColor: "red",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

  date: {
    marginTop: 18,
    color: "gray",
    fontSize: 14,
  },

});

