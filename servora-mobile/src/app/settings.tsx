import AuthGuard from "./auth-guard";

import React, {
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";

export default function SettingsScreen() {

  const [darkMode,
    setDarkMode] =
      useState(false);

  const [notifications,
    setNotifications] =
      useState(true);

  const saveSettings =
    () => {

      Alert.alert(
        "Success",
        "Settings Saved"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            SETTINGS
          </Text>

          <Text style={styles.subtitle}>
            System Configuration
          </Text>

        </View>

        <View style={styles.card}>

          <View style={styles.settingRow}>

            <Text style={styles.settingText}>
              Dark Mode
            </Text>

            <Switch
              value={darkMode}
              onValueChange={
                setDarkMode
              }
            />

          </View>

          <View style={styles.settingRow}>

            <Text style={styles.settingText}>
              Notifications
            </Text>

            <Switch
              value={notifications}
              onValueChange={
                setNotifications
              }
            />

          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={saveSettings}
          >

            <Text style={styles.buttonText}>
              SAVE SETTINGS
            </Text>

          </TouchableOpacity>

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

    card: {
      backgroundColor:
        "white",
      margin: 20,
      padding: 28,
      borderRadius: 24,
    },

    settingRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 28,
    },

    settingText: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#00154f",
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 22,
      borderRadius: 18,
      alignItems: "center",
      marginTop: 20,
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

  });

