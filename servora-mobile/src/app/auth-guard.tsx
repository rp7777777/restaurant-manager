import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  ActivityIndicator,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
} from "../firebase";

export default function AuthGuard({

  children,

}: any) {

  const router =
    useRouter();

  const [loading,
    setLoading] =
      useState(true);

  useEffect(() => {

    const unsubscribe =

      onAuthStateChanged(

        auth,

        (user) => {

          if (
            !user
          ) {

            router.replace(
              "/login"
            );

          } else if (
            !user.emailVerified
          ) {

            router.replace(
              "/email-verification"
            );

          }

          setLoading(
            false
          );

        }

      );

    return unsubscribe;

  }, []);

  if (loading) {

    return (

      <View
        style={{

          flex: 1,

          justifyContent:
            "center",

          alignItems:
            "center",

        }}
      >

        <ActivityIndicator
          size="large"
          color="#00154f"
        />

      </View>

    );

  }

  return children;

}

