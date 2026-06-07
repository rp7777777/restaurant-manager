import AuthGuard from "./auth-guard";

import React, {
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

export default function SalarySlipScreen() {

  const [employeeName,
    setEmployeeName] =
      useState("");

  const [position,
    setPosition] =
      useState("");

  const [basicSalary,
    setBasicSalary] =
      useState("");

  const [overtime,
    setOvertime] =
      useState("");

  const [bonus,
    setBonus] =
      useState("");

  const [deduction,
    setDeduction] =
      useState("");

  const calculateTotal =
    () => {

      return (

        Number(
          basicSalary || 0
        ) +

        Number(
          overtime || 0
        ) +

        Number(
          bonus || 0
        ) -

        Number(
          deduction || 0
        )

      );

    };

  const generateSlip =
    () => {

      if (
        !employeeName ||
        !position ||
        !basicSalary
      ) {

        Alert.alert(
          "Error",
          "Fill all fields"
        );

        return;

      }

      Alert.alert(
        "Success",
        "Salary Slip Generated"
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        style={styles.container}
      >

        <View style={styles.header}>

          <Text style={styles.logo}>
            SALARY SLIP
          </Text>

          <Text style={styles.subtitle}>
            Payroll & Payslip
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
            placeholder="Basic Salary"
            keyboardType="numeric"
            value={basicSalary}
            onChangeText={
              setBasicSalary
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Overtime"
            keyboardType="numeric"
            value={overtime}
            onChangeText={
              setOvertime
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Bonus"
            keyboardType="numeric"
            value={bonus}
            onChangeText={
              setBonus
            }
          />

          <TextInput
            style={styles.input}
            placeholder="Deduction"
            keyboardType="numeric"
            value={deduction}
            onChangeText={
              setDeduction
            }
          />

          <TouchableOpacity
            style={styles.button}
            onPress={generateSlip}
          >

            <Text style={styles.buttonText}>
              GENERATE SALARY SLIP
            </Text>

          </TouchableOpacity>

        </View>

        <View style={styles.card}>

          <Text style={styles.cardTitle}>
            PAYSLIP PREVIEW
          </Text>

          <Text style={styles.info}>
            Employee:
            {" "}
            {employeeName || "-"}
          </Text>

          <Text style={styles.info}>
            Position:
            {" "}
            {position || "-"}
          </Text>

          <Text style={styles.info}>
            Basic Salary:
            {" "}
            €{basicSalary || 0}
          </Text>

          <Text style={styles.info}>
            Overtime:
            {" "}
            €{overtime || 0}
          </Text>

          <Text style={styles.info}>
            Bonus:
            {" "}
            €{bonus || 0}
          </Text>

          <Text style={styles.info}>
            Deduction:
            {" "}
            €{deduction || 0}
          </Text>

          <View style={styles.totalBox}>

            <Text style={styles.totalTitle}>
              TOTAL SALARY
            </Text>

            <Text style={styles.totalSalary}>
              €
              {calculateTotal()}
            </Text>

          </View>

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
    padding: 35,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logo: {
    color: "gold",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },

  form: {
    padding: 20,
  },

  input: {
    backgroundColor: "white",
    padding: 18,
    borderRadius: 18,
    marginBottom: 18,
    fontSize: 18,
  },

  button: {
    backgroundColor: "#00154f",
    padding: 22,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "white",
    margin: 20,
    padding: 28,
    borderRadius: 24,
    marginBottom: 100,
  },

  cardTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 24,
  },

  info: {
    fontSize: 18,
    marginBottom: 14,
    color: "#444",
  },

  totalBox: {
    marginTop: 30,
    borderTopWidth: 2,
    borderTopColor: "#ddd",
    paddingTop: 24,
    alignItems: "center",
  },

  totalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
  },

  totalSalary: {
    fontSize: 40,
    color: "green",
    fontWeight: "bold",
    marginTop: 12,
  },

});

