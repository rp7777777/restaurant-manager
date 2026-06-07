import React from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import {
  router,
} from "expo-router";

export default function Index() {

  return (

    <View style={styles.container}>

      <Text style={styles.title}>
        SERVORA ERP
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push("/login")
        }
      >

        <Text style={styles.buttonText}>
          OPEN APP
        </Text>

      </TouchableOpacity>

    </View>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },

  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#001f6b",
    marginBottom: 40,
  },

  button: {
    backgroundColor: "#001f6b",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 14,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

});