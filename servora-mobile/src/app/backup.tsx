import AuthGuard from "./auth-guard";

import React from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

import * as Sharing from "expo-sharing";

import {
  Paths,
  File,
} from "expo-file-system";

export default function BackupScreen() {

  const createBackup =
    async () => {

      try {

        const user =
          auth.currentUser;

        if (!user) return;

        const collections = [

          "sales",
          "expenses",
          "inventory",
          "payroll",
          "attendance",
          "employees",
          "roles",
          "settings",
          "restaurantProfiles",

        ];

        const backupData:
          any = {};

        for (
          const collectionName
          of collections
        ) {

          const snapshot =
            await getDocs(

              collection(
                db,
                collectionName
              )

            );

          backupData[
            collectionName
          ] = [];

          snapshot.forEach(
            (document) => {

              const item =
                document.data();

              if (
                item.userId ===
                user.uid
              ) {

                backupData[
                  collectionName
                ].push(item);

              }

            }
          );

        }

        const file =
          new File(

            Paths.cache,

            "servora-backup.json"

          );

        file.write(

          JSON.stringify(
            backupData
          )

        );

        await Sharing.shareAsync(
          file.uri
        );

        Alert.alert(
          "Success",
          "Backup Created"
        );

      } catch (error) {

        console.log(error);

        Alert.alert(
          "Error",
          "Backup Failed"
        );

      }

    };

  return (

    <AuthGuard>

      <View style={styles.container}>

        <Text style={styles.logo}>
          BACKUP SYSTEM
        </Text>

        <Text style={styles.subtitle}>
          Export Full ERP Backup
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={
            createBackup
          }
        >

          <Text style={styles.buttonText}>
            CREATE BACKUP
          </Text>

        </TouchableOpacity>

      </View>

    </AuthGuard>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2f7",
    padding: 20,
  },

  logo: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 14,
  },

  subtitle: {
    fontSize: 18,
    color: "#555",
    marginBottom: 40,
    textAlign: "center",
  },

  button: {
    backgroundColor: "#00154f",
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 20,
  },

  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },

});

