import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

export default function LiveClock() {

  const [currentTime,
    setCurrentTime] =
      useState(new Date());

  useEffect(() => {

    const timer =
      setInterval(() => {

        setCurrentTime(
          new Date()
        );

      }, 1000);

    return () =>
      clearInterval(timer);

  }, []);

  const date =
    currentTime.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );

  const time =
    currentTime.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );

  return (

    <View style={styles.container}>

      <Text style={styles.date}>
        📅 {date}
      </Text>

      <Text style={styles.time}>
        🕒 {time}
      </Text>

    </View>

  );

}

const styles =
  StyleSheet.create({

    container: {
      backgroundColor:
        "#ffffff",
      padding: 12,
      borderRadius: 12,
      alignItems: "center",
      marginVertical: 10,
    },

    date: {
      fontSize: 16,
      fontWeight: "600",
      color: "#00154f",
    },

    time: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#0039cb",
      marginTop: 4,
    },

  });