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
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

const kitchens = [

  "Main Kitchen",
  "Bar",
  "Bakery",
  "Pizza",
  "Sushi",
  "Grill",
  "Coffee",
  "Dessert",

];

export default function InventoryScreen() {

  const [ingredient, setIngredient] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  const [minimumStock, setMinimumStock] =
    useState("");

  const [supplier, setSupplier] =
    useState("");

  const [expiryDate, setExpiryDate] =
    useState("");

  const [kitchen, setKitchen] =
    useState("Main Kitchen");

  const [inventory, setInventory] =
    useState<any[]>([]);

  const getInventory =
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
          "Fill required fields"
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
                minimumStock
              ),

            supplier,

            expiryDate,

            kitchen,

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
        setSupplier("");
        setExpiryDate("");

        getInventory();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const deleteInventory =
    async (id: string) => {

      Alert.alert(
        "Delete Item",
        "Are you sure?",
        [

          {
            text: "Cancel",
          },

          {
            text: "Delete",

            style: "destructive",

            onPress:
              async () => {

                try {

                  await deleteDoc(
                    doc(
                      db,
                      "inventory",
                      id
                    )
                  );

                  getInventory();

                } catch (error) {

                  console.log(error);

                }

              },
          },

        ]
      );

    };

  useEffect(() => {

    getInventory();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          INVENTORY
        </Text>

        <Text style={styles.subtitle}>
          Smart Stock Management
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
          placeholder="Current Quantity"
          keyboardType="numeric"
          value={quantity}
          onChangeText={
            setQuantity
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Minimum Stock Alert"
          keyboardType="numeric"
          value={minimumStock}
          onChangeText={
            setMinimumStock
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Supplier Name"
          value={supplier}
          onChangeText={
            setSupplier
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Expiry Date"
          value={expiryDate}
          onChangeText={
            setExpiryDate
          }
        />

        <Text style={styles.label}>
          Select Department
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.row}
        >

          {kitchens.map((item) => (

            <TouchableOpacity
              key={item}
              style={[
                styles.kitchenButton,

                kitchen === item &&
                styles.activeKitchen,
              ]}
              onPress={() =>
                setKitchen(item)
              }
            >

              <Text style={styles.kitchenText}>
                {item}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={addInventory}
        >

          <Text style={styles.addText}>
            ADD INVENTORY
          </Text>

        </TouchableOpacity>

      </View>

      <View style={styles.listBox}>

        <Text style={styles.listTitle}>
          STOCK ITEMS
        </Text>

        {inventory.map((item) => {

          const lowStock =
            Number(item.quantity) <=
            Number(
              item.minimumStock
            );

          return (

            <View
              key={item.id}
              style={[
                styles.itemCard,

                lowStock &&
                styles.lowStockCard,
              ]}
            >

              <View style={styles.topRow}>

                <Text style={styles.itemName}>
                  {item.ingredient}
                </Text>

                <TouchableOpacity
                  style={
                    styles.deleteButton
                  }
                  onPress={() =>
                    deleteInventory(
                      item.id
                    )
                  }
                >

                  <Text
                    style={
                      styles.deleteText
                    }
                  >
                    DELETE
                  </Text>

                </TouchableOpacity>

              </View>

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
                Supplier:
                {" "}
                {item.supplier}
              </Text>

              <Text style={styles.info}>
                Expiry:
                {" "}
                {item.expiryDate}
              </Text>

              <Text style={styles.info}>
                Department:
                {" "}
                {item.kitchen}
              </Text>

              {lowStock && (

                <Text style={styles.alert}>
                  LOW STOCK ALERT
                </Text>

              )}

            </View>

          );

        })}

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
    fontSize: 38,
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

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 12,
  },

  row: {
    marginBottom: 20,
  },

  kitchenButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },

  activeKitchen: {
    backgroundColor: "#00154f",
  },

  kitchenText: {
    color: "black",
    fontWeight: "bold",
  },

  addButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
  },

  addText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

  listBox: {
    padding: 20,
    paddingBottom: 80,
  },

  listTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  itemCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 22,
  },

  lowStockCard: {
    borderWidth: 3,
    borderColor: "red",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
  },

  deleteButton: {
    backgroundColor: "red",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },

  deleteText: {
    color: "white",
    fontWeight: "bold",
  },

  info: {
    fontSize: 18,
    marginTop: 12,
    color: "#444",
  },

  alert: {
    marginTop: 18,
    color: "red",
    fontSize: 20,
    fontWeight: "bold",
  },

});

