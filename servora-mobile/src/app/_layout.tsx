import React from "react";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />

      <Stack.Screen name="login" />

      <Stack.Screen name="register" />

      <Stack.Screen name="forgot-password" />

      <Stack.Screen name="email-verification" />

      <Stack.Screen name="dashboard" />

      <Stack.Screen name="add-sale" />

      <Stack.Screen name="sales" />
    </Stack>
  );
}