// ============================================
// SERVORA ERP — Confirm Modal
// Cross-platform confirmation dialog (works on web + mobile)
// Alert.alert() is native-only and silently no-ops on web,
// so this custom Modal replaces it everywhere a confirm is needed.
// ============================================

import React from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useApp } from "../../context/AppContext";

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { theme } = useApp();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.bg }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: destructive ? theme.error : theme.primary },
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, { color: "#ffffff" }]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});