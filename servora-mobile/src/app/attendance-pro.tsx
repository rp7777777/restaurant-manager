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

export default function AttendanceScreen() {

  const [employeeName,
    setEmployeeName] =
      useState("");

  const [date,
    setDate] =
      useState("");

  const [status,
    setStatus] =
      useState("");

  const [overtime,
    setOvertime] =
      useState("");

  const [attendance,
    setAttendance] =
      useState<any[]>([]);

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsubscribe =

      onSnapshot(

        collection(
          db,
          "attendance"
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

          setAttendance(
            data
          );

        }

      );

    return () =>
      unsubscribe();

  }, []);

  const saveAttendance =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !employeeName ||
        !date ||
        !status
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
          "attendance"
        ),

        {

          userId:
            user.uid,

          employeeName,

          date,

          status,

          overtime,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Attendance Saved"
      );

      setEmployeeName("");
      setDate("");
      setStatus("");
      setOvertime("");

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            ATTENDANCE
          </Text>

          <Text style={styles.subtitle}>
            Staff Attendance System
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
            placeholder="Date"
            value={date}
            onChangeText={
              setDate
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Status (Present / Absent)"
            value={status}
            onChangeText={
              setStatus
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Overtime Hours"
            keyboardType="numeric"
            value={overtime}
            onChangeText={
              setOvertime
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveAttendance
            }
          >

            <Text style={styles.buttonText}>
              SAVE ATTENDANCE
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.historyContainer}>

          <Text style={styles.sectionTitle}>
            Attendance History
          </Text>

          {attendance.map(
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
                  Date:
                  {" "}
                  {item.date}
                </Text>

                <Text style={styles.info}>
                  Status:
                  {" "}
                  {item.status}
                </Text>

                <Text style={styles.info}>
                  Overtime:
                  {" "}
                  {item.overtime}
                  h
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
    fontSize: 34,
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

});

