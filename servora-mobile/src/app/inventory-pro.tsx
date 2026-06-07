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
  addDoc,
  collection,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

export default function InventoryProScreen() {

  const [ingredient,
    setIngredient] =
      useState("");

  const [quantity,
    setQuantity] =
      useState("");

  const [minimumStock,
    setMinimumStock] =
      useState("");

  const [expiry,
    setExpiry] =
      useState("");

  const [category,
    setCategory] =
      useState("");

  const [inventory,
    setInventory] =
      useState<any[]>([]);

  const loadInventory =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "inventory"
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

        setInventory(data);

      } catch (error) {

        console.log(error);

      }

    };

  const addInventory =
    async () => {

      if (
        !ingredient ||
        !quantity
      ) {

        Alert.alert(
          "Error",
          "Fill all required fields"
        );

        return;

      }

      try {

        await addDoc(
          collection(
            db,
            "inventory"
          ),
          {
            ingredient,
            quantity:
              Number(quantity),
            minimumStock:
              Number(
                minimumStock || 0
              ),
            expiry,
            category,
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Inventory Added"
        );

        setIngredient("");
        setQuantity("");
        setMinimumStock("");
        setExpiry("");
        setCategory("");

        loadInventory();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const deleteItem =
    async (id: string) => {

      try {

        await deleteDoc(
          doc(
            db,
            "inventory",
            id
          )
        );

        loadInventory();

      } catch (error) {

        console.log(error);

      }

    };

  const isLowStock =
    (
      quantity: number,
      minimum: number
    ) => {

      return (
        quantity <= minimum
      );

    };

  useEffect(() => {

    loadInventory();

  }, []);

  return (

    <>
      <AuthGuard />

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            INVENTORY PRO
          </Text>

          <Text style={styles.subtitle}>
            Smart Inventory Management
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Ingredient Name"
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

          <TextInput
            style={styles.input}
            placeholder="Minimum Stock"
            keyboardType="numeric"
            value={minimumStock}
            onChangeText={
              setMinimumStock
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Expiry Date"
            value={expiry}
            onChangeText={
              setExpiry
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
            style={styles.addButton}
            onPress={addInventory}
          >

            <Text style={styles.addText}>
              ADD INVENTORY
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.historyBox}>

          <Text style={styles.historyTitle}>
            INVENTORY LIST
          </Text>

          {inventory.map((item) => (

            <View
              key={item.id}
              style={[

                styles.card,

                isLowStock(
                  item.quantity,
                  item.minimumStock
                ) &&

                styles.lowStockCard,

              ]}
            >

              <Text style={styles.name}>
                {item.ingredient}
              </Text>

              <Text style={styles.info}>
                Quantity:
                {" "}
                {item.quantity}
              </Text>

              <Text style={styles.info}>
                Minimum:
                {" "}
                {item.minimumStock}
              </Text>

              <Text style={styles.info}>
                Category:
                {" "}
                {item.category}
              </Text>

              <Text style={styles.info}>
                Expiry:
                {" "}
                {item.expiry}
              </Text>

              {isLowStock(
                item.quantity,
                item.minimumStock
              ) ? (

                <Text style={styles.alert}>
                  ⚠ LOW STOCK ALERT
                </Text>

              ) : (

                <Text style={styles.good}>
                  ✅ Stock Healthy
                </Text>

              )}

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  deleteItem(
                    item.id
                  )
                }
              >

                <Text style={styles.deleteText}>
                  DELETE
                </Text>

              </TouchableOpacity>

            </View>

          ))}

        </View>

      </ScrollView>

    </>

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

  addButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
  },

  addText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },

  historyBox: {
    padding: 20,
    paddingBottom: 100,
  },

  historyTitle: {
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

  lowStockCard: {
    borderLeftWidth: 10,
    borderLeftColor: "red",
  },

  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 18,
    marginTop: 12,
    color: "#444",
  },

  alert: {
    color: "red",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 18,
  },

  good: {
    color: "green",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 18,
  },

  deleteButton: {
    backgroundColor: "red",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
  },

  deleteText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

});

