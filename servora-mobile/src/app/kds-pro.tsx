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
} from "react-native";

import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

export default function KDSProScreen() {

  const [orders,
    setOrders] =
      useState<any[]>([]);

  const loadOrders =
    () => {

      return onSnapshot(

        collection(
          db,
          "orders"
        ),

        (snapshot) => {

          const data: any[] = [];

          snapshot.forEach(
            (docItem) => {

              data.push({

                id:
                  docItem.id,

                ...(docItem.data() as any),

              });

            }
          );

          data.reverse();

          setOrders(data);

        }
      );

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
            "orders",
            id
          ),

          {
            status,
          }

        );

      } catch (error) {

        console.log(error);

      }

    };

  const getStatusColor =
    (status: string) => {

      if (
        status === "PENDING"
      ) {

        return "#ff9800";

      }

      if (
        status === "PREPARING"
      ) {

        return "#2196f3";

      }

      if (
        status === "READY"
      ) {

        return "#4caf50";

      }

      if (
        status === "COMPLETED"
      ) {

        return "#9e9e9e";

      }

      return "#00154f";

    };

  useEffect(() => {

    const unsubscribe =
      loadOrders();

    return () =>
      unsubscribe();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          KDS PRO
        </Text>

        <Text style={styles.subtitle}>
          Kitchen Display System
        </Text>

      </View>

      <View style={styles.content}>

        {orders.map((item) => (

          <View
            key={item.id}
            style={[
              styles.orderCard,

              {
                borderLeftColor:
                  getStatusColor(
                    item.status
                  ),
              },

            ]}
          >

            <View style={styles.topRow}>

              <Text style={styles.orderTitle}>
                {item.tableNumber ||
                  "Takeaway"}
              </Text>

              <Text
                style={[
                  styles.status,

                  {
                    backgroundColor:
                      getStatusColor(
                        item.status
                      ),
                  },

                ]}
              >

                {item.status}
              </Text>

            </View>

            <Text style={styles.customer}>
              Customer:
              {" "}
              {item.customerName ||
                "Guest"}
            </Text>

            <Text style={styles.total}>
              Total:
              {" "}
              €{item.total}
            </Text>

            <Text style={styles.section}>
              ITEMS
            </Text>

            {item.items?.map(
              (
                food: any,
                index: number
              ) => (

                <View
                  key={index}
                  style={styles.foodRow}
                >

                  <Text style={styles.foodName}>
                    {food.name}
                  </Text>

                  <Text style={styles.foodQty}>
                    x{food.quantity}
                  </Text>

                </View>

              )
            )}

            {item.notes ? (

              <View style={styles.notesBox}>

                <Text style={styles.notesTitle}>
                  NOTES
                </Text>

                <Text style={styles.notes}>
                  {item.notes}
                </Text>

              </View>

            ) : null}

            <View style={styles.buttonRow}>

              <TouchableOpacity
                style={[
                  styles.actionButton,

                  {
                    backgroundColor:
                      "#2196f3",
                  },

                ]}
                onPress={() =>
                  updateStatus(
                    item.id,
                    "PREPARING"
                  )
                }
              >

                <Text style={styles.buttonText}>
                  PREPARING
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,

                  {
                    backgroundColor:
                      "#4caf50",
                  },

                ]}
                onPress={() =>
                  updateStatus(
                    item.id,
                    "READY"
                  )
                }
              >

                <Text style={styles.buttonText}>
                  READY
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,

                  {
                    backgroundColor:
                      "#9e9e9e",
                  },

                ]}
                onPress={() =>
                  updateStatus(
                    item.id,
                    "COMPLETED"
                  )
                }
              >

                <Text style={styles.buttonText}>
                  DONE
                </Text>

              </TouchableOpacity>

            </View>

            <Text style={styles.time}>

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
    fontSize: 40,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },

  content: {
    padding: 20,
    paddingBottom: 100,
  },

  orderCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 22,
    borderLeftWidth: 10,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  orderTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
  },

  status: {
    color: "white",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: "hidden",
    fontWeight: "bold",
  },

  customer: {
    fontSize: 18,
    marginTop: 16,
    color: "#444",
  },

  total: {
    fontSize: 22,
    marginTop: 12,
    fontWeight: "bold",
    color: "green",
  },

  section: {
    fontSize: 20,
    marginTop: 22,
    marginBottom: 12,
    fontWeight: "bold",
    color: "#00154f",
  },

  foodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  foodName: {
    fontSize: 18,
    color: "#333",
  },

  foodQty: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00154f",
  },

  notesBox: {
    backgroundColor: "#fff8e1",
    padding: 18,
    borderRadius: 18,
    marginTop: 20,
  },

  notesTitle: {
    fontWeight: "bold",
    color: "#ff9800",
    marginBottom: 8,
  },

  notes: {
    fontSize: 16,
    color: "#555",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
  },

  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },

  time: {
    marginTop: 20,
    color: "gray",
    fontSize: 14,
    textAlign: "right",
  },

});
