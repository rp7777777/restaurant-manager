import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

export async function exportExcel(
  fileName: string,
  data: any[]
) {
  try {
    const worksheet =
      XLSX.utils.json_to_sheet(data);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Report"
    );

    XLSX.write(workbook, {
      type: "binary",
      bookType: "xlsx",
    });

    console.log(
      `${fileName}.xlsx ready`
    );

    if (
      await Sharing.isAvailableAsync()
    ) {
      console.log(
        "Sharing available"
      );
    }
  } catch (error) {
    console.log(
      "Excel Export Error:",
      error
    );
  }
}