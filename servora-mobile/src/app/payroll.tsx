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
  addDoc,
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

export default function PayrollScreen() {

  const [workers, setWorkers] =
    useState<any[]>([]);

  const [selectedWorker, setSelectedWorker] =
    useState<any>(null);

  const [baseSalary, setBaseSalary] =
    useState("");

  const [foodAllowance, setFoodAllowance] =
    useState("");

  const [bonus, setBonus] =
    useState("");

  const [overtime, setOvertime] =
    useState("");

  const [deduction, setDeduction] =
    useState("");

  const [taxPercent, setTaxPercent] =
    useState("25");

  const [paid, setPaid] =
    useState(false);

  const getWorkers =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "workers"
            )
          );

        const data: any[] = [];

        snapshot.forEach(
          (docItem) => {

            data.push({
              id: docItem.id,
              ...(docItem.data() as any),
            });

          }
        );

        setWorkers(data);

      } catch (error) {

        console.log(error);

      }

    };

  const calculateGross =
    () => {

      return (
        Number(baseSalary || 0) +
        Number(foodAllowance || 0) +
        Number(bonus || 0) +
        Number(overtime || 0)
      );

    };

  const calculateTax =
    () => {

      return (
        calculateGross() *
        (Number(taxPercent) / 100)
      );

    };

  const calculateNet =
    () => {

      return (
        calculateGross() -
        calculateTax() -
        Number(deduction || 0)
      );

    };

  const savePayroll =
    async () => {

      if (
        !selectedWorker
      ) {

        Alert.alert(
          "Error",
          "Select worker"
        );

        return;

      }

      try {

        await addDoc(
          collection(
            db,
            "payroll"
          ),
          {
            workerName:
              selectedWorker.name,

            workerId:
              selectedWorker.serialNumber,

            department:
              selectedWorker.kitchen,

            position:
              selectedWorker.position,

            baseSalary:
              Number(baseSalary),

            foodAllowance:
              Number(foodAllowance),

            bonus:
              Number(bonus),

            overtime:
              Number(overtime),

            deduction:
              Number(deduction),

            taxPercent:
              Number(taxPercent),

            grossSalary:
              calculateGross(),

            taxAmount:
              calculateTax(),

            netSalary:
              calculateNet(),

            paid,

            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Payroll Saved"
        );

      } catch (error: any) {

        Alert.alert(
          "Error",
          error.message
        );

      }

    };

  useEffect(() => {

    getWorkers();

  }, []);

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          PAYROLL
        </Text>

        <Text style={styles.subtitle}>
          Salary Management System
        </Text>

      </View>

      <View style={styles.form}>

        <Text style={styles.label}>
          Select Worker
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.row}
        >

          {workers.map((item) => (

            <TouchableOpacity
              key={item.id}
              style={[
                styles.workerButton,

                selectedWorker?.id ===
                  item.id &&
                styles.activeButton,
              ]}
              onPress={() =>
                setSelectedWorker(
                  item
                )
              }
            >

              <Text style={styles.workerText}>
                {item.name}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Base Salary"
          keyboardType="numeric"
          value={baseSalary}
          onChangeText={setBaseSalary}
        />

        <TextInput
          style={styles.input}
          placeholder="Food Allowance"
          keyboardType="numeric"
          value={foodAllowance}
          onChangeText={
            setFoodAllowance
          }
        />

        <TextInput
          style={styles.input}
          placeholder="Bonus"
          keyboardType="numeric"
          value={bonus}
          onChangeText={setBonus}
        />

        <TextInput
          style={styles.input}
          placeholder="Overtime"
          keyboardType="numeric"
          value={overtime}
          onChangeText={setOvertime}
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

        <TextInput
          style={styles.input}
          placeholder="Tax %"
          keyboardType="numeric"
          value={taxPercent}
          onChangeText={
            setTaxPercent
          }
        />

        <TouchableOpacity
          style={[
            styles.statusButton,

            paid
              ? styles.paid
              : styles.unpaid,
          ]}
          onPress={() =>
            setPaid(!paid)
          }
        >

          <Text style={styles.statusText}>

            {paid
              ? "PAID"
              : "UNPAID"}

          </Text>

        </TouchableOpacity>

        <View style={styles.summaryCard}>

          <Text style={styles.summaryText}>
            Gross Salary:
            €{calculateGross()}
          </Text>

          <Text style={styles.summaryText}>
            Tax:
            €{calculateTax()}
          </Text>

          <Text style={styles.summaryText}>
            Net Salary:
            €{calculateNet()}
          </Text>

        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={savePayroll}
        >

          <Text style={styles.saveText}>
            SAVE PAYROLL
          </Text>

        </TouchableOpacity>

      </View>

    </ScrollView>

  );

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  header: {
    backgroundColor: "#00154f",
    padding: 35,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },

  logo: {
    color: "gold",
    fontSize: 38,
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
    paddingBottom: 80,
  },

  label: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 12,
  },

  row: {
    marginBottom: 20,
  },

  workerButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },

  activeButton: {
    backgroundColor: "#00154f",
  },

  workerText: {
    color: "black",
    fontWeight: "bold",
  },

  input: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    fontSize: 18,
    marginBottom: 18,
  },

  statusButton: {
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 20,
  },

  paid: {
    backgroundColor: "green",
  },

  unpaid: {
    backgroundColor: "red",
  },

  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 20,
  },

  summaryCard: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 20,
    marginBottom: 30,
  },

  summaryText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 10,
  },

  saveButton: {
    backgroundColor: "#00154f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
  },

  saveText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },

});

