// The practice trip's starting state. "Reset" puts the trip back to exactly this.
const D = ["2027-07-16", "2027-07-17", "2027-07-18"];

export const SANDBOX = {
  name: "Fencing on the Moon: The Tranquility Open",
  location: "Sea of Tranquility, Moon",
  start_date: D[0],
  end_date: D[2],
  // [family, how to pay them, [[name, fencer, days there, days fencing]]]
  families: [
    ["Bennett", "Venmo @laura-bennett", [["Emma", 1, D, D.slice(1)], ["Jack", 1, D, [D[1]]], ["Laura", 0, D, []]]],
    ["Garcia", "", [["Diego", 1, D.slice(0, 2), D.slice(0, 2)], ["Ana", 0, D.slice(0, 2), []]]],
    ["Nguyen", "Zelle 555-0199", [["Lily", 1, D.slice(1), [D[2]]], ["Ben", 0, D.slice(1), []], ["Linh", 0, D.slice(1), []]]],
    ["Sullivan", "", [["Owen", 1, D, D], ["Grace", 1, D, [D[0]]], ["Mike", 0, D, []], ["Grandma Joan", 0, D, []]]],
  ] as [string, string, [string, number, string[], string[]][]][],
  // [description, vendor, day, category, basis, cents, paid by, receipt image or null]
  expenses: [
    ["Coach's rocket fare, round trip", "Earth-Moon Express", null, "coach_travel", "fencer", 196900, "Bennett", null],
    ["Coach's crater-side lodge, 2 nights", "Tranquility Base Inn", null, "coach_stay", "fencer_day", 64200, "Sullivan", null],
    ["Team dinner at the Lunar Diner", "The Lunar Diner", D[0], "meal", "person", 18740, "Garcia", "/sandbox/lunar-diner.jpg"],
    ["Moon buggy rental, whole weekend", "Rover Rentals", null, "transport", "family", 24000, "Nguyen", null],
    ["Astronaut ice cream for the team", "Gift shop", D[1], "meal", "person", 4860, "Sullivan", null],
    ["Coach's freeze-dried meals", "", null, "coach_stay", "fencer_day", 9600, "Bennett", null],
    ["Oxygen tank refills", "Lunar Supply Co.", null, "supplies", "fencer", 12000, "Nguyen", null],
  ] as [string, string, string | null, string, string, number, string, string | null][],
};
