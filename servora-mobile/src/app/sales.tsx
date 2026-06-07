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
TouchableOpacity,
Alert,
} from "react-native";

import {
collection,
onSnapshot,
deleteDoc,
doc,
} from "firebase/firestore";

import {
db,
} from "../firebase";

export default function SalesScreen() {

const [sales,
setSales] =
useState<any[]>([]);

const [todayTotal,
setTodayTotal] =
useState(0);

const today =
new Date()
.toISOString()
.split("T")[0];

useEffect(() => {

const unsubscribe =
  onSnapshot(

    collection(
      db,
      "sales"
    ),

    (snapshot) => {

      const list: any[] =
        [];

      let total = 0;

      snapshot.forEach(
        (docItem) => {

          const data =
            docItem.data();

          if (
            data.date ===
            today
          ) {

            list.push({
              id: docItem.id,
              ...data,
            });

            total += Number(
              data.totalSale ||
                0
            );

          }

        }
      );

      setSales(list);

      setTodayTotal(
        total
      );

    }

  );

return () =>
  unsubscribe();

}, []);

const deleteSale =
async (
id: string
) => {

  Alert.alert(
    "Delete Sale",
    "Are you sure?",
    [

      {
        text: "Cancel",
      },

      {
        text: "Delete",

        onPress:
          async () => {

            await deleteDoc(
              doc(
                db,
                "sales",
                id
              )
            );

          },

      },

    ]
  );

};

return (

<AuthGuard>

  <ScrollView
    style={
      styles.container
    }
  >

    <Text
      style={
        styles.title
      }
    >
      TODAY SALES
    </Text>

    <Text
      style={
        styles.date
      }
    >
      {today}
    </Text>

    <View
      style={
        styles.totalBox
      }
    >

      <Text
        style={
          styles.totalLabel
        }
      >
        Today Total
      </Text>

      <Text
        style={
          styles.totalValue
        }
      >
        €{todayTotal}
      </Text>

    </View>

    {sales.length ===
    0 ? (

      <Text
        style={
          styles.empty
        }
      >
        No Sales Recorded Today
      </Text>

    ) : (

      sales.map(
        (item) => (

          <View
            key={
              item.id
            }
            style={
              styles.card
            }
          >

            <Text
              style={
                styles.row
              }
            >
              Morning:
              €
              {
                item.morningSale
              }
            </Text>

            <Text
              style={
                styles.row
              }
            >
              Afternoon:
              €
              {
                item.afternoonSale
              }
            </Text>

            <Text
              style={
                styles.row
              }
            >
              Night:
              €
              {
                item.nightSale
              }
            </Text>

            <Text
              style={
                styles.total
              }
            >
              Total:
              €
              {
                item.totalSale
              }
            </Text>

            <TouchableOpacity
              style={
                styles.deleteButton
              }
              onPress={() =>
                deleteSale(
                  item.id
                )
              }
            >

              <Text
                style={
                  styles.deleteText
                }
              >
                DELETE
              </Text>

            </TouchableOpacity>

          </View>

        )
      )

    )}

  </ScrollView>

</AuthGuard>

);

}

const styles =
StyleSheet.create({

container: {
  flex: 1,
  backgroundColor:
    "#eef2f7",
  padding: 20,
},

title: {
  fontSize: 30,
  fontWeight:
    "bold",
  color:
    "#00154f",
  marginTop: 40,
},

date: {
  fontSize: 16,
  color: "#666",
  marginBottom: 20,
},

totalBox: {
  backgroundColor:
    "#fff",
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
},

totalLabel: {
  fontSize: 18,
  color: "#666",
},

totalValue: {
  fontSize: 34,
  fontWeight:
    "bold",
  color: "green",
},

empty: {
  textAlign:
    "center",
  marginTop: 50,
  fontSize: 18,
  color: "#888",
},

card: {
  backgroundColor:
    "#fff",
  borderRadius: 20,
  padding: 20,
  marginBottom: 15,
},

row: {
  fontSize: 16,
  marginBottom: 8,
},

total: {
  fontSize: 22,
  fontWeight:
    "bold",
  color: "green",
  marginTop: 10,
},

deleteButton: {
  backgroundColor:
    "#d32f2f",
  padding: 12,
  borderRadius: 10,
  marginTop: 15,
  alignItems:
    "center",
},

deleteText: {
  color: "#fff",
  fontWeight:
    "bold",
},

});