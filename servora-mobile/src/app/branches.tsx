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

export default function BranchesScreen() {

  const [branchName,
    setBranchName] =
      useState("");

  const [location,
    setLocation] =
      useState("");

  const [manager,
    setManager] =
      useState("");

  const [branches,
    setBranches] =
      useState<any[]>([]);

  const addBranch =
    () => {

      if (
        !branchName ||
        !location ||
        !manager
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newBranch = {

        id:
          Date.now(),

        branchName,

        location,

        manager,

      };

      setBranches([
        newBranch,
        ...branches,
      ]);

      setBranchName("");
      setLocation("");
      setManager("");

      Alert.alert(
        "Success",
        "Branch Added"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            BRANCHES
          </Text>

          <Text style={styles.subtitle}>
            Multi Branch Management
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Branch Name"
            value={branchName}
            onChangeText={setBranchName}
          />

          <TextInput
            style={styles.input}
            placeholder="Location"
            value={location}
            onChangeText={setLocation}
          />

          <TextInput
            style={styles.input}
            placeholder="Manager Name"
            value={manager}
            onChangeText={setManager}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={addBranch}
          >

            <Text style={styles.buttonText}>
              ADD BRANCH
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {branches.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.branchName}>
                  {item.branchName}
                </Text>

                <Text style={styles.info}>
                  Location:
                  {" "}
                  {item.location}
                </Text>

                <Text style={styles.info}>
                  Manager:
                  {" "}
                  {item.manager}
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

    branchName: {
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

