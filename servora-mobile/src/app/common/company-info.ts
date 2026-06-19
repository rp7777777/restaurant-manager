import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

import {
  db,
  auth,
} from "../../firebase";

export interface CompanyInfo {

  restaurantName: string;

  ownerName: string;

  phone: string;

  email: string;

  address: string;

  vatNumber: string;

}

export async function getCompanyInfo():
Promise<CompanyInfo> {

  const user =
    auth.currentUser;

  if (!user) {

    return {

      restaurantName:
        "SERVORA ERP",

      ownerName: "",

      phone: "",

      email: "",

      address: "",

      vatNumber: "",

    };

  }

  try {

    const q = query(

      collection(
        db,
        "restaurantProfiles"
      ),

      orderBy(
        "createdAt",
        "desc"
      ),

      limit(1)

    );

    const snapshot =
      await getDocs(q);

    let profile: any =
      null;

    snapshot.forEach(
      (doc) => {

        const data =
          doc.data();

        if (
          data.userId ===
          user.uid
        ) {

          profile =
            data;

        }

      }
    );

    if (!profile) {

      return {

        restaurantName:
          "SERVORA ERP",

        ownerName: "",

        phone: "",

        email: "",

        address: "",

        vatNumber: "",

      };

    }

    return {

      restaurantName:
        profile.restaurantName || "",

      ownerName:
        profile.ownerName || "",

      phone:
        profile.phone || "",

      email:
        profile.email || "",

      address:
        profile.address || "",

      vatNumber:
        profile.vatNumber || "",

    };

  } catch {

    return {

      restaurantName:
        "SERVORA ERP",

      ownerName: "",

      phone: "",

      email: "",

      address: "",

      vatNumber: "",

    };

  }

}
export default {};
