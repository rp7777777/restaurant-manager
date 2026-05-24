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
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

export default function KitchenScreen() {

  const [orders, setOrders] =
    useState<any[]>([]);

  const getOrders =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "orders"
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

        setOrders(data);

      } catch (error) {

        console.log(error);

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
            "orders",
            id
          ),
          {
            status,
          }
        );

        getOrders();

      } catch (error) {

        console.log(error);

      }

    };

  useEffect(() => {

    getOrders();

    const interval =
      setInterval(() => {

        getOrders();

      }, 5000);

    return () =>
      clearInterval(interval);

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          KITCHEN DISPLAY
        </Text>

        <Text style={styles.subtitle}>
          Live Kitchen Orders
        </Text>

      </View>

      <View style={styles.content}>

        {orders.map((order) => (

          <View
            key={order.id}
            style={[
              styles.orderCard,

              order.status ===
                "READY" &&
              styles.readyCard,

              order.status ===
                "DELIVERED" &&
              styles.deliveredCard,
            ]}
          >

            <View style={styles.topRow}>

              <Text style={styles.tableText}>
                Table:
                {" "}
                {order.tableNumber}
              </Text>

              <Text
                style={[
                  styles.status,

                  order.status ===
                    "PREPARING" &&
                  styles.preparing,

                  order.status ===
                    "READY" &&
                  styles.ready,

                  order.status ===
                    "DELIVERED" &&
                  styles.delivered,
                ]}
              >

                {order.status}

              </Text>

            </View>

            <Text style={styles.customer}>
              Customer:
              {" "}
              {order.customerName}
            </Text>

            <View style={styles.itemsBox}>

              {order.items?.map(
                (
                  item: any,
                  index: number
                ) => (

                  <Text
                    key={index}
                    style={styles.item}
                  >

                    {item.quantity}x
                    {" "}
                    {item.name}

                  </Text>

                )
              )}

            </View>

            <Text style={styles.notes}>
              {order.notes}
            </Text>

            <Text style={styles.total}>
              TOTAL:
              €{order.total}
            </Text>

            <Text style={styles.date}>

              {
                order.createdAt
                  ?.toDate?.()
                  ?.toLocaleString?.()
              }

            </Text>

            <View style={styles.buttonRow}>

              <TouchableOpacity
                style={[
                  styles.button,

                  styles.preparingButton,
                ]}
                onPress={() =>
                  updateStatus(
                    order.id,
                    "PREPARING"
                  )
                }
              >

                <Text
                  style={
                    styles.buttonText
                  }
                >
                  PREPARING
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,

                  styles.readyButton,
                ]}
                onPress={() =>
                  updateStatus(
                    order.id,
                    "READY"
                  )
                }
              >

                <Text
                  style={
                    styles.buttonText
                  }
                >
                  READY
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,

                  styles.deliveredButton,
                ]}
                onPress={() =>
                  updateStatus(
                    order.id,
                    "DELIVERED"
                  )
                }
              >

                <Text
                  style={
                    styles.buttonText
                  }
                >
                  DONE
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        ))}

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
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

  content: {
    padding: 20,
    paddingBottom: 100,
  },

  orderCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
  },

  readyCard: {
    borderWidth: 3,
    borderColor: "green",
  },

  deliveredCard: {
    opacity: 0.7,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  tableText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
  },

  status: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    color: "white",
    fontWeight: "bold",
    overflow: "hidden",
  },

  preparing: {
    backgroundColor: "#ff9800",
  },

  ready: {
    backgroundColor: "green",
  },

  delivered: {
    backgroundColor: "#00154f",
  },

  customer: {
    fontSize: 18,
    marginTop: 16,
    color: "#444",
  },

  itemsBox: {
    marginTop: 20,
  },

  item: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#00154f",
  },

  notes: {
    marginTop: 18,
    fontSize: 17,
    color: "gray",
  },

  total: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: "bold",
    color: "green",
  },

  date: {
    marginTop: 16,
    color: "gray",
    fontSize: 14,
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },

  button: {
    width: "31%",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  preparingButton: {
    backgroundColor: "#ff9800",
  },

  readyButton: {
    backgroundColor: "green",
  },

  deliveredButton: {
    backgroundColor: "#00154f",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },

});

