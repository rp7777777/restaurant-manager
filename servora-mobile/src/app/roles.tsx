import AuthGuard from "./auth-guard";

import React, {
  useEffect,
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

import {
  collection,
  addDoc,
  onSnapshot,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function RolesScreen() {

  const [employeeName,
    setEmployeeName] =
      useState("");

  const [role,
    setRole] =
      useState("");

  const [roles,
    setRoles] =
      useState<any[]>([]);

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsubscribe =

      onSnapshot(

        collection(
          db,
          "roles"
        ),

        (snapshot) => {

          const data:
            any[] = [];

          snapshot.forEach(
            (document) => {

              const item =
                document.data();

              if (
                item.userId ===
                user.uid
              ) {

                data.push(item);

              }

            }
          );

          setRoles(data);

        }

      );

    return () =>
      unsubscribe();

  }, []);

  const saveRole =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !employeeName ||
        !role
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      await addDoc(

        collection(
          db,
          "roles"
        ),

        {

          userId:
            user.uid,

          employeeName,

          role,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Role Assigned"
      );

      setEmployeeName("");

      setRole("");

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            ROLE MANAGEMENT
          </Text>

          <Text style={styles.subtitle}>
            Staff Permission Control
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Employee Name"
            value={employeeName}
            onChangeText={
              setEmployeeName
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Role (OWNER / MANAGER / CASHIER / STORE)"
            value={role}
            onChangeText={
              setRole
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveRole
            }
          >

            <Text style={styles.buttonText}>
              SAVE ROLE
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.historyContainer}>

          <Text style={styles.sectionTitle}>
            Assigned Roles
          </Text>

          {roles.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.card}
              >

                <Text style={styles.employee}>
                  {item.employeeName}
                </Text>

                <Text style={styles.role}>
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

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  logo: {
    fontSize: 30,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },

  form: {
    padding: 16,
  },

  input: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    fontSize: 16,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },

  historyContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 20,
    marginBottom: 16,
  },

  employee: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  role: {
    fontSize: 18,
    color: "green",
    fontWeight: "bold",
    marginTop: 12,
  },

});

