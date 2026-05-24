import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";

import {
  addDoc,
  collection,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase";

export default function RestaurantsScreen() {
  const [restaurantName, setRestaurantName] =
    useState("");

  const [restaurants, setRestaurants] =
    useState([]);

  const getRestaurants = async () => {
    try {
      const querySnapshot = await getDocs(
        collection(db, "restaurants")
      );

      const data: any = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setRestaurants(data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getRestaurants();
  }, []);

  const addRestaurant = async () => {
    if (!restaurantName) {
      Alert.alert(
        "Error",
        "Enter restaurant name"
      );
      return;
    }

    try {
      await addDoc(
        collection(db, "restaurants"),
        {
          name: restaurantName,
          createdAt: new Date(),
        }
      );

      Alert.alert(
        "Success",
        "Restaurant Added"
      );

      setRestaurantName("");

      getRestaurants();
    } catch (error) {
      console.log(error);

      Alert.alert(
        "Error",
        "Failed to add restaurant"
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          RESTAURANTS
        </Text>

        <Text style={styles.subtitle}>
          Multi Restaurant Management
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>
          Restaurant Name
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter restaurant name"
          value={restaurantName}
          onChangeText={setRestaurantName}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={addRestaurant}
        >
          <Text style={styles.buttonText}>
            Add Restaurant
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Your Restaurants
      </Text>

      {restaurants.map((item: any) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardText}>
            {item.name}
          </Text>
        </View>
      ))}
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
    marginTop: 10,
  },

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 10,
  },

  input: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 16,
    fontSize: 20,
    marginBottom: 20,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 18,
    elevation: 4,
  },

  cardText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },
});