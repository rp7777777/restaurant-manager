import jsPDF
from "jspdf"

import autoTable
from "jspdf-autotable"

export default function PdfReport({
sales,
expenses,
currency,
}) {

const downloadPDF = () => {

const doc =
  new jsPDF()

doc.setFontSize(22)

doc.text(
  "SERVORA ERP REPORT",
  20,
  20
)

doc.setFontSize(14)

doc.text(
  "Sales Report",
  20,
  40
)

autoTable(
  doc,
  {

    startY: 50,

    head: [[
      "Branch",
      "Shift",
      "Amount",
      "Date",
    ]],

    body:
      sales.map(
        (
          sale
        ) => [

          sale.branch,

          sale.shift,

          `${sale.amount} ${currency}`,

          sale.date,

        ]
      ),

  }
)

const totalSales =
  sales.reduce(
    (
      total,
      sale
    ) =>
      total +
      Number(
        sale.amount
      ),

    0
  )

doc.text(
  `Total Sales: ${totalSales} ${currency}`,
  20,
  doc.lastAutoTable.finalY + 20
)

autoTable(
  doc,
  {

    startY:
      doc.lastAutoTable.finalY + 40,

    head: [[
      "Expense",
      "Category",
      "Amount",
      "Date",
    ]],

    body:
      expenses.map(
        (
          expense
        ) => [

          expense.expenseName,

          expense.category,

          `${expense.amount} ${currency}`,

          expense.date,

        ]
      ),

  }
)

const totalExpenses =
  expenses.reduce(
    (
      total,
      expense
    ) =>
      total +
      Number(
        expense.amount
      ),

    0
  )

doc.text(
  `Total Expenses: ${totalExpenses} ${currency}`,
  20,
  doc.lastAutoTable.finalY + 20
)

doc.save(
  "SERVORA-REPORT.pdf"
)

}

return (

<button

  onClick={
    downloadPDF
  }

  style={{
    background:
      "#2563eb",

    color:
      "white",

    border:
      "none",

    padding:
      "18px 28px",

    borderRadius:
      "16px",

    fontSize:
      "18px",

    cursor:
      "pointer",

    fontWeight:
      "bold",
  }}
>
  Download PDF Report
</button>

)
}