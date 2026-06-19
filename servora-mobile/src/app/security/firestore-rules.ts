import {
  auth,
} from "../../firebase";

export const FirestoreRules = {

  isLoggedIn() {

    return !!auth.currentUser;

  },

  getCurrentUserId() {

    return (
      auth.currentUser?.uid ||
      null
    );

  },

  canRead(
    ownerId: string
  ) {

    const user =
      auth.currentUser;

    if (!user)
      return false;

    return (
      user.uid ===
      ownerId
    );

  },

  canWrite(
    ownerId: string
  ) {

    const user =
      auth.currentUser;

    if (!user)
      return false;

    return (
      user.uid ===
      ownerId
    );

  },

  canDelete(
    ownerId: string
  ) {

    const user =
      auth.currentUser;

    if (!user)
      return false;

    return (
      user.uid ===
      ownerId
    );

  },

  validateOwner(
    userId: string
  ) {

    const currentUser =
      auth.currentUser;

    if (!currentUser)
      throw new Error(
        "User not authenticated"
      );

    if (
      currentUser.uid !==
      userId
    ) {

      throw new Error(
        "Unauthorized access"
      );

    }

    return true;

  },

  validateDocument(
    data: any
  ) {

    if (!data) {

      throw new Error(
        "Document data required"
      );

    }

    return true;

  },

  securePayload(
    payload: any
  ) {

    return {

      ...payload,

      userId:
        auth.currentUser?.uid,

      updatedAt:
        new Date(),

    };

  },

};
export default {};
