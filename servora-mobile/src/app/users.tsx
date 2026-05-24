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
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

const roles = [

  "OWNER",
  "MANAGER",
  "KITCHEN",
  "WAITER",
  "CASHIER",
  "INVENTORY",

];

export default function UsersScreen() {

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [branch, setBranch] =
    useState("");

  const [role, setRole] =
    useState("WAITER");

  const [users, setUsers] =
    useState<any[]>([]);

  const getUsers =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "users"
            )
          );

        const data: any[] = [];

        snapshot.forEach(
          (docItem) => {

            data.push({
              id: docItem.id,
              ...(docItem.data() as any),
            });

          }
        );

        data.reverse();

        setUsers(data);

      } catch (error) {

        console.log(error);

      }

    };

  const addUser =
    async () => {

      if (
        !name ||
        !email ||
        !password
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      try {

        await addDoc(
          collection(
            db,
            "users"
          ),
          {
            name,
            email,
            password,
            branch,
            role,
            active: true,
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "User Added"
        );

        setName("");
        setEmail("");
        setPassword("");
        setBranch("");

        getUsers();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const deleteUser =
    async (id: string) => {

      Alert.alert(
        "Delete User",
        "Are you sure?",
        [

          {
            text: "Cancel",
          },

          {
            text: "Delete",

            style: "destructive",

            onPress:
              async () => {

                try {

                  await deleteDoc(
                    doc(
                      db,
                      "users",
                      id
                    )
                  );

                  getUsers();

                } catch (error) {

                  console.log(error);

                }

              },
          },

        ]
      );

    };

  useEffect(() => {

    getUsers();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          USER ACCESS
        </Text>

        <Text style={styles.subtitle}>
          Role Management System
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Branch"
          value={branch}
          onChangeText={setBranch}
        />

        <Text style={styles.label}>
          Select Role
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.roleRow}
        >

          {roles.map((item) => (

            <TouchableOpacity
              key={item}
              style={[
                styles.roleButton,

                role === item &&
                styles.activeRole,
              ]}
              onPress={() =>
                setRole(item)
              }
            >

              <Text style={styles.roleText}>
                {item}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={addUser}
        >

          <Text style={styles.addText}>
            ADD USER
          </Text>

        </TouchableOpacity>

      </View>

      <View style={styles.listBox}>

        <Text style={styles.listTitle}>
          SYSTEM USERS
        </Text>

        {users.map((item) => (

          <View
            key={item.id}
            style={styles.userCard}
          >

            <View style={styles.topRow}>

              <Text style={styles.name}>
                {item.name}
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  deleteUser(
                    item.id
                  )
                }
              >

                <Text style={styles.deleteText}>
                  DELETE
                </Text>

              </TouchableOpacity>

            </View>

            <Text style={styles.info}>
              Email:
              {" "}
              {item.email}
            </Text>

            <Text style={styles.info}>
              Branch:
              {" "}
              {item.branch}
            </Text>

            <Text style={styles.roleBadge}>
              {item.role}
            </Text>

            <Text
              style={[
                styles.status,

                item.active
                  ? styles.active
                  : styles.inactive,
              ]}
            >

              {item.active
                ? "ACTIVE"
                : "INACTIVE"}

            </Text>

            <Text style={styles.date}>

              {
                item.createdAt
                  ?.toDate?.()
                  ?.toLocaleString?.()
              }

            </Text>

          </View>

        ))}

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 35,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logo: {
    color: "gold",
    fontSize: 38,
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
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    fontSize: 18,
    marginBottom: 18,
  },

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 12,
  },

  roleRow: {
    marginBottom: 20,
  },

  roleButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },

  activeRole: {
    backgroundColor: "#00154f",
  },

  roleText: {
    color: "black",
    fontWeight: "bold",
  },

  addButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
  },

  addText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

  listBox: {
    padding: 20,
    paddingBottom: 80,
  },

  listTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  userCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 22,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  name: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#00154f",
  },

  deleteButton: {
    backgroundColor: "red",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },

  deleteText: {
    color: "white",
    fontWeight: "bold",
  },

  info: {
    fontSize: 18,
    marginTop: 12,
    color: "#444",
  },

  roleBadge: {
    marginTop: 18,
    backgroundColor: "#00154f",
    color: "white",
    padding: 10,
    borderRadius: 12,
    overflow: "hidden",
    alignSelf: "flex-start",
    fontWeight: "bold",
  },

  status: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "bold",
  },

  active: {
    color: "green",
  },

  inactive: {
    color: "red",
  },

  date: {
    marginTop: 14,
    color: "gray",
    fontSize: 14,
  },

});

