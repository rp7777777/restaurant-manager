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

export default function HACCPscreen() {

  const [checkItem,
    setCheckItem] =
      useState("");

  const [temperature,
    setTemperature] =
      useState("");

  const [status,
    setStatus] =
      useState("");

  const [note,
    setNote] =
      useState("");

  const [logs,
    setLogs] =
      useState<any[]>([]);

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsubscribe =

      onSnapshot(

        collection(
          db,
          "haccp"
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

          setLogs(
            data.reverse()
          );

        }

      );

    return () =>
      unsubscribe();

  }, []);

  const saveLog =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !checkItem ||
        !status
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
          "haccp"
        ),

        {

          userId:
            user.uid,

          checkItem,

          temperature,

          status,

          note,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "HACCP Log Saved"
      );

      setCheckItem("");
      setTemperature("");
      setStatus("");
      setNote("");

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            HACCP & HYGIENE
          </Text>

          <Text style={styles.subtitle}>
            Food Safety Monitoring
          </Text>

        </View>

        <View style={styles.form}>

          <TextInput
            style={styles.input}
            placeholder="Check Item"
            value={checkItem}
            onChangeText={
              setCheckItem
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Temperature"
            value={temperature}
            onChangeText={
              setTemperature
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

          <TextInput
            style={styles.input}
            placeholder="Note"
            value={note}
            onChangeText={
              setNote
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={
              saveLog
            }
          >

            <Text style={styles.buttonText}>
              SAVE HACCP LOG
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.content}>

          {logs.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.card}
              >

                <Text style={styles.title}>
                  {item.checkItem}
                </Text>

                <Text style={styles.info}>
                  Temperature:
                  {" "}
                  {item.temperature}
                </Text>

                <Text style={styles.info}>
                  Status:
                  {" "}
                  {item.status}
                </Text>

                <Text style={styles.note}>
                  {item.note}
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
    fontSize: 18,
    fontWeight: "bold",
  },

  content: {
    padding: 16,
    paddingBottom: 100,
  },

  card: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 20,
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
  },

  info: {
    fontSize: 16,
    color: "#555",
    marginTop: 10,
  },

  note: {
    marginTop: 14,
    fontSize: 15,
    color: "#666",
  },

});

