import React from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";

import { router } from "expo-router";

export default function DashboardLayout() {

  const menuItems = [

    {
      title: "Dashboard",
      page: "/dashboard",
    },

    {
      title: "Restaurants",
      page: "/restaurants",
    },

    {
      title: "Sales",
      page: "/sales",
    },

    {
      title: "Analytics",
      page: "/analytics",
    },

    {
      title: "Inventory",
      page: "/inventory",
    },

    {
      title: "Workers",
      page: "/workers",
    },

    {
      title: "Schedule",
      page: "/workerschedule",
    },

    {
      title: "Profit & Loss",
      page: "/profit-loss",
    },

    {
      title: "Settings",
      page: "/settings",
    },

  ];

  return (

    <View style={styles.container}>

      <View style={styles.sidebar}>

        <Text style={styles.logo}>
          SERVORA
        </Text>

        <ScrollView>

          {menuItems.map((item, index) => (

            <TouchableOpacity
              key={index}
              style={styles.menuButton}
              onPress={() =>
                router.push(item.page as any)
              }
            >

              <Text style={styles.menuText}>
                {item.title}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

      </View>

      <View style={styles.content}>

        <Text style={styles.welcome}>
          Welcome To SERVORA ERP
        </Text>

        <Text style={styles.description}>
          Professional Restaurant
          Management System
        </Text>

      </View>

    </View>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f4f7fb",
  },

  sidebar: {
    width: 260,
    backgroundColor: "#00154f",
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  logo: {
    color: "gold",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
  },

  menuButton: {
    backgroundColor: "#002a80",
    padding: 18,
    borderRadius: 14,
    marginBottom: 15,
  },

  menuText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  welcome: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#00154f",
  },

  description: {
    fontSize: 22,
    color: "gray",
    marginTop: 20,
  },

});

