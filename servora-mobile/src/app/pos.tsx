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

const menuItems = [

  {
    id: 1,
    name: "Sushi Set",
    price: 25,
    category: "Sushi",
  },

  {
    id: 2,
    name: "Pizza",
    price: 18,
    category: "Pizza",
  },

  {
    id: 3,
    name: "Burger",
    price: 14,
    category: "Fast Food",
  },

  {
    id: 4,
    name: "Beer",
    price: 8,
    category: "Bar",
  },

  {
    id: 5,
    name: "Coffee",
    price: 5,
    category: "Coffee",
  },

];

export default function POSScreen() {

  const [cart, setCart] =
    useState<any[]>([]);

  const [tableNumber, setTableNumber] =
    useState("");

  const [customerName, setCustomerName] =
    useState("");

  const [notes, setNotes] =
    useState("");

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
                  cartItem.quantity +
                  1,
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

  const removeFromCart =
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
            tableNumber,
            customerName,
            notes,
            items: cart,
            total:
              getTotal(),
            status:
              "PREPARING",
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Order Sent To Kitchen"
        );

        setCart([]);
        setTableNumber("");
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
          SERVORA POS
        </Text>

        <Text style={styles.subtitle}>
          Customer Order System
        </Text>

      </View>

      <View style={styles.form}>

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

            <Text style={styles.menuCategory}>
              {item.category}
            </Text>

            <Text style={styles.menuPrice}>
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
                  removeFromCart(
                    item.id
                  )
                }
              >

                <Text
                  style={
                    styles.removeText
                  }
                >
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
            SEND TO KITCHEN
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

  sectionTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginHorizontal: 20,
    marginTop: 10,
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  menuCategory: {
    fontSize: 16,
    color: "gray",
    marginTop: 10,
  },

  menuPrice: {
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

  removeText: {
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
    borderRadius: 20,
    alignItems: "center",
    marginTop: 30,
  },

  orderText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

});

