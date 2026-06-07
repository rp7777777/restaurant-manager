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
  Alert,
} from "react-native";

export default function SuppliersScreen() {

  const [supplierName,
    setSupplierName] =
      useState("");

  const [company,
    setCompany] =
      useState("");

  const [phone,
    setPhone] =
      useState("");

  const [suppliers,
    setSuppliers] =
      useState<any[]>([]);

  const addSupplier =
    () => {

      if (
        !supplierName ||
        !company ||
        !phone
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      const newSupplier = {

        id:
          Date.now(),

        supplierName,

        company,

        phone,

      };

      setSuppliers([
        newSupplier,
        ...suppliers,
      ]);

      setSupplierName("");
      setCompany("");
      setPhone("");

      Alert.alert(
        "Success",
        "Supplier Added"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            SUPPLIERS
          </Text>

          <Text style={styles.subtitle}>
            Supplier Management System
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
            placeholder="Company Name"
            value={company}
            onChangeText={
              setCompany
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={
              setPhone
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={addSupplier}
          >

            <Text style={styles.buttonText}>
              ADD SUPPLIER
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.listContainer}>

          {suppliers.map(
            (
              item
            ) => (

              <View
                key={item.id}
                style={styles.card}
              >

                <Text style={styles.supplierName}>
                  {item.supplierName}
                </Text>

                <Text style={styles.info}>
                  Company:
                  {" "}
                  {item.company}
                </Text>

                <Text style={styles.info}>
                  Phone:
                  {" "}
                  {item.phone}
                </Text>

              </View>

            )
          )}

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

    form: {
      padding: 20,
    },

    input: {
      backgroundColor:
        "white",
      padding: 18,
      borderRadius: 18,
      marginBottom: 18,
      fontSize: 18,
    },

    button: {
      backgroundColor:
        "#00154f",
      padding: 22,
      borderRadius: 18,
      alignItems: "center",
    },

    buttonText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

    listContainer: {
      padding: 20,
      paddingBottom: 100,
    },

    card: {
      backgroundColor:
        "white",
      padding: 24,
      borderRadius: 24,
      marginBottom: 20,
    },

    supplierName: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#00154f",
    },

    info: {
      fontSize: 18,
      marginTop: 12,
      color: "#444",
    },

  });

