import { auth } from "../../firebase";

export function isAuthenticated() {

  return !!auth.currentUser;

}

export function getCurrentUser() {

  return auth.currentUser;

}

export function getCurrentUserId() {

  return (
    auth.currentUser?.uid ||
    null
  );

}

export function requireAuth() {

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "Authentication required"
    );

  }

  return user;

}

export async function verifySession() {

  const user =
    auth.currentUser;

  return !!user;

}