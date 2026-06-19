export const USER_ROLES = {

  OWNER:
    "OWNER",

  ADMIN:
    "ADMIN",

  MANAGER:
    "MANAGER",

  CASHIER:
    "CASHIER",

  STAFF:
    "STAFF",

};

export function isOwner(
  role: string
) {

  return (
    role ===
    USER_ROLES.OWNER
  );

}

export function isAdmin(
  role: string
) {

  return (
    role ===
      USER_ROLES.ADMIN ||

    role ===
      USER_ROLES.OWNER
  );

}

export function isManager(
  role: string
) {

  return (

    role ===
      USER_ROLES.MANAGER ||

    role ===
      USER_ROLES.ADMIN ||

    role ===
      USER_ROLES.OWNER

  );

}

export function canEdit(
  role: string
) {

  return (

    role ===
      USER_ROLES.OWNER ||

    role ===
      USER_ROLES.ADMIN ||

    role ===
      USER_ROLES.MANAGER

  );

}

export function canDelete(
  role: string
) {

  return (

    role ===
      USER_ROLES.OWNER ||

    role ===
      USER_ROLES.ADMIN

  );

}

export function canViewReports(
  role: string
) {

  return (

    role ===
      USER_ROLES.OWNER ||

    role ===
      USER_ROLES.ADMIN ||

    role ===
      USER_ROLES.MANAGER

  );

}
export default {};
