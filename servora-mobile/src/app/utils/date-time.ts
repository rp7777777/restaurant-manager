export function getTodayDate() {

  return new Date()
    .toISOString()
    .split("T")[0];

}

export function getCurrentDateTime() {

  return new Date()
    .toLocaleString(
      "en-GB",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );

}

export function getCurrentTime() {

  return new Date()
    .toLocaleTimeString(
      "en-GB"
    );

}

export function getCurrentMonth() {

  return new Date()
    .toLocaleDateString(
      "en-GB",
      {
        month: "long",
        year: "numeric",
      }
    );

}

export function getCurrentYear() {

  return new Date()
    .getFullYear();

}

export function getTimestamp() {

  return Date.now();

}

export function formatDate(
  date: any
) {

  if (!date)
    return "-";

  return new Date(date)
    .toLocaleDateString(
      "en-GB"
    );

}

export function formatDateTime(
  date: any
) {

  if (!date)
    return "-";

  return new Date(date)
    .toLocaleString(
      "en-GB"
    );

}
export default {};
