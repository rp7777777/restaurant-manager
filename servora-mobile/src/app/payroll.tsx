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
  getDocs,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../firebase";

import * as Print from "expo-print";

import * as Sharing from "expo-sharing";

export default function PayrollScreen() {

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

  const [taxRate,
    setTaxRate] =
      useState("");

  const [deduction,
    setDeduction] =
      useState("");

  const [month,
    setMonth] =
      useState("");

  const [staff,
    setStaff] =
      useState<any[]>([]);

  useEffect(() => {

    loadPayroll();

  }, []);

  const loadPayroll =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      const snapshot =
        await getDocs(
          collection(
            db,
            "payroll"
          )
        );

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

            data.push({
              id:
                document.id,

              ...item,
            });

          }

        }
      );

      setStaff(data);

    };

  const savePayroll =
    async () => {

      const user =
        auth.currentUser;

      if (!user) return;

      if (
        !employeeName ||
        !basicSalary ||
        !month
      ) {

        Alert.alert(
          "Error",
          "Fill required fields"
        );

        return;

      }

      const basic =
        Number(
          basicSalary
        );

      const overtimePay =
        Number(
          overtime || 0
        );

      const bonusPay =
        Number(
          bonus || 0
        );

      const deductionPay =
        Number(
          deduction || 0
        );

      const tax =
        (
          basic *
          Number(
            taxRate || 0
          )
        ) / 100;

      const grossSalary =

        basic +
        overtimePay +
        bonusPay;

      const netSalary =

        grossSalary -
        tax -
        deductionPay;

      await addDoc(

        collection(
          db,
          "payroll"
        ),

        {

          userId:
            user.uid,

          employeeName,

          position,

          basicSalary,

          overtime,

          bonus,

          taxRate,

          deduction,

          grossSalary,

          netSalary,

          month,

          createdAt:
            new Date(),

        }

      );

      Alert.alert(
        "Success",
        "Salary Slip Saved"
      );

      setEmployeeName("");
      setPosition("");
      setBasicSalary("");
      setOvertime("");
      setBonus("");
      setTaxRate("");
      setDeduction("");
      setMonth("");

      loadPayroll();

    };

  const generatePDF =
    async (item: any) => {

      const html = `

      <html>

      <body
        style="
          font-family: Arial;
          padding: 30px;
        "
      >

        <h1>
          SERVORA ERP
        </h1>

        <h2>
          Employee Salary Slip
        </h2>

        <hr />

        <p>
          <strong>
            Employee:
          </strong>
          ${item.employeeName}
        </p>

        <p>
          <strong>
            Position:
          </strong>
          ${item.position}
        </p>

        <p>
          <strong>
            Month:
          </strong>
          ${item.month}
        </p>

        <hr />

        <h3>
          Salary Details
        </h3>

        <p>
          Basic Salary:
          €${item.basicSalary}
        </p>

        <p>
          Overtime:
          €${item.overtime}
        </p>

        <p>
          Bonus:
          €${item.bonus}
        </p>

        <p>
          Deduction:
          €${item.deduction}
        </p>

        <p>
          Tax Rate:
          ${item.taxRate}%
        </p>

        <hr />

        <h2
          style="
            color: green;
          "
        >
          Net Salary:
          €${item.netSalary}
        </h2>

      </body>

      </html>

      `;

      const file =

        await Print.printToFileAsync({

          html,

        });

      await Sharing.shareAsync(
        file.uri
      );

    };

  return (

    <AuthGuard>

      <ScrollView
        horizontal
        style={styles.container}
      >

        <View style={styles.paper}>

          <Text style={styles.company}>
            SERVORA ERP
          </Text>

          <Text style={styles.title}>
            EMPLOYEE SALARY SLIP
          </Text>

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
              placeholder="Month"
              value={month}
              onChangeText={
                setMonth
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
              placeholder="Tax Rate %"
              keyboardType="numeric"
              value={taxRate}
              onChangeText={
                setTaxRate
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
              onPress={
                savePayroll
              }
            >

              <Text style={styles.buttonText}>
                SAVE SALARY SLIP
              </Text>

            </TouchableOpacity>

          </View>

          <Text style={styles.historyTitle}>
            SAVED SALARY SLIPS
          </Text>

          {staff.map(
            (
              item,
              index
            ) => (

              <View
                key={index}
                style={styles.salaryCard}
              >

                <Text style={styles.employee}>
                  {item.employeeName}
                </Text>

                <Text style={styles.info}>
                  Position:
                  {" "}
                  {item.position}
                </Text>

                <Text style={styles.info}>
                  Month:
                  {" "}
                  {item.month}
                </Text>

                <Text style={styles.info}>
                  Basic Salary:
                  €
                  {item.basicSalary}
                </Text>

                <Text style={styles.info}>
                  Overtime:
                  €
                  {item.overtime}
                </Text>

                <Text style={styles.info}>
                  Bonus:
                  €
                  {item.bonus}
                </Text>

                <Text style={styles.info}>
                  Tax:
                  {item.taxRate}%
                </Text>

                <Text style={styles.info}>
                  Deduction:
                  €
                  {item.deduction}
                </Text>

                <Text style={styles.netSalary}>
                  Net Salary:
                  €
                  {item.netSalary}
                </Text>

                <TouchableOpacity
                  style={styles.pdfButton}
                  onPress={() =>
                    generatePDF(item)
                  }
                >

                  <Text style={styles.pdfText}>
                    EXPORT PDF
                  </Text>

                </TouchableOpacity>

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
    backgroundColor: "#dfe6e9",
  },

  paper: {
    width: 1000,
    padding: 24,
    backgroundColor: "#fff",
    margin: 20,
    borderRadius: 20,
  },

  company: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#00154f",
  },

  title: {
    fontSize: 24,
    marginTop: 10,
    marginBottom: 20,
    color: "#444",
  },

  form: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  input: {
    width: "48%",
    backgroundColor: "#f1f2f6",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    fontSize: 16,
  },

  button: {
    width: "100%",
    backgroundColor: "#00154f",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  historyTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginTop: 30,
    marginBottom: 20,
    color: "#00154f",
  },

  salaryCard: {
    backgroundColor: "#f8f9fa",
    padding: 20,
    borderRadius: 18,
    marginBottom: 18,
  },

  employee: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00154f",
    marginBottom: 10,
  },

  info: {
    fontSize: 16,
    color: "#555",
    marginTop: 6,
  },

  netSalary: {
    fontSize: 22,
    color: "green",
    fontWeight: "bold",
    marginTop: 14,
  },

  pdfButton: {
    backgroundColor: "#00154f",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },

  pdfText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

});

