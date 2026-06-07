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
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";

import {
  collection,
  addDoc,
  getDocs,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function InventoryScreen() {

  const [itemName,
    setItemName] =
      useState("");

  const [quantity,
    setQuantity] =
      useState("");

  const [category,
    setCategory] =
      useState("");

  const [inventory,
    setInventory] =
      useState<any[]>([]);

  useEffect(() => {

    loadInventory();

  }, []);

  const loadInventory =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const snapshot =
        await getDocs(
          collection(
            db,
            "inventory"
          )
        );

      const data:
        any[] = [];

      snapshot.forEach(
        (doc) => {

          const item =
            doc.data();

          if (
            item.userId ===
            user.uid
          ) {

            data.push(item);

          }

        }
      );

      setInventory(data);

    };

  const addInventory =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !itemName ||
        !quantity ||
        !category
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      await addDoc(

        collection(
          db,
          "inventory"
        ),

        {

          userId:
            user.uid,

          itemName,

          quantity,

          category,

          createdAt:
            new Date(),

        }

      );

      setItemName("");
      setQuantity("");
      setCategory("");

      loadInventory();

    };

  const totalStock =
    inventory.reduce(
      (
        total,
        item
      ) =>

        total +
        Number(
          item.quantity
        ),

      0
    );

  const lowStock =
    inventory.filter(
      (item) =>

        Number(
          item.quantity
        ) < 5
    );

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            Inventory
          </Text>

          <Text style={styles.subtitle}>
            Restaurant Stock Management
          </Text>

        </View>

        <View style={styles.summaryContainer}>

          <View style={styles.summaryCard}>

            <Text style={styles.summaryLabel}>
              Total Stock
            </Text>

            <Text style={styles.summaryValue}>
              {totalStock}
            </Text>

          </View>

          <View style={styles.summaryCard}>

            <Text style={styles.summaryLabel}>
              Low Stock
            </Text>

            <Text style={styles.lowStock}>
              {lowStock.length}
            </Text>

          </View>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Item Name"
            value={itemName}
            onChangeText={
              setItemName
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

          <TextInput
            style={styles.input}
            placeholder="Category"
            value={category}
            onChangeText={
              setCategory
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              addInventory
            }
          >

            <Text style={styles.buttonText}>
              ADD INVENTORY
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.inventoryContainer}>

          <Text style={styles.sectionTitle}>
            Inventory List
          </Text>

          {inventory.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.inventoryCard}
              >

                <Text style={styles.itemName}>
                  {item.itemName}
                </Text>

                <Text style={styles.itemInfo}>
                  Quantity:
                  {" "}
                  {item.quantity}
                </Text>

                <Text style={styles.itemInfo}>
                  Category:
                  {" "}
                  {item.category}
                </Text>

                {Number(
                  item.quantity
                ) < 5 && (

                  <Text style={styles.alert}>
                    LOW STOCK ALERT
                  </Text>

                )}

              </View>

            )
          )}

        </View>

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
    marginTop: 10,
    fontSize: 16,
  },

  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },

  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
  },

  summaryLabel: {
    fontSize: 16,
    color: "#666",
  },

  summaryValue: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 10,
  },

  lowStock: {
    fontSize: 30,
    fontWeight: "bold",
    color: "red",
    marginTop: 10,
  },

  form: {
    padding: 16,
  },

  input: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    fontSize: 16,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  inventoryContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  inventoryCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
  },

  itemName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  itemInfo: {
    fontSize: 16,
    color: "#555",
    marginTop: 8,
  },

  alert: {
    marginTop: 12,
    color: "red",
    fontWeight: "bold",
    fontSize: 15,
  },

});

