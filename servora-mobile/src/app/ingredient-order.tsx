import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
  "Chinese",
  "Indian",
  "Italian",
  "Laundry",
  "Housekeeping",

];

const ingredientDatabase: any = {

  "Main Kitchen": [
    "Rice",
    "Chicken",
    "Oil",
    "Salt",
    "Vegetables",
  ],

  "Bar": [
    "Beer",
    "Wine",
    "Coke",
    "Ice",
    "Whiskey",
  ],

  "Bakery": [
    "Flour",
    "Butter",
    "Sugar",
    "Eggs",
  ],

  "Pizza": [
    "Pizza Dough",
    "Cheese",
    "Pepperoni",
    "Tomato Sauce",
  ],

  "Sushi": [
    "Salmon",
    "Wasabi",
    "Soy Sauce",
    "Sushi Rice",
  ],

  "Coffee": [
    "Coffee Beans",
    "Milk",
    "Chocolate",
    "Sugar",
  ],

};

export default function IngredientOrderScreen() {

  const [kitchen, setKitchen] =
    useState("Main Kitchen");

  const [requestedBy, setRequestedBy] =
    useState("");

  const [requiredDate, setRequiredDate] =
    useState("");

  const [items, setItems] =
    useState<any[]>([
      {
        ingredient: "",
        closingStock: "",
        minimumLevel: "",
        orderQty: "",
      },
    ]);

  const [savedIngredients, setSavedIngredients] =
    useState<any[]>([]);

  const kitchenIngredients =
    useMemo(() => {

      return (
        ingredientDatabase[kitchen] || []
      );

    }, [kitchen]);

  const addRow = () => {

    setItems([
      ...items,
      {
        ingredient: "",
        closingStock: "",
        minimumLevel: "",
        orderQty: "",
      },
    ]);

  };

  const updateItem = (
    index: number,
    field: string,
    value: string
  ) => {

    const updated = [...items];

    updated[index][field] = value;

    setItems(updated);

  };

  const getIngredients = async () => {

    try {

      const snapshot =
        await getDocs(
          collection(
            db,
            "ingredients"
          )
        );

      const data: any[] = [];

      snapshot.forEach((docItem) => {

        data.push({
          id: docItem.id,
          ...docItem.data(),
        });

      });

      setSavedIngredients(data);

    } catch (error) {

      console.log(error);

    }

  };

  const saveIngredient =
    async (ingredient: any) => {

      try {

        await addDoc(
          collection(
            db,
            "ingredients"
          ),
          {
            kitchen,
            ingredient:
              ingredient.ingredient,
            closingStock:
              ingredient.closingStock,
            minimumLevel:
              ingredient.minimumLevel,
            orderQty:
              ingredient.orderQty,
            createdAt:
              new Date(),
          }
        );

        getIngredients();

      } catch (error) {

        console.log(error);

      }

  };

  const deleteIngredient =
    async (id: string) => {

      try {

        await deleteDoc(
          doc(
            db,
            "ingredients",
            id
          )
        );

        getIngredients();

      } catch (error) {

        console.log(error);

      }

  };

  useEffect(() => {

    getIngredients();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.title}>
          INGREDIENT ORDER
        </Text>

        <Text style={styles.subtitle}>
          Global Restaurant ERP
        </Text>

      </View>

      <View style={styles.form}>

        <Text style={styles.label}>
          Select Kitchen
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.kitchenRow}
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

              <Text
                style={
                  styles.kitchenText
                }
              >
                {item}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        <Text style={styles.label}>
          Requested By
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Manager Name"
          value={requestedBy}
          onChangeText={
            setRequestedBy
          }
        />

        <Text style={styles.label}>
          Required Date
        </Text>

        <TextInput
          style={styles.input}
          placeholder="25/05/2026"
          value={requiredDate}
          onChangeText={
            setRequiredDate
          }
        />

      </View>

      <View style={styles.tableHeader}>

        <Text style={styles.headerText}>
          Ingredient
        </Text>

        <Text style={styles.headerText}>
          Closing
        </Text>

        <Text style={styles.headerText}>
          Minimum
        </Text>

        <Text style={styles.headerText}>
          Order
        </Text>

      </View>

      {items.map((item, index) => (

        <View
          key={index}
          style={styles.row}
        >

          <TextInput
            style={styles.ingredientInput}
            placeholder={
              kitchenIngredients[
                index %
                  kitchenIngredients.length
              ] || "Ingredient"
            }
            value={item.ingredient}
            onChangeText={(text) =>
              updateItem(
                index,
                "ingredient",
                text
              )
            }
          />

          <TextInput
            style={styles.smallInput}
            placeholder="0"
            keyboardType="numeric"
            value={item.closingStock}
            onChangeText={(text) =>
              updateItem(
                index,
                "closingStock",
                text
              )
            }
          />

          <TextInput
            style={styles.smallInput}
            placeholder="0"
            keyboardType="numeric"
            value={item.minimumLevel}
            onChangeText={(text) =>
              updateItem(
                index,
                "minimumLevel",
                text
              )
            }
          />

          <TextInput
            style={[
              styles.smallInput,

              Number(
                item.orderQty
              ) > 0 &&
              styles.orderHighlight,
            ]}
            placeholder="0"
            keyboardType="numeric"
            value={item.orderQty}
            onChangeText={(text) =>
              updateItem(
                index,
                "orderQty",
                text
              )
            }
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() =>
              saveIngredient(item)
            }
          >

            <Text style={styles.actionText}>
              SAVE
            </Text>

          </TouchableOpacity>

        </View>

      ))}

      <TouchableOpacity
        style={styles.addButton}
        onPress={addRow}
      >

        <Text style={styles.buttonText}>
          + Add Ingredient
        </Text>

      </TouchableOpacity>

      <View style={styles.savedBox}>

        <Text style={styles.savedTitle}>
          SAVED INGREDIENTS
        </Text>

        {savedIngredients.map(
          (item) => (

            <View
              key={item.id}
              style={styles.savedRow}
            >

              <View>

                <Text
                  style={
                    styles.savedIngredient
                  }
                >
                  {item.ingredient}
                </Text>

                <Text>
                  {item.kitchen}
                </Text>

              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  deleteIngredient(
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

          )
        )}

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

  title: {
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

  form: {
    padding: 20,
  },

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 10,
  },

  kitchenRow: {
    marginBottom: 20,
  },

  kitchenButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
  },

  activeKitchen: {
    backgroundColor: "#00154f",
  },

  kitchenText: {
    color: "black",
    fontWeight: "bold",
  },

  input: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 16,
    fontSize: 18,
    marginBottom: 20,
  },

  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#00154f",
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 14,
  },

  headerText: {
    color: "white",
    fontWeight: "bold",
    width: "20%",
    textAlign: "center",
    fontSize: 12,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 15,
    alignItems: "center",
  },

  ingredientInput: {
    backgroundColor: "white",
    width: "28%",
    padding: 10,
    borderRadius: 12,
    fontSize: 14,
  },

  smallInput: {
    backgroundColor: "white",
    width: "14%",
    padding: 10,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 12,
  },

  orderHighlight: {
    borderWidth: 2,
    borderColor: "red",
  },

  saveButton: {
    backgroundColor: "green",
    padding: 10,
    borderRadius: 10,
  },

  actionText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 11,
  },

  addButton: {
    backgroundColor: "#00154f",
    margin: 20,
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },

  savedBox: {
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 20,
    marginBottom: 60,
  },

  savedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  savedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 14,
  },

  savedIngredient: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00154f",
  },

  deleteButton: {
    backgroundColor: "red",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },

  deleteText: {
    color: "white",
    fontWeight: "bold",
  },

});

