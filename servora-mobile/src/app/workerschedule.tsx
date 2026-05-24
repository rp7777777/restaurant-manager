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

const weekDays = [

  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",

];

const shifts = [

  "07:00-15:00",
  "08:00-16:00",
  "15:00-23:00",
  "16:00-00:00",
  "23:00-07:00",
  "OFF",
  "ABSENT",

];

export default function ScheduleScreen() {

  const [workers, setWorkers] =
    useState<any[]>([]);

  const [schedule, setSchedule] =
    useState<any>({});

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

  const updateShift =
    (
      workerId: string,
      day: string,
      shift: string
    ) => {

      setSchedule(
        (prev: any) => ({

          ...prev,

          [workerId]: {

            ...prev[workerId],

            [day]: shift,

          },

        })
      );

    };

  const saveSchedule =
    async () => {

      try {

        await addDoc(
          collection(
            db,
            "schedules"
          ),
          {
            week:
              new Date()
                .toLocaleDateString(),

            schedule,

            createdAt:
              new Date(),
          }
        );

        Alert.alert(
          "Success",
          "Weekly Schedule Saved"
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

    <ScrollView
      horizontal
      style={styles.container}
    >

      <View>

        <View style={styles.header}>

          <Text style={styles.logo}>
            WEEKLY SCHEDULE
          </Text>

          <Text style={styles.subtitle}>
            Global Restaurant ERP
          </Text>

        </View>

        <ScrollView>

          <View style={styles.table}>

            <View style={styles.tableHeader}>

              <Text style={styles.headerCell}>
                ID
              </Text>

              <Text style={styles.headerCell}>
                Name
              </Text>

              <Text style={styles.headerCell}>
                Position
              </Text>

              {weekDays.map((day) => (

                <Text
                  key={day}
                  style={
                    styles.headerCell
                  }
                >
                  {day}
                </Text>

              ))}

            </View>

            {workers.map((worker) => (

              <View
                key={worker.id}
                style={styles.row}
              >

                <Text style={styles.cell}>
                  {worker.serialNumber}
                </Text>

                <Text style={styles.cell}>
                  {worker.name}
                </Text>

                <Text style={styles.cell}>
                  {worker.position}
                </Text>

                {weekDays.map((day) => {

                  const shift =
                    schedule[
                      worker.id
                    ]?.[day] ||
                    "";

                  const isOff =
                    shift ===
                    "OFF";

                  const isAbsent =
                    shift ===
                    "ABSENT";

                  return (

                    <ScrollView
                      horizontal
                      key={day}
                    >

                      {shifts.map(
                        (item) => (

                          <TouchableOpacity
                            key={item}
                            style={[

                              styles.shiftButton,

                              shift ===
                                item &&
                              styles.activeShift,

                              isOff &&
                              styles.offShift,

                              isAbsent &&
                              styles.absentShift,

                            ]}
                            onPress={() =>
                              updateShift(
                                worker.id,
                                day,
                                item
                              )
                            }
                          >

                            <Text
                              style={
                                styles.shiftText
                              }
                            >
                              {item}
                            </Text>

                          </TouchableOpacity>

                        )
                      )}

                    </ScrollView>

                  );

                })}

              </View>

            ))}

          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveSchedule}
          >

            <Text style={styles.saveText}>
              SAVE WEEKLY SCHEDULE
            </Text>

          </TouchableOpacity>

        </ScrollView>

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
    padding: 30,
  },

  logo: {
    color: "gold",
    fontSize: 34,
    fontWeight: "bold",
    marginTop: 20,
  },

  subtitle: {
    color: "white",
    fontSize: 18,
    marginTop: 8,
  },

  table: {
    padding: 20,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#00154f",
  },

  headerCell: {
    color: "white",
    fontWeight: "bold",
    width: 120,
    padding: 14,
    textAlign: "center",
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },

  cell: {
    width: 120,
    padding: 14,
    textAlign: "center",
    backgroundColor: "white",
  },

  shiftButton: {
    backgroundColor: "#dbe4ff",
    padding: 10,
    margin: 4,
    borderRadius: 10,
  },

  activeShift: {
    backgroundColor: "#00154f",
  },

  offShift: {
    backgroundColor: "yellow",
  },

  absentShift: {
    backgroundColor: "red",
  },

  shiftText: {
    color: "black",
    fontWeight: "bold",
    fontSize: 12,
  },

  saveButton: {
    backgroundColor: "#00154f",
    margin: 20,
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

