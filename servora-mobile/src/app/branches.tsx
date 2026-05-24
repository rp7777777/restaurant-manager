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

export default function BranchesScreen() {

  const [branchName, setBranchName] =
    useState("");

  const [country, setCountry] =
    useState("");

  const [city, setCity] =
    useState("");

  const [manager, setManager] =
    useState("");

  const [branches, setBranches] =
    useState<any[]>([]);

  const getBranches =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "branches"
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

        setBranches(data);

      } catch (error) {

        console.log(error);

      }

    };

  const addBranch =
    async () => {

      if (
        !branchName ||
        !country ||
        !city
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
            "branches"
          ),
          {
            branchName,
            country,
            city,
            manager,
            active: true,
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Branch Added"
        );

        setBranchName("");
        setCountry("");
        setCity("");
        setManager("");

        getBranches();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const deleteBranch =
    async (id: string) => {

      Alert.alert(
        "Delete Branch",
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
                      "branches",
                      id
                    )
                  );

                  getBranches();

                } catch (error) {

                  console.log(error);

                }

              },
          },

        ]
      );

    };

  useEffect(() => {

    getBranches();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          BRANCHES
        </Text>

        <Text style={styles.subtitle}>
          Multi-Branch Management
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Branch Name"
          value={branchName}
          onChangeText={
            setBranchName
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Country"
          value={country}
          onChangeText={
            setCountry
          }
        />

        <TextInput
          style={styles.input}
          placeholder="City"
          value={city}
          onChangeText={
            setCity
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Branch Manager"
          value={manager}
          onChangeText={
            setManager
          }
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={addBranch}
        >

          <Text style={styles.addText}>
            ADD BRANCH
          </Text>

        </TouchableOpacity>

      </View>

      <View style={styles.listBox}>

        <Text style={styles.listTitle}>
          GLOBAL BRANCHES
        </Text>

        {branches.map((item) => (

          <View
            key={item.id}
            style={styles.branchCard}
          >

            <View style={styles.topRow}>

              <Text style={styles.branchName}>
                {item.branchName}
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  deleteBranch(
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
              Country:
              {" "}
              {item.country}
            </Text>

            <Text style={styles.info}>
              City:
              {" "}
              {item.city}
            </Text>

            <Text style={styles.info}>
              Manager:
              {" "}
              {item.manager}
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

  branchCard: {
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

  branchName: {
    fontSize: 28,
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

  status: {
    marginTop: 18,
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
    marginTop: 16,
    color: "gray",
    fontSize: 14,
  },

});

