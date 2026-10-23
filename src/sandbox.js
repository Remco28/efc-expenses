// The practice trip's starting state. "Reset" puts the trip back to exactly this.
// Plain JS so the Worker and the seeding script share one copy.
const D = ["2027-03-13", "2027-03-14"]; // Saturday, Sunday

export const SANDBOX = {
  name: "The Totally Serious Pancake Cup",
  location: "Columbus, OH",
  start_date: D[0],
  end_date: D[1],
  // [family, how to pay them, [[name, fencer (1/0), days fencing]]]
  families: [
    ["Bennett", "Venmo @laura-bennett", [["Emma", 1, D], ["Laura", 0, []]]],
    ["Garcia", "Zelle 614-555-0123", [["Diego", 1, [D[0]]], ["Ana", 0, []]]],
    ["Nguyen", "", [["Lily", 1, D], ["Linh", 0, []], ["Minh", 0, []]]],
  ],
  // [name, role, how the treasurer pays them back]: travel with the team, never share costs
  staff: [["Mike Torres", "Coach", "Zelle 614-555-0150"]],
  // [description, vendor, day, kind, cents, paid by, receipt image, who took part {family: head count}]
  expenses: [
    ["Coach's flight", "Southwest", null, "coach_travel", 38000, "Bennett", null, null],
    ["Coach's hotel, Saturday night", "Hampton Inn", null, "coach_stay", 16000, "Mike Torres", null, null],
    ["Team pizza dinner", "Tony's Pizzeria", D[0], "meal", 9600, "Garcia", "/sandbox/receipt.jpg", { Bennett: 2, Garcia: 2, Nguyen: 2 }],
    ["Coach's breakfast and coffee", "Starbucks", D[1], "coach_meals", 1850, "Nguyen", null, null],
    ["Lunch near the venue", "Panera Bread", D[1], "meal", 5400, "Nguyen", null, { Bennett: 2, Nguyen: 3 }],
  ],
};
