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
  onSnapshot,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function RestaurantProfileScreen() {

  const [restaurantName,
    setRestaurantName] =
      useState("");

  const [ownerName,
    setOwnerName] =
      useState("");

  const [phone,
    setPhone] =
      useState("");

  const [email,
    setEmail] =
      useState("");

  const [address,
    setAddress] =
      useState("");

  const [vatNumber,
    setVatNumber] =
      useState("");

  const [profiles,
    setProfiles] =
      useState<any[]>([]);

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsubscribe =

      onSnapshot(

        collection(
          db,
          "restaurantProfiles"
        ),

        (snapshot) => {

          const data:
            any[] = [];

          snapshot.forEach(
            (document) => {

              const item =
                document.data();

              if (
                item.userId ===
                user.uid
              ) {

                data.push(item);

              }

            }
          );

          setProfiles(
            data
          );

        }

      );

    return () =>
      unsubscribe();

  }, []);

  const saveProfile =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !restaurantName
      ) {

        Alert.alert(
          "Error",
          "Restaurant name required"
        );

        return;

      }

      await addDoc(

        collection(
          db,
          "restaurantProfiles"
        ),

        {

          userId:
            user.uid,

          restaurantName,

          ownerName,

          phone,

          email,

          address,

          vatNumber,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Restaurant Profile Saved"
      );

      setRestaurantName("");
      setOwnerName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setVatNumber("");

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            RESTAURANT PROFILE
          </Text>

          <Text style={styles.subtitle}>
            Business Information
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
            placeholder="Owner Name"
            value={ownerName}
            onChangeText={
              setOwnerName
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChangeText={
              setPhone
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={
              setEmail
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Address"
            value={address}
            onChangeText={
              setAddress
            }
          />

          <TextInput
            style={styles.input}
            placeholder="VAT Number"
            value={vatNumber}
            onChangeText={
              setVatNumber
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveProfile
            }
          >

            <Text style={styles.buttonText}>
              SAVE PROFILE
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.historyContainer}>

          <Text style={styles.sectionTitle}>
            Saved Profiles
          </Text>

          {profiles.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.card}
              >

                <Text style={styles.restaurant}>
                  {item.restaurantName}
                </Text>

                <Text style={styles.info}>
                  Owner:
                  {" "}
                  {item.ownerName}
                </Text>

                <Text style={styles.info}>
                  Phone:
                  {" "}
                  {item.phone}
                </Text>

                <Text style={styles.info}>
                  Email:
                  {" "}
                  {item.email}
                </Text>

                <Text style={styles.info}>
                  Address:
                  {" "}
                  {item.address}
                </Text>

                <Text style={styles.info}>
                  VAT:
                  {" "}
                  {item.vatNumber}
                </Text>

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
    fontSize: 30,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
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
    fontWeight: "bold",
    fontSize: 18,
  },

  historyContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 20,
    marginBottom: 16,
  },

  restaurant: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 16,
    color: "#555",
    marginTop: 10,
  },

});

