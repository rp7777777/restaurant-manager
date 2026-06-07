import AuthGuard from "./auth-guard";

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
  getDocs,
  addDoc,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function StoreRequestsScreen() {

  const [requests,
    setRequests] =
      useState<any[]>([]);

  useEffect(() => {

    generateTomorrowRequests();

  }, []);

  const generateTomorrowRequests =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const inventorySnapshot =
        await getDocs(
          collection(
            db,
            "inventory"
          )
        );

      const autoRequests:
        any[] = [];

      inventorySnapshot.forEach(
        (document) => {

          const item =
            document.data();

          if (
            item.userId ===
            user.uid
          ) {

            const currentStock =
              Number(
                item.currentStock || 0
              );

            const tomorrowNeed =
              Number(
                item.tomorrowNeed || 0
              );

            const minimumStock =
              Number(
                item.minimumStock || 0
              );

            const required =
              tomorrowNeed -
              currentStock;

            if (

              currentStock <
              minimumStock ||

              required > 0

            ) {

              autoRequests.push({

                itemName:
                  item.itemName,

                currentStock,

                tomorrowNeed,

                minimumStock,

                requestAmount:
                  required > 0
                    ? required
                    : minimumStock,

              });

            }

          }

        }
      );

      setRequests(
        autoRequests
      );

    };

  const saveRequest =
    async (item: any) => {

      const user =
        auth.currentUser;

      if (!user) return;

      await addDoc(

        collection(
          db,
          "storeRequests"
        ),

        {

          userId:
            user.uid,

          itemName:
            item.itemName,

          currentStock:
            item.currentStock,

          tomorrowNeed:
            item.tomorrowNeed,

          requestAmount:
            item.requestAmount,

          status:
            "PENDING",

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Store Request Sent"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            STORE REQUESTS
          </Text>

          <Text style={styles.subtitle}>
            Tomorrow Required Inventory
          </Text>

        </View>

        {requests.length === 0 && (

          <Text style={styles.empty}>
            No Store Requests
          </Text>

        )}

        {requests.map(
          (
            item,
            index
          ) => (

            <View
              key={index}
              style={styles.card}
            >

              <Text style={styles.itemName}>
                {item.itemName}
              </Text>

              <Text style={styles.info}>
                Current Stock:
                {" "}
                {item.currentStock}
              </Text>

              <Text style={styles.info}>
                Tomorrow Need:
                {" "}
                {item.tomorrowNeed}
              </Text>

              <Text style={styles.info}>
                Minimum Stock:
                {" "}
                {item.minimumStock}
              </Text>

              <Text style={styles.request}>
                BUY:
                {" "}
                {item.requestAmount}
              </Text>

              <TouchableOpacity
                style={styles.button}
                onPress={() =>
                  saveRequest(item)
                }
              >

                <Text style={styles.buttonText}>
                  SEND REQUEST
                </Text>

              </TouchableOpacity>

            </View>

          )
        )}

      </ScrollView>

    </AuthGuard>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  logo: {
    fontSize: 34,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 8,
    fontSize: 16,
  },

  empty: {
    fontSize: 22,
    textAlign: "center",
    marginTop: 60,
    color: "#555",
  },

  card: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 22,
    borderRadius: 22,
  },

  itemName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 17,
    marginTop: 10,
    color: "#555",
  },

  request: {
    fontSize: 24,
    color: "red",
    fontWeight: "bold",
    marginTop: 18,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
  },

});

