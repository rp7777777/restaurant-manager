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
  getDocs,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function ScheduleScreen() {

  const [employeeName,
    setEmployeeName] =
      useState("");

  const [position,
    setPosition] =
      useState("");

  const [workDate,
    setWorkDate] =
      useState("");

  const [startTime,
    setStartTime] =
      useState("");

  const [endTime,
    setEndTime] =
      useState("");

  const [schedule,
    setSchedule] =
      useState<any[]>([]);

  useEffect(() => {

    loadSchedule();

  }, []);

  const loadSchedule =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const snapshot =
        await getDocs(
          collection(
            db,
            "schedule"
          )
        );

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

      setSchedule(data);

    };

  const saveSchedule =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !employeeName ||
        !workDate ||
        !startTime ||
        !endTime
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
          "schedule"
        ),

        {

          userId:
            user.uid,

          employeeName,

          position,

          workDate,

          startTime,

          endTime,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Schedule Saved"
      );

      setEmployeeName("");
      setPosition("");
      setWorkDate("");
      setStartTime("");
      setEndTime("");

      loadSchedule();

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            Schedule
          </Text>

          <Text style={styles.subtitle}>
            Staff Duty Management
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
            placeholder="Work Date"
            value={workDate}
            onChangeText={
              setWorkDate
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Start Time"
            value={startTime}
            onChangeText={
              setStartTime
            }
          />

          <TextInput
            style={styles.input}
            placeholder="End Time"
            value={endTime}
            onChangeText={
              setEndTime
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveSchedule
            }
          >

            <Text style={styles.buttonText}>
              SAVE SCHEDULE
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.scheduleContainer}>

          <Text style={styles.sectionTitle}>
            Staff Schedule
          </Text>

          {schedule.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.scheduleCard}
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
                  Date:
                  {" "}
                  {item.workDate}
                </Text>

                <Text style={styles.info}>
                  Shift:
                  {" "}
                  {item.startTime}
                  {" - "}
                  {item.endTime}
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
    fontSize: 18,
    fontWeight: "bold",
  },

  scheduleContainer: {
    padding: 16,
    paddingBottom: 100,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 20,
  },

  scheduleCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
  },

  employee: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 16,
    color: "#555",
    marginTop: 8,
  },

});

