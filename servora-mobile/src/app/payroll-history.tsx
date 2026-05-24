import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  db,
} from "../firebase";

import * as Print from "expo-print";

import * as Sharing from "expo-sharing";

export default function PayrollHistoryScreen() {

  const [payrolls, setPayrolls] =
    useState<any[]>([]);

  const [filter, setFilter] =
    useState("ALL");

  const getPayrolls =
    async () => {

      try {

        const snapshot =
          await getDocs(
            collection(
              db,
              "payroll"
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

        data.reverse();

        setPayrolls(data);

      } catch (error) {

        console.log(error);

      }

    };

  const printSalarySlip =
    async (item: any) => {

      const html = `
        <html>

        <body style="
          font-family: Arial;
          padding: 30px;
        ">

          <h1>
            SERVORA ERP
          </h1>

          <h2>
            Salary Slip
          </h2>

          <hr />

          <p>
            <b>Worker:</b>
            ${item.workerName}
          </p>

          <p>
            <b>Worker ID:</b>
            ${item.workerId}
          </p>

          <p>
            <b>Department:</b>
            ${item.department}
          </p>

          <p>
            <b>Position:</b>
            ${item.position}
          </p>

          <hr />

          <h3>
            Salary Details
          </h3>

          <p>
            Base Salary:
            €${item.baseSalary}
          </p>

          <p>
            Food Allowance:
            €${item.foodAllowance}
          </p>

          <p>
            Bonus:
            €${item.bonus}
          </p>

          <p>
            Overtime:
            €${item.overtime}
          </p>

          <p>
            Deduction:
            €${item.deduction}
          </p>

          <p>
            Tax:
            ${item.taxPercent}%
          </p>

          <p>
            Gross Salary:
            €${item.grossSalary}
          </p>

          <p>
            Tax Amount:
            €${item.taxAmount}
          </p>

          <hr />

          <h2>
            Net Salary:
            €${item.netSalary}
          </h2>

          <p>
            Status:
            ${item.paid
              ? "PAID"
              : "UNPAID"}
          </p>

          <br />
          <br />

          <p>
            Employee Signature:
            __________________
          </p>

          <p>
            Manager Signature:
            __________________
          </p>

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

  useEffect(() => {

    getPayrolls();

  }, []);

  const filteredPayrolls =
    payrolls.filter((item) => {

      if (
        filter === "PAID"
      ) {

        return item.paid;

      }

      if (
        filter === "UNPAID"
      ) {

        return !item.paid;

      }

      return true;

    });

  return (

    <ScrollView style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.logo}>
          PAYROLL HISTORY
        </Text>

        <Text style={styles.subtitle}>
          Salary Slip Records
        </Text>

      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        style={styles.filterRow}
      >

        {[
          "ALL",
          "PAID",
          "UNPAID",
        ].map((item) => (

          <TouchableOpacity
            key={item}
            style={[
              styles.filterButton,

              filter === item &&
              styles.activeFilter,
            ]}
            onPress={() =>
              setFilter(item)
            }
          >

            <Text style={styles.filterText}>
              {item}
            </Text>

          </TouchableOpacity>

        ))}

      </ScrollView>

      <View style={styles.content}>

        {filteredPayrolls.map((item) => (

          <View
            key={item.id}
            style={styles.card}
          >

            <View style={styles.topRow}>

              <Text style={styles.workerName}>
                {item.workerName}
              </Text>

              <Text
                style={[
                  styles.status,

                  item.paid
                    ? styles.paid
                    : styles.unpaid,
                ]}
              >

                {item.paid
                  ? "PAID"
                  : "UNPAID"}

              </Text>

            </View>

            <Text style={styles.info}>
              Worker ID:
              {" "}
              {item.workerId}
            </Text>

            <Text style={styles.info}>
              Department:
              {" "}
              {item.department}
            </Text>

            <Text style={styles.info}>
              Position:
              {" "}
              {item.position}
            </Text>

            <Text style={styles.info}>
              Base Salary:
              {" "}
              €{item.baseSalary}
            </Text>

            <Text style={styles.info}>
              Food Allowance:
              {" "}
              €{item.foodAllowance}
            </Text>

            <Text style={styles.info}>
              Bonus:
              {" "}
              €{item.bonus}
            </Text>

            <Text style={styles.info}>
              Overtime:
              {" "}
              €{item.overtime}
            </Text>

            <Text style={styles.info}>
              Deduction:
              {" "}
              €{item.deduction}
            </Text>

            <Text style={styles.info}>
              Tax:
              {" "}
              {item.taxPercent}%
            </Text>

            <Text style={styles.gross}>
              Gross Salary:
              {" "}
              €{item.grossSalary}
            </Text>

            <Text style={styles.tax}>
              Tax Amount:
              {" "}
              €{item.taxAmount}
            </Text>

            <Text style={styles.net}>
              Net Salary:
              {" "}
              €{item.netSalary}
            </Text>

            <Text style={styles.date}>

              {
                item.createdAt
                  ?.toDate?.()
                  ?.toLocaleString?.()
              }

            </Text>

            <TouchableOpacity
              style={styles.printButton}
              onPress={() =>
                printSalarySlip(item)
              }
            >

              <Text style={styles.printText}>
                PRINT SALARY SLIP
              </Text>

            </TouchableOpacity>

          </View>

        ))}

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
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 25,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 10,
  },

  filterRow: {
    padding: 20,
  },

  filterButton: {
    backgroundColor: "#dbe4ff",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 18,
    marginRight: 12,
  },

  activeFilter: {
    backgroundColor: "#00154f",
  },

  filterText: {
    color: "black",
    fontWeight: "bold",
    fontSize: 16,
  },

  content: {
    padding: 20,
    paddingBottom: 80,
  },

  card: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 24,
    marginBottom: 24,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  workerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00154f",
  },

  status: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    color: "white",
    fontWeight: "bold",
    overflow: "hidden",
  },

  paid: {
    backgroundColor: "green",
  },

  unpaid: {
    backgroundColor: "red",
  },

  info: {
    fontSize: 17,
    marginTop: 10,
    color: "#444",
  },

  gross: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#00154f",
    marginTop: 18,
  },

  tax: {
    fontSize: 20,
    fontWeight: "bold",
    color: "red",
    marginTop: 12,
  },

  net: {
    fontSize: 26,
    fontWeight: "bold",
    color: "green",
    marginTop: 14,
  },

  date: {
    fontSize: 15,
    color: "gray",
    marginTop: 18,
  },

  printButton: {
    backgroundColor: "#00154f",
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  printText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },

});

