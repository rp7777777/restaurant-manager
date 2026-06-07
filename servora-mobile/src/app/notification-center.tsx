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
} from "react-native";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

export default function NotificationsScreen() {

  const [notifications,
    setNotifications] =
      useState<any[]>([]);

  useEffect(() => {

    const user =
      auth.currentUser;

    if (!user) return;

    const unsubscribe =

      onSnapshot(

        collection(
          db,
          "notifications"
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

          setNotifications(
            data.reverse()
          );

        }

      );

    return () =>
      unsubscribe();

  }, []);

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            NOTIFICATIONS
          </Text>

          <Text style={styles.subtitle}>
            Real-time ERP Alerts
          </Text>

        </View>

        <View style={styles.content}>

          {notifications.length === 0 && (

            <View style={styles.emptyBox}>

              <Text style={styles.emptyText}>
                No Notifications
              </Text>

            </View>

          )}

          {notifications.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.card}
              >

                <Text style={styles.title}>
                  {item.title}
                </Text>

                <Text style={styles.message}>
                  {item.message}
                </Text>

                <Text style={styles.time}>
                  {item.time}
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
    marginTop: 10,
    fontSize: 16,
  },

  content: {
    padding: 16,
    paddingBottom: 100,
  },

  emptyBox: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 18,
    color: "#555",
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

  message: {
    fontSize: 16,
    color: "#555",
    marginTop: 10,
  },

  time: {
    fontSize: 14,
    color: "gray",
    marginTop: 14,
  },

});

