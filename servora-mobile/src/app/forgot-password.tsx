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
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

import {
  useRouter,
} from "expo-router";

export default function ForgotPasswordScreen() {

  const router =
    useRouter();

  const [email,
    setEmail] =
      useState("");

  const resetPassword =
    async () => {

      if (!email) {

        Alert.alert(
          "Error",
          "Enter your email"
        );

        return;

      }

      try {

        await sendPasswordResetEmail(
          auth,
          email
        );

        Alert.alert(
          "Success",
          "Password reset email sent"
        );

        router.replace(
          "/login"
        );

      } catch (error: any) {

        Alert.alert(
          "Reset Failed",
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
          RESET PASSWORD
        </Text>

        <Text
          style={styles.subtitle}
        >
          Enter your email address
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

        <TouchableOpacity
          style={styles.button}
          onPress={
            resetPassword
          }
        >

          <Text
            style={styles.buttonText}
          >
            SEND RESET EMAIL
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
            Back To Login
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
      fontSize: 34,
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

