import React from "react";
import {
View,
Text,
StyleSheet,
} from "react-native";

export default function SettingsScreen() {
return ( <View style={styles.container}> <Text style={styles.title}>
Settings Page </Text>


  <Text style={styles.text}>
    SERVORA Mobile Settings
  </Text>
</View>


);
}

const styles = StyleSheet.create({
container: {
flex: 1,
justifyContent: "center",
alignItems: "center",
backgroundColor: "#f4f6f9",
},

title: {
fontSize: 32,
fontWeight: "bold",
color: "#04133b",
},

text: {
marginTop: 15,
fontSize: 18,
color: "#555",
},
});
