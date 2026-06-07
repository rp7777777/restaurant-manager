import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

import {
  useRouter,
} from "expo-router";

export default function RegisterScreen() {

  const router =
    useRouter();

  const [fullName,
    setFullName] =
      useState("");

  const [email,
    setEmail] =
      useState("");

  const [password,
    setPassword] =
      useState("");

  const [confirmPassword,
    setConfirmPassword] =
      useState("");

  const register =
    async () => {

      if (
        !fullName ||
        !email ||
        !password ||
        !confirmPassword
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      if (
        password !==
        confirmPassword
      ) {

        Alert.alert(
          "Error",
          "Passwords do not match"
        );

        return;

      }

      try {

        const userCredential =

          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        await updateProfile(

          userCredential.user,

          {
            displayName:
              fullName,
          }

        );

        Alert.alert(
          "Success",
          "Account Created Successfully"
        );

        router.replace(
          "/dashboard"
        );

      } catch (error: any) {


        console.log(error);


        Alert.alert(
          "Register Failed",
          error.message
        );

      }

    };

  return (

    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >

      <View
        style={styles.card}
      >

        <Text
          style={styles.logo}
        >
          SERVORA ERP
        </Text>

        <Text
          style={styles.subtitle}
        >
          Create Your Account
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={
            setFullName
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={
            setEmail
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={
            setPassword
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={
            setConfirmPassword
          }
        />

        <TouchableOpacity
          style={styles.button}
          onPress={register}
        >

          <Text
            style={styles.buttonText}
          >
            REGISTER
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push(
              "/login"
            )
          }
        >

          <Text
            style={styles.link}
          >
            Already Have Account?
          </Text>

        </TouchableOpacity>

      </View>

    </ScrollView>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flexGrow: 1,
      justifyContent:
        "center",
      alignItems:
        "center",
      backgroundColor:
        "#eef2f7",
      padding: 20,
    },

    card: {
      width: "100%",
      maxWidth: 420,
      backgroundColor:
        "white",
      padding: 30,
      borderRadius: 30,
    },

    logo: {
      fontSize: 38,
      fontWeight: "bold",
      color: "#00154f",
      textAlign: "center",
    },

    subtitle: {
      fontSize: 18,
      color: "#555",
      textAlign: "center",
      marginTop: 10,
      marginBottom: 30,
    },

    input: {
      backgroundColor:
        "#f3f4f6",
      padding: 18,
      borderRadius: 18,
      marginBottom: 18,
      fontSize: 18,
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 20,
      borderRadius: 18,
      alignItems: "center",
      marginTop: 10,
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

    link: {
      textAlign: "center",
      marginTop: 20,
      fontSize: 16,
      color: "#00154f",
      fontWeight: "bold",
    },

  });

