// State/UT capitals + selected major metros. Used to filter CPCB AQI
// readings - only these cities can trigger the AQI counter.
//
// Matching is case-insensitive `station.includes(city)`, which is how the
// CPCB feed refers to local monitoring stations (e.g. "Anand Vihar, Delhi -
// DPCC").

export const MAJOR_CITIES: readonly string[] = [
  // Metros
  "Delhi",
  "Mumbai",
  "Kolkata",
  "Chennai",
  "Bengaluru",
  "Hyderabad",
  "Ahmedabad",
  "Pune",
  // State capitals
  "Jaipur",
  "Lucknow",
  "Bhopal",
  "Patna",
  "Raipur",
  "Ranchi",
  "Dehradun",
  "Chandigarh",
  "Shimla",
  "Srinagar",
  "Jammu",
  "Bhubaneswar",
  "Gandhinagar",
  "Thiruvananthapuram",
  "Panaji",
  "Amaravati",
  "Vijayawada",
  "Guwahati",
  "Dispur",
  "Imphal",
  "Aizawl",
  "Kohima",
  "Agartala",
  "Shillong",
  "Itanagar",
  "Gangtok",
  "Puducherry",
  // Tier-1 non-capitals with dense CPCB coverage
  "Noida",
  "Ghaziabad",
  "Gurugram",
  "Faridabad",
  "Kanpur",
  "Varanasi",
  "Agra",
  "Meerut",
  "Nagpur",
  "Surat",
  "Indore",
  "Vadodara",
  "Visakhapatnam",
  "Coimbatore",
  "Mysuru",
  "Kochi",
] as const;

export const CITY_SET = new Set(MAJOR_CITIES.map((c) => c.toLowerCase()));

export function matchCity(stationName: string): string | null {
  const s = stationName.toLowerCase();
  for (const c of MAJOR_CITIES) {
    if (s.includes(c.toLowerCase())) return c;
  }
  return null;
}
