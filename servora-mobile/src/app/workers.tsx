import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
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

const kitchens = [

  "Main Kitchen",
  "Bar",
  "Bakery",
  "Pizza",
  "Sushi",
  "Grill",
  "Coffee",
  "Dessert",

];

export default function WorkersScreen() {

  const [name, setName] =
    useState("");

  const [position, setPosition] =
    useState("");

  const [salary, setSalary] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [kitchen, setKitchen] =
    useState("Main Kitchen");

  const [workers, setWorkers] =
    useState<any[]>([]);

  const getWorkers =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "workers"
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

        setWorkers(data);

      } catch (error) {

        console.log(error);

      }

    };

  const addWorker =
    async () => {

      if (
        !name ||
        !position ||
        !salary
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      try {

        const serialNumber =
          workers.length + 1;

        await addDoc(
          collection(
            db,
            "workers"
          ),
          {
            serialNumber:
              `#${serialNumber}`,
            name,
            position,
            salary:
              Number(salary),
            phone,
            kitchen,
            active: true,
            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Worker Added"
        );

        setName("");
        setPosition("");
        setSalary("");
        setPhone("");

        getWorkers();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const deleteWorker =
    async (id: string) => {

      Alert.alert(
        "Delete Worker",
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
                      "workers",
                      id
                    )
                  );

                  getWorkers();

                } catch (error) {

                  console.log(error);

                }

              },
          },

        ]
      );

    };

  useEffect(() => {

    getWorkers();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          WORKERS
        </Text>

        <Text style={styles.subtitle}>
          Global Restaurant ERP
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Worker Name"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Position"
          value={position}
          onChangeText={setPosition}
        />

        <TextInput
          style={styles.input}
          placeholder="Monthly Salary"
          keyboardType="numeric"
          value={salary}
          onChangeText={setSalary}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>
          Select Department
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.row}
        >

          {kitchens.map((item) => (

            <TouchableOpacity
              key={item}
              style={[
                styles.kitchenButton,

                kitchen === item &&
                styles.activeKitchen,
              ]}
              onPress={() =>
                setKitchen(item)
              }
            >

              <Text style={styles.kitchenText}>
                {item}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={addWorker}
        >

          <Text style={styles.addText}>
            ADD WORKER
          </Text>

        </TouchableOpacity>

      </View>

      <View style={styles.listBox}>

        <Text style={styles.listTitle}>
          STAFF LIST
        </Text>

        {workers.map((item) => (

          <View
            key={item.id}
            style={styles.workerCard}
          >

            <View style={styles.topRow}>

              <Text style={styles.serial}>
                {item.serialNumber}
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  deleteWorker(
                    item.id
                  )
                }
              >

                <Text style={styles.deleteText}>
                  DELETE
                </Text>

              </TouchableOpacity>

            </View>

            <Text style={styles.name}>
              {item.name}
            </Text>

            <Text style={styles.info}>
              Position:
              {" "}
              {item.position}
            </Text>

            <Text style={styles.info}>
              Department:
              {" "}
              {item.kitchen}
            </Text>

            <Text style={styles.info}>
              Salary:
              {" "}
              €{item.salary}
            </Text>

            <Text style={styles.info}>
              Phone:
              {" "}
              {item.phone}
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

  row: {
    marginBottom: 20,
  },

  kitchenButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },

  activeKitchen: {
    backgroundColor: "#00154f",
  },

  kitchenText: {
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

  workerCard: {
    backgroundColor: "white",
    padding: 22,
    borderRadius: 22,
    marginBottom: 20,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  serial: {
    fontSize: 22,
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

  name: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 18,
  },

  info: {
    fontSize: 18,
    marginTop: 10,
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

});

