import React from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  signOut,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

export default function SidebarScreen() {

  const router =
    useRouter();

  const menuItems = [

    {
      title:
        "Dashboard",
      route:
        "/dashboard",
    },

    {
      title:
        "Executive Dashboard",
      route:
        "/executive-dashboard",
    },

    {
      title:
        "Analytics",
      route:
        "/analytics",
    },

    {
      title:
        "Inventory",
      route:
        "/inventory",
    },

    {
      title:
        "Sales",
      route:
        "/sales",
    },

    {
      title:
        "Billing",
      route:
        "/billing",
    },

    {
      title:
        "POS System",
      route:
        "/pos",
    },

    {
      title:
        "Kitchen",
      route:
        "/kitchen",
    },

    {
      title:
        "Payroll",
      route:
        "/payroll",
    },

    {
      title:
        "Attendance",
      route:
        "/attendance-pro",
    },

    {
      title:
        "Expenses",
      route:
        "/expenses",
    },

    {
      title:
        "Profit & Loss",
      route:
        "/profit-loss",
    },

    {
      title:
        "Reservations",
      route:
        "/reservation-pro",
    },

    {
      title:
        "Delivery",
      route:
        "/delivery-pro",
    },

    {
      title:
        "Suppliers",
      route:
        "/suppliers",
    },

    {
      title:
        "Purchase Orders",
      route:
        "/purchase-orders",
    },

    {
      title:
        "Restaurants",
      route:
        "/restaurants",
    },

    {
      title:
        "Branches",
      route:
        "/branches",
    },

    {
      title:
        "Users",
      route:
        "/users",
    },

    {
      title:
        "Settings",
      route:
        "/settings",
    },

  ];

  const logout =
    async () => {

      await signOut(auth);

      router.replace(
        "/login"
      );

    };

  return (

    <View
      style={styles.container}
    >

      <View
        style={styles.header}
      >

        <Text
          style={styles.logo}
        >
          SERVORA ERP
        </Text>

        <Text
          style={styles.subtitle}
        >
          Restaurant Management
        </Text>

      </View>

      <ScrollView
        style={styles.menu}
        showsVerticalScrollIndicator={
          false
        }
      >

        {menuItems.map(
          (
            item,
            index
          ) => (

            <TouchableOpacity
              key={index}
              style={styles.menuButton}
              onPress={() =>
                router.push(
                  item.route as any
                )
              }
            >

              <Text
                style={styles.menuText}
              >
                {item.title}
              </Text>

            </TouchableOpacity>

          )
        )}

      </ScrollView>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={logout}
      >

        <Text
          style={styles.logoutText}
        >
          LOGOUT
        </Text>

      </TouchableOpacity>

    </View>

  );

}

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        "#00154f",
      paddingTop: 50,
    },

    header: {
      paddingHorizontal: 20,
      paddingBottom: 30,
      borderBottomWidth: 1,
      borderBottomColor:
        "rgba(255,255,255,0.2)",
    },

    logo: {
      color: "gold",
      fontSize: 30,
      fontWeight: "bold",
    },

    subtitle: {
      color: "white",
      fontSize: 16,
      marginTop: 8,
    },

    menu: {
      flex: 1,
      paddingTop: 20,
    },

    menuButton: {
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor:
        "rgba(255,255,255,0.08)",
    },

    menuText: {
      color: "white",
      fontSize: 18,
      fontWeight: "600",
    },

    logoutButton: {
      backgroundColor:
        "red",
      margin: 20,
      padding: 18,
      borderRadius: 18,
      alignItems: "center",
    },

    logoutText: {
      color: "white",
      fontSize: 18,
      fontWeight: "bold",
    },

  });

