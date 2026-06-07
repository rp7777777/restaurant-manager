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
} from "react-native";

export default function LoyaltyProScreen() {

  const [customer,
    setCustomer] =
      useState("");

  const [points,
    setPoints] =
      useState("");

  const [members,
    setMembers] =
      useState<any[]>([]);

  const addMember =
    () => {

      const newMember = {

        id:
          Date.now(),

        customer,

        points,

      };

      setMembers([
        newMember,
        ...members,
      ]);

      setCustomer("");
      setPoints("");

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            LOYALTY PRO
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Customer Name"
            value={customer}
            onChangeText={setCustomer}
          />

          <TextInput
            style={styles.input}
            placeholder="Points"
            keyboardType="numeric"
            value={points}
            onChangeText={setPoints}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={addMember}
          >

            <Text style={styles.buttonText}>
              ADD MEMBER
            </Text>

          </TouchableOpacity>

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
    padding: 35,
  },

  logo: {
    color: "gold",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 25,
  },

  form: {
    padding: 20,
  },

  input: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 18,
    marginBottom: 18,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 22,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },

});

