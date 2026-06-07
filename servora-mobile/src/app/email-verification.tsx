import React from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";

import {
  sendEmailVerification,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

export default function EmailVerificationScreen() {

  const sendVerification =
    async () => {

      const user =
        auth.currentUser;

      if (!user) {

        Alert.alert(
          "Error",
          "No logged in user"
        );

        return;

      }

      try {

        await sendEmailVerification(
          user
        );

        Alert.alert(
          "Success",
          "Verification Email Sent"
        );

      } catch (error: any) {

        Alert.alert(
          "Error",
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
          style={styles.title}
        >
          EMAIL VERIFICATION
        </Text>

        <Text
          style={styles.subtitle}
        >
          Verify your email
          before using app
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={
            sendVerification
          }
        >

          <Text
            style={styles.buttonText}
          >
            SEND VERIFICATION EMAIL
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

    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: "#00154f",
      textAlign: "center",
    },

    subtitle: {
      fontSize: 18,
      color: "#555",
      textAlign: "center",
      marginTop: 16,
      marginBottom: 30,
      lineHeight: 28,
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 20,
      borderRadius: 18,
      alignItems: "center",
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

  });

