// The practice trip's starting state. "Reset" puts the trip back to exactly this.
// Plain JS so the Worker and the seeding script share one copy.
const D = ["2027-03-13", "2027-03-14"]; // Saturday, Sunday

export const SANDBOX = {
  name: "The Totally Serious Pancake Cup",
  location: "Columbus, OH",
  start_date: D[0],
  end_date: D[1],
  // [family, how to pay them, [[name, fencer (1/0), days there, days fencing]]]
  families: [
    ["Bennett", "Venmo @laura-bennett", [["Emma", 1, D, D], ["Laura", 0, D, []]]],
    ["Garcia", "Zelle 614-555-0123", [["Diego", 1, [D[0]], [D[0]]], ["Ana", 0, [D[0]], []]]],
    ["Nguyen", "", [["Lily", 1, D, D], ["Linh", 0, D, []]]],
  ],
  // [description, vendor, day, category, split, cents, paid by, receipt image]
  expenses: [
    ["Coach's flight", "Southwest", null, "coach_travel", "fencer", 38000, "Bennett", null],
    ["Coach's hotel, Saturday night", "Hampton Inn", null, "coach_stay", "fencer_day", 16000, "Nguyen", null],
    ["Team pizza dinner", "Tony's Pizzeria", D[0], "meal", "person", 9600, "Garcia", "/sandbox/receipt.jpg"],
    ["Parking at the venue", "Convention center lot", null, "transport", "family", 3000, "Bennett", null],
    ["Team lunch", "Panera Bread", D[1], "meal", "person", 5400, "Nguyen", null],
  ],
};
