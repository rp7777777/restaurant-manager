import AuthGuard from "./auth-guard";

import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function WorkersScreen() {

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            WORKERS
          </Text>

        </View>

        <View style={styles.card}>

          <Text style={styles.name}>
            John Worker
          </Text>

          <Text style={styles.info}>
            Chef
          </Text>

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

  card: {
    backgroundColor: "white",
    margin: 20,
    padding: 24,
    borderRadius: 24,
  },

  name: {
    fontSize: 24,
    fontWeight: "bold",
  },

  info: {
    fontSize: 18,
    marginTop: 12,
  },

});

