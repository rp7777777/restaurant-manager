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

export default function EmployeesScreen() {

  const [employeeName,
    setEmployeeName] =
      useState("");

  const [position,
    setPosition] =
      useState("");

  const [phone,
    setPhone] =
      useState("");

  const [salaryRate,
    setSalaryRate] =
      useState("");

  const [joiningDate,
    setJoiningDate] =
      useState("");

  const [status,
    setStatus] =
      useState("ACTIVE");

  const [employees,
    setEmployees] =
      useState<any[]>([]);

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsubscribe =

      onSnapshot(

        collection(
          db,
          "employees"
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

          setEmployees(
            data
          );

        }

      );

    return () =>
      unsubscribe();

  }, []);

  const saveEmployee =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !employeeName ||
        !position
      ) {

        Alert.alert(
          "Error",
          "Fill required fields"
        );

        return;

      }

      await addDoc(

        collection(
          db,
          "employees"
        ),

        {

          userId:
            user.uid,

          employeeName,

          position,

          phone,

          salaryRate,

          joiningDate,

          status,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Employee Saved"
      );

      setEmployeeName("");
      setPosition("");
      setPhone("");
      setSalaryRate("");
      setJoiningDate("");
      setStatus("ACTIVE");

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            EMPLOYEES
          </Text>

          <Text style={styles.subtitle}>
            Staff Management System
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
            placeholder="Position"
            value={position}
            onChangeText={
              setPosition
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChangeText={
              setPhone
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Salary Rate"
            keyboardType="numeric"
            value={salaryRate}
            onChangeText={
              setSalaryRate
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Joining Date"
            value={joiningDate}
            onChangeText={
              setJoiningDate
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Status"
            value={status}
            onChangeText={
              setStatus
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveEmployee
            }
          >

            <Text style={styles.buttonText}>
              SAVE EMPLOYEE
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.historyContainer}>

          <Text style={styles.sectionTitle}>
            Employee List
          </Text>

          {employees.map(
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

                <Text style={styles.info}>
                  Position:
                  {" "}
                  {item.position}
                </Text>

                <Text style={styles.info}>
                  Phone:
                  {" "}
                  {item.phone}
                </Text>

                <Text style={styles.info}>
                  Salary Rate:
                  €
                  {item.salaryRate}
                </Text>

                <Text style={styles.info}>
                  Joining:
                  {" "}
                  {item.joiningDate}
                </Text>

                <Text style={styles.status}>
                  {item.status}
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
    fontSize: 32,
    fontWeight: "bold",
    color: "gold",
    marginTop: 20,
  },

  subtitle: {
    color: "#fff",
    marginTop: 8,
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
    fontSize: 18,
    fontWeight: "bold",
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

  info: {
    fontSize: 16,
    color: "#555",
    marginTop: 10,
  },

  status: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "bold",
    color: "green",
  },

});

