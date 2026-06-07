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
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

export default function LoginScreen() {

  const router =
    useRouter();

  const [email,
    setEmail] =
      useState("");

  const [password,
    setPassword] =
      useState("");

  const login =
    async () => {

      if (
        !email ||
        !password
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      try {

        const userCredential =

          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        const user =
          userCredential.user;

        if (
          !user.emailVerified
        ) {

          await sendEmailVerification(
            user
          );

          Alert.alert(
            "Verify Email",
            "Verification email sent. Please verify your email first."
          );

          return;

        }

        Alert.alert(
          "Success",
          "Login Successful"
        );

        router.replace(
          "/dashboard"
        );

      } catch (error: any) {

        Alert.alert(
          "Login Failed",
          error.message
        );

      }

    };

  return (

    <View
      style={styles.container}
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
          Login To Continue
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
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

        <TouchableOpacity
          style={styles.button}
          onPress={login}
        >

          <Text
            style={styles.buttonText}
          >
            LOGIN
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push(
              "/register"
            )
          }
        >

          <Text
            style={styles.link}
          >
            Create New Account
          </Text>

        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push(
              "/forgot-password"
            )
          }
        >

          <Text
            style={styles.link}
          >
            Forgot Password?
          </Text>

        </TouchableOpacity>

      </View>

    </View>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
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

