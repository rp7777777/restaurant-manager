import AuthGuard from "./auth-guard";

import React from "react";

import {
  View,
  StyleSheet,
} from "react-native";

import SidebarScreen
from "./sidebar";

export default function DashboardLayout({

  children,

}: any) {

  return (

    <AuthGuard>

      <View
        style={styles.container}
      >

        <View
          style={styles.sidebar}
        >

          <SidebarScreen />

        </View>

        <View
          style={styles.content}
        >

          {children}

        </View>

      </View>

    </AuthGuard>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      flexDirection: "row",
      backgroundColor:
        "#eef2f7",
    },

    sidebar: {
      width: 300,
      backgroundColor:
        "#00154f",
    },

    content: {
      flex: 1,
      backgroundColor:
        "#eef2f7",
    },

  });

