import React, {
  useState,
} from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import {
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

import {
  router,
} from "expo-router";

export default function LoginScreen() {

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleLogin =
    async () => {

      if (!email || !password) {

        Alert.alert(
          "Error",
          "Enter email and password"
        );

        return;

      }

      try {

        setLoading(true);

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        Alert.alert(
          "Success",
          "Admin Login Successful"
        );

        router.replace(
          "/dashboard"
        );

      } catch (error: any) {

        Alert.alert(
          "Login Error",
          error.message
        );

      } finally {

        setLoading(false);

      }

    };

  return (

    <View style={styles.container}>

      <View style={styles.card}>

        <Text style={styles.logo}>
          SERVORA
        </Text>

        <Text style={styles.subtitle}>
          Global Restaurant ERP
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Admin Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
        >

          <Text style={styles.buttonText}>
            {loading
              ? "Logging In..."
              : "LOGIN"}
          </Text>

        </TouchableOpacity>

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00154f",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    padding: 35,
    borderRadius: 30,
  },

  logo: {
    fontSize: 52,
    fontWeight: "bold",
    color: "#00154f",
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: "gray",
    fontSize: 20,
    marginTop: 10,
    marginBottom: 35,
  },

  input: {
    backgroundColor: "#f4f4f4",
    padding: 20,
    borderRadius: 18,
    fontSize: 18,
    marginBottom: 22,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 22,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

});

