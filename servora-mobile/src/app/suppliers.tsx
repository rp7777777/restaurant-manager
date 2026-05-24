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

export default function SuppliersScreen() {

  const [supplierName, setSupplierName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [ingredient, setIngredient] =
    useState("");

  const [pendingInvoice, setPendingInvoice] =
    useState("");

  const [suppliers, setSuppliers] =
    useState<any[]>([]);

  const getSuppliers =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "suppliers"
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

        setSuppliers(data);

      } catch (error) {

        console.log(error);

      }

    };

  const addSupplier =
    async () => {

      if (
        !supplierName ||
        !phone
      ) {

        Alert.alert(
          "Error",
          "Fill required fields"
        );

        return;

      }

      try {

        await addDoc(
          collection(
            db,
            "suppliers"
          ),
          {
            supplierName,
            phone,
            email,
            ingredient,
            pendingInvoice:
              Number(
                pendingInvoice
              ),

            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Supplier Added"
        );

        setSupplierName("");
        setPhone("");
        setEmail("");
        setIngredient("");
        setPendingInvoice("");

        getSuppliers();

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  const deleteSupplier =
    async (id: string) => {

      Alert.alert(
        "Delete Supplier",
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
                      "suppliers",
                      id
                    )
                  );

                  getSuppliers();

                } catch (error) {

                  console.log(error);

                }

              },
          },

        ]
      );

    };

  useEffect(() => {

    getSuppliers();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          SUPPLIERS
        </Text>

        <Text style={styles.subtitle}>
          Supplier Management
        </Text>

      </View>

      <View style={styles.form}>

        <TextInput
          style={styles.input}
          placeholder="Supplier Name"
          value={supplierName}
          onChangeText={
            setSupplierName
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
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
          placeholder="Ingredient Supply"
          value={ingredient}
          onChangeText={
            setIngredient
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Pending Invoice"
          keyboardType="numeric"
          value={pendingInvoice}
          onChangeText={
            setPendingInvoice
          }
        />

        <TouchableOpacity
          style={styles.addButton}
          onPress={addSupplier}
        >

          <Text style={styles.addText}>
            ADD SUPPLIER
          </Text>

        </TouchableOpacity>

      </View>

      <View style={styles.listBox}>

        <Text style={styles.listTitle}>
          SUPPLIER LIST
        </Text>

        {suppliers.map((item) => (

          <View
            key={item.id}
            style={styles.supplierCard}
          >

            <View style={styles.topRow}>

              <Text style={styles.name}>
                {item.supplierName}
              </Text>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  deleteSupplier(
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
              Phone:
              {" "}
              {item.phone}
            </Text>

            <Text style={styles.info}>
              Email:
              {" "}
              {item.email}
            </Text>

            <Text style={styles.info}>
              Ingredient:
              {" "}
              {item.ingredient}
            </Text>

            <Text style={styles.invoice}>
              Pending Invoice:
              {" "}
              €{item.pendingInvoice}
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

  supplierCard: {
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

  invoice: {
    fontSize: 22,
    marginTop: 18,
    color: "red",
    fontWeight: "bold",
  },

  date: {
    marginTop: 16,
    color: "gray",
    fontSize: 14,
  },

});

