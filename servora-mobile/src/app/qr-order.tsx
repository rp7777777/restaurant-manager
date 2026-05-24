import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";

import {
  addDoc,
  collection,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

const tables = [

  "Table 1",
  "Table 2",
  "Table 3",
  "Table 4",
  "Table 5",
  "Table 6",

];

const menuItems = [

  {
    id: 1,
    name: "Salmon Sushi",
    price: 24,
  },

  {
    id: 2,
    name: "Pepperoni Pizza",
    price: 18,
  },

  {
    id: 3,
    name: "Chicken Burger",
    price: 14,
  },

  {
    id: 4,
    name: "Fresh Beer",
    price: 8,
  },

  {
    id: 5,
    name: "Latte Coffee",
    price: 5,
  },

];

export default function QROrderScreen() {

  const [selectedTable,
    setSelectedTable] =
      useState("Table 1");

  const [customerName,
    setCustomerName] =
      useState("");

  const [notes,
    setNotes] =
      useState("");

  const [cart,
    setCart] =
      useState<any[]>([]);

  const addToCart =
    (item: any) => {

      const existing =
        cart.find(
          (cartItem) =>
            cartItem.id === item.id
        );

      if (existing) {

        const updated =
          cart.map((cartItem) => {

            if (
              cartItem.id === item.id
            ) {

              return {
                ...cartItem,
                quantity:
                  cartItem.quantity + 1,
              };

            }

            return cartItem;

          });

        setCart(updated);

      } else {

        setCart([
          ...cart,
          {
            ...item,
            quantity: 1,
          },
        ]);

      }

    };

  const removeItem =
    (id: number) => {

      const updated =
        cart.filter(
          (item) =>
            item.id !== id
        );

      setCart(updated);

    };

  const getTotal =
    () => {

      return cart.reduce(
        (
          total,
          item
        ) =>

          total +
          item.price *
            item.quantity,

        0
      );

    };

  const placeOrder =
    async () => {

      if (
        cart.length === 0
      ) {

        Alert.alert(
          "Error",
          "Cart is empty"
        );

        return;

      }

      try {

        await addDoc(
          collection(
            db,
            "orders"
          ),
          {
            tableNumber:
              selectedTable,

            customerName,

            notes,

            items: cart,

            total:
              getTotal(),

            source:
              "QR_ORDER",

            status:
              "PREPARING",

            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "QR Order Sent To Kitchen"
        );

        setCart([]);
        setCustomerName("");
        setNotes("");

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          QR ORDER
        </Text>

        <Text style={styles.subtitle}>
          Scan & Order System
        </Text>

      </View>

      <View style={styles.form}>

        <Text style={styles.label}>
          Select Table
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.tableRow}
        >

          {tables.map((item) => (

            <TouchableOpacity
              key={item}
              style={[

                styles.tableButton,

                selectedTable ===
                  item &&
                styles.activeTable,

              ]}
              onPress={() =>
                setSelectedTable(
                  item
                )
              }
            >

              <Text style={styles.tableText}>
                {item}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Customer Name"
          value={customerName}
          onChangeText={
            setCustomerName
          }
        />

      </View>

      <Text style={styles.sectionTitle}>
        MENU
      </Text>

      <View style={styles.menuGrid}>

        {menuItems.map((item) => (

          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() =>
              addToCart(item)
            }
          >

            <Text style={styles.menuName}>
              {item.name}
            </Text>

            <Text style={styles.price}>
              €{item.price}
            </Text>

          </TouchableOpacity>

        ))}

      </View>

      <Text style={styles.sectionTitle}>
        CART
      </Text>

      <View style={styles.cartBox}>

        {cart.map((item) => (

          <View
            key={item.id}
            style={styles.cartItem}
          >

            <View>

              <Text style={styles.cartName}>
                {item.name}
              </Text>

              <Text style={styles.cartInfo}>
                Qty:
                {" "}
                {item.quantity}
              </Text>

            </View>

            <View>

              <Text style={styles.cartPrice}>
                €
                {item.price *
                  item.quantity}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  removeItem(
                    item.id
                  )
                }
              >

                <Text style={styles.remove}>
                  REMOVE
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        ))}

        <Text style={styles.total}>
          TOTAL:
          €{getTotal()}
        </Text>

        <TextInput
          style={styles.notesInput}
          placeholder="Special Notes..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={styles.orderButton}
          onPress={placeOrder}
        >

          <Text style={styles.orderText}>
            PLACE QR ORDER
          </Text>

        </TouchableOpacity>

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
    fontSize: 40,
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 14,
  },

  tableRow: {
    marginBottom: 22,
  },

  tableButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    marginRight: 12,
  },

  activeTable: {
    backgroundColor: "#00154f",
  },

  tableText: {
    color: "black",
    fontWeight: "bold",
  },

  input: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    fontSize: 18,
  },

  sectionTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginHorizontal: 20,
    marginBottom: 20,
  },

  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },

  menuCard: {
    backgroundColor: "white",
    width: "48%",
    padding: 24,
    borderRadius: 22,
    marginBottom: 20,
  },

  menuName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
  },

  price: {
    fontSize: 28,
    fontWeight: "bold",
    color: "green",
    marginTop: 18,
  },

  cartBox: {
    backgroundColor: "white",
    margin: 20,
    padding: 24,
    borderRadius: 24,
    marginBottom: 80,
  },

  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 16,
  },

  cartName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
  },

  cartInfo: {
    fontSize: 16,
    marginTop: 6,
    color: "#555",
  },

  cartPrice: {
    fontSize: 22,
    fontWeight: "bold",
    color: "green",
  },

  remove: {
    color: "red",
    marginTop: 8,
    fontWeight: "bold",
  },

  total: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 24,
  },

  notesInput: {
    backgroundColor: "#f4f4f4",
    padding: 20,
    borderRadius: 18,
    marginTop: 24,
    height: 120,
    textAlignVertical: "top",
    fontSize: 17,
  },

  orderButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 30,
  },

  orderText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

});

