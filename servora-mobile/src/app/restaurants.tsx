import AuthGuard from "./auth-guard";

import React, {
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

export default function RestaurantsScreen() {

  const [restaurantName,
    setRestaurantName] =
      useState("");

  const [location,
    setLocation] =
      useState("");

  const [owner,
    setOwner] =
      useState("");

  const [restaurants,
    setRestaurants] =
      useState<any[]>([]);

  const addRestaurant =
    () => {

      if (
        !restaurantName ||
        !location ||
        !owner
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newRestaurant = {

        id:
          Date.now(),

        restaurantName,

        location,

        owner,

      };

      setRestaurants([
        newRestaurant,
        ...restaurants,
      ]);

      setRestaurantName("");
      setLocation("");
      setOwner("");

      Alert.alert(
        "Success",
        "Restaurant Added"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            RESTAURANTS
          </Text>

          <Text style={styles.subtitle}>
            Restaurant Management
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Restaurant Name"
            value={restaurantName}
            onChangeText={
              setRestaurantName
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Location"
            value={location}
            onChangeText={
              setLocation
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Owner Name"
            value={owner}
            onChangeText={
              setOwner
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={addRestaurant}
          >

            <Text style={styles.buttonText}>
              ADD RESTAURANT
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {restaurants.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.restaurantName}>
                  {item.restaurantName}
                </Text>

                <Text style={styles.info}>
                  Location:
                  {" "}
                  {item.location}
                </Text>

                <Text style={styles.info}>
                  Owner:
                  {" "}
                  {item.owner}
                </Text>

              </View>

            )
          )}

        </View>

      </ScrollView>

    </AuthGuard>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        "#eef2f7",
    },

    header: {
      backgroundColor:
        "#00154f",
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
      backgroundColor:
        "white",
      padding: 18,
      borderRadius: 18,
      marginBottom: 18,
      fontSize: 18,
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 22,
      borderRadius: 18,
      alignItems: "center",
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

    listContainer: {
      padding: 20,
      paddingBottom: 100,
    },

    card: {
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 20,
    },

    restaurantName: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    info: {
      fontSize: 18,
      marginTop: 12,
      color: "#444",
    },

  });

