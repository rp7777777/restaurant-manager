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

export default function UsersScreen() {

  const [name,
    setName] =
      useState("");

  const [role,
    setRole] =
      useState("");

  const [users,
    setUsers] =
      useState<any[]>([]);

  const addUser =
    () => {

      if (
        !name ||
        !role
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newUser = {

        id:
          Date.now(),

        name,

        role,

      };

      setUsers([
        newUser,
        ...users,
      ]);

      setName("");
      setRole("");

      Alert.alert(
        "Success",
        "User Added"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            USERS
          </Text>

          <Text style={styles.subtitle}>
            User Management System
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="User Name"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Role"
            value={role}
            onChangeText={setRole}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={addUser}
          >

            <Text style={styles.buttonText}>
              ADD USER
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {users.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.userName}>
                  {item.name}
                </Text>

                <Text style={styles.role}>
                  Role:
                  {" "}
                  {item.role}
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

    userName: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    role: {
      fontSize: 18,
      marginTop: 12,
      color: "#444",
    },

  });

