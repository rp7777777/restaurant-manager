import {
useState,
} from "react"

export default function DutyPage() {

const [selectedDate, setSelectedDate] =
useState(
new Date()
.toISOString()
.split("T")[0]
)

const [employees, setEmployees] =
useState([])

const [workerName, setWorkerName] =
useState("")

const [position, setPosition] =
useState("Waiter")

const [schedule, setSchedule] =
useState({})

const getMonday = (date) => {

const current =
  new Date(date)

const day =
  current.getDay()

const diff =
  current.getDate() -
  day +
  (day === 0 ? -6 : 1)

return new Date(
  current.setDate(diff)
)

}

const monday =
getMonday(
new Date(selectedDate)
)

const weekDates =
[...Array(7)].map((_, i) => {

  const date =
    new Date(monday)

  date.setDate(
    monday.getDate() + i
  )

  return date

})

const addWorker = () => {

if (!workerName)
  return

const id =
  Date.now()

setEmployees([

  ...employees,

  {
    id,
    name: workerName,
    position,
  },

])

weekDates.forEach(
  (_, dayIndex) => {

    setSchedule((prev) => ({

      ...prev,

      [`${id}-${dayIndex}`]:
        "11:30/20:00",

    }))

  }
)

setWorkerName("")

}

const updateSchedule = (
employeeId,
dayIndex,
value
) => {

setSchedule({

  ...schedule,

  [`${employeeId}-${dayIndex}`]:
    value,

})

}

return (

<div
  style={{
    padding: "30px",
    background: "#f1f5f9",
    minHeight: "100vh",
  }}
>

  <div
    style={{
      background: "white",
      padding: "35px",
      borderRadius: "24px",
      marginBottom: "25px",
      boxShadow:
        "0 10px 30px rgba(0,0,0,0.08)",
    }}
  >

    <h1
      style={{
        fontSize: "40px",
        marginBottom: "10px",
      }}
    >
      Weekly Duty Schedule
    </h1>

    <p
      style={{
        color: "#64748b",
        marginBottom: "25px",
      }}
    >
      Restaurant & Hotel Staff Roster
    </p>

    <div
      style={{
        display: "flex",
        gap: "15px",
        flexWrap: "wrap",
      }}
    >

      <input

        type="date"

        value={selectedDate}

        onChange={(e) =>
          setSelectedDate(
            e.target.value
          )
        }

        style={inputStyle}
      />

      <input

        placeholder="Staff Name"

        value={workerName}

        onChange={(e) =>
          setWorkerName(
            e.target.value
          )
        }

        style={inputStyle}
      />

      <select

        value={position}

        onChange={(e) =>
          setPosition(
            e.target.value
          )
        }

        style={inputStyle}
      >

        <option>
          Manager
        </option>

        <option>
          Chef
        </option>

        <option>
          Waiter
        </option>

        <option>
          Kitchen
        </option>

        <option>
          Bar
        </option>

        <option>
          Reception
        </option>

        <option>
          Cleaner
        </option>

        <option>
          Security
        </option>

      </select>

      <button

        onClick={addWorker}

        style={{
          background: "#16a34a",
          color: "white",
          border: "none",
          padding: "15px 25px",
          borderRadius: "14px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        Add Staff
      </button>

      <button

        onClick={() =>
          window.print()
        }

        style={{
          background: "#2563eb",
          color: "white",
          border: "none",
          padding: "15px 25px",
          borderRadius: "14px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        Print
      </button>

    </div>

  </div>

  <div
    style={{
      background: "white",
      padding: "30px",
      borderRadius: "24px",
      overflowX: "auto",
      boxShadow:
        "0 10px 30px rgba(0,0,0,0.08)",
    }}
  >

    <div
      style={{
        marginBottom: "25px",
      }}
    >

      <h2>
        CHOPESTICK AND SPOON RESTAURANT BAR
      </h2>

      <p>
        Rua Brito Capelo
      </p>

      <p>
        Nif: 502552345
      </p>

    </div>

    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        minWidth: "1400px",
      }}
    >

      <thead>

        <tr
          style={{
            background: "#f8fafc",
          }}
        >

          <th style={tableHead}>
            S.no
          </th>

          <th style={tableHead}>
            Staff Name
          </th>

          <th style={tableHead}>
            Position
          </th>

          {
            weekDates.map(
              (
                date,
                index
              ) => (

                <th
                  key={index}
                  style={{
                    ...tableHead,

                    color:
                      index === 5 ||
                      index === 6
                        ? "red"
                        : "#0f172a",
                  }}
                >

                  <div>
                    {
                      date
                        .toLocaleDateString(
                          "en-US",
                          {
                            weekday:
                              "long",
                          }
                        )
                        .toUpperCase()
                    }
                  </div>

                  <div
                    style={{
                      fontSize:
                        "13px",

                      color:
                        "#0ea5e9",

                      marginTop:
                        "5px",
                    }}
                  >
                    {
                      date.toLocaleDateString()
                    }
                  </div>

                </th>

              )
            )
          }

        </tr>

      </thead>

      <tbody>

        {
          employees.map(
            (
              employee,
              employeeIndex
            ) => (

              <tr
                key={
                  employee.id
                }
              >

                <td style={tableData}>
                  {
                    employeeIndex + 1
                  }
                </td>

                <td style={tableData}>
                  {
                    employee.name
                  }
                </td>

                <td style={tableData}>
                  {
                    employee.position
                  }
                </td>

                {
                  weekDates.map(
                    (
                      _,
                      dayIndex
                    ) => (

                      <td
                        key={dayIndex}
                        style={tableData}
                      >

                        <input

                          value={
                            schedule[
                              `${employee.id}-${dayIndex}`
                            ] || ""
                          }

                          onChange={(e) =>
                            updateSchedule(
                              employee.id,
                              dayIndex,
                              e.target.value
                            )
                          }

                          style={{
                            width:
                              "120px",

                            padding:
                              "10px",

                            borderRadius:
                              "10px",

                            border:
                              "1px solid #cbd5e1",

                            textAlign:
                              "center",

                            fontWeight:
                              "bold",

                            color:
                              schedule[
                                `${employee.id}-${dayIndex}`
                              ] === "DAYOFF"
                                ? "red"
                                : "#0f172a",
                          }}
                        />

                      </td>

                    )
                  )
                }

              </tr>

            )
          )
        }

      </tbody>

    </table>

  </div>

</div>

)

}

const inputStyle = {

padding: "14px",

borderRadius: "12px",

border:
"1px solid #cbd5e1",

fontSize: "16px",
}

const tableHead = {

border:
"1px solid #cbd5e1",

padding: "14px",

textAlign:
"center",

fontSize: "15px",
}

const tableData = {

border:
"1px solid #e2e8f0",

padding: "12px",

textAlign:
"center",

fontSize: "14px",
}