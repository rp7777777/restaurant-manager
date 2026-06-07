export const MAX_EDIT_COUNT = 2;

export const MAX_DELETE_COUNT = 2;

export function canEdit(
  editCount: number
) {

  return (
    editCount <
    MAX_EDIT_COUNT
  );

}

export function canDelete(
  deleteCount: number
) {

  return (
    deleteCount <
    MAX_DELETE_COUNT
  );

}

export function getNextEditCount(
  currentCount: number
) {

  return (
    currentCount + 1
  );

}

export function getNextDeleteCount(
  currentCount: number
) {

  return (
    currentCount + 1
  );

}

export function createEditLog(
  userId: string,
  oldData: any,
  newData: any
) {

  return {

    action: "EDIT",

    userId,

    oldData,

    newData,

    timestamp:
      new Date(),

  };

}

export function createDeleteLog(
  userId: string,
  deletedData: any
) {

  return {

    action: "DELETE",

    userId,

    deletedData,

    timestamp:
      new Date(),

  };

}