// Strava timezone format: "(GMT+09:00) Asia/Seoul" → extract IANA timezone ID

function extractTimezoneId(stravaTimezone: string): string | null {
  const match = stravaTimezone.match(/\)\s*(.+)$/);
  return match ? match[1].trim() : null;
}

const TIMEZONE_COUNTRY: Record<string, { country: string; countryCode: string }> = {
  // East Asia
  "Asia/Seoul": { country: "South Korea", countryCode: "KR" },
  "Asia/Tokyo": { country: "Japan", countryCode: "JP" },
  "Asia/Taipei": { country: "Taiwan", countryCode: "TW" },
  "Asia/Shanghai": { country: "China", countryCode: "CN" },
  "Asia/Chongqing": { country: "China", countryCode: "CN" },
  "Asia/Hong_Kong": { country: "Hong Kong", countryCode: "HK" },
  "Asia/Macau": { country: "Macau", countryCode: "MO" },
  "Asia/Ulaanbaatar": { country: "Mongolia", countryCode: "MN" },
  "Asia/Chita": { country: "Russia", countryCode: "RU" },
  // Southeast Asia
  "Asia/Singapore": { country: "Singapore", countryCode: "SG" },
  "Asia/Bangkok": { country: "Thailand", countryCode: "TH" },
  "Asia/Ho_Chi_Minh": { country: "Vietnam", countryCode: "VN" },
  "Asia/Saigon": { country: "Vietnam", countryCode: "VN" },
  "Asia/Kuala_Lumpur": { country: "Malaysia", countryCode: "MY" },
  "Asia/Jakarta": { country: "Indonesia", countryCode: "ID" },
  "Asia/Makassar": { country: "Indonesia", countryCode: "ID" },
  "Asia/Jayapura": { country: "Indonesia", countryCode: "ID" },
  "Asia/Manila": { country: "Philippines", countryCode: "PH" },
  "Asia/Phnom_Penh": { country: "Cambodia", countryCode: "KH" },
  "Asia/Vientiane": { country: "Laos", countryCode: "LA" },
  "Asia/Yangon": { country: "Myanmar", countryCode: "MM" },
  "Asia/Rangoon": { country: "Myanmar", countryCode: "MM" },
  "Asia/Brunei": { country: "Brunei", countryCode: "BN" },
  // South Asia
  "Asia/Kolkata": { country: "India", countryCode: "IN" },
  "Asia/Calcutta": { country: "India", countryCode: "IN" },
  "Asia/Colombo": { country: "Sri Lanka", countryCode: "LK" },
  "Asia/Kathmandu": { country: "Nepal", countryCode: "NP" },
  "Asia/Dhaka": { country: "Bangladesh", countryCode: "BD" },
  "Asia/Karachi": { country: "Pakistan", countryCode: "PK" },
  // Central Asia
  "Asia/Bishkek": { country: "Kyrgyzstan", countryCode: "KG" },
  "Asia/Almaty": { country: "Kazakhstan", countryCode: "KZ" },
  "Asia/Tashkent": { country: "Uzbekistan", countryCode: "UZ" },
  "Asia/Tbilisi": { country: "Georgia", countryCode: "GE" },
  "Asia/Baku": { country: "Azerbaijan", countryCode: "AZ" },
  "Asia/Yerevan": { country: "Armenia", countryCode: "AM" },
  // Middle East
  "Asia/Dubai": { country: "UAE", countryCode: "AE" },
  "Asia/Riyadh": { country: "Saudi Arabia", countryCode: "SA" },
  "Asia/Qatar": { country: "Qatar", countryCode: "QA" },
  "Asia/Tehran": { country: "Iran", countryCode: "IR" },
  "Asia/Beirut": { country: "Lebanon", countryCode: "LB" },
  "Asia/Jerusalem": { country: "Israel", countryCode: "IL" },
  // Western Europe
  "Europe/London": { country: "United Kingdom", countryCode: "GB" },
  "Europe/Paris": { country: "France", countryCode: "FR" },
  "Europe/Berlin": { country: "Germany", countryCode: "DE" },
  "Europe/Rome": { country: "Italy", countryCode: "IT" },
  "Europe/Madrid": { country: "Spain", countryCode: "ES" },
  "Europe/Amsterdam": { country: "Netherlands", countryCode: "NL" },
  "Europe/Brussels": { country: "Belgium", countryCode: "BE" },
  "Europe/Zurich": { country: "Switzerland", countryCode: "CH" },
  "Europe/Vienna": { country: "Austria", countryCode: "AT" },
  "Europe/Lisbon": { country: "Portugal", countryCode: "PT" },
  "Europe/Dublin": { country: "Ireland", countryCode: "IE" },
  "Europe/Luxembourg": { country: "Luxembourg", countryCode: "LU" },
  "Europe/Monaco": { country: "Monaco", countryCode: "MC" },
  "Atlantic/Canary": { country: "Spain", countryCode: "ES" },
  // Northern Europe
  "Europe/Copenhagen": { country: "Denmark", countryCode: "DK" },
  "Europe/Stockholm": { country: "Sweden", countryCode: "SE" },
  "Europe/Oslo": { country: "Norway", countryCode: "NO" },
  "Europe/Helsinki": { country: "Finland", countryCode: "FI" },
  "Atlantic/Reykjavik": { country: "Iceland", countryCode: "IS" },
  // Eastern Europe
  "Europe/Prague": { country: "Czech Republic", countryCode: "CZ" },
  "Europe/Warsaw": { country: "Poland", countryCode: "PL" },
  "Europe/Budapest": { country: "Hungary", countryCode: "HU" },
  "Europe/Bucharest": { country: "Romania", countryCode: "RO" },
  "Europe/Sofia": { country: "Bulgaria", countryCode: "BG" },
  "Europe/Athens": { country: "Greece", countryCode: "GR" },
  "Europe/Istanbul": { country: "Turkey", countryCode: "TR" },
  "Europe/Ljubljana": { country: "Slovenia", countryCode: "SI" },
  "Europe/Zagreb": { country: "Croatia", countryCode: "HR" },
  "Europe/Belgrade": { country: "Serbia", countryCode: "RS" },
  "Europe/Bratislava": { country: "Slovakia", countryCode: "SK" },
  "Europe/Vilnius": { country: "Lithuania", countryCode: "LT" },
  "Europe/Riga": { country: "Latvia", countryCode: "LV" },
  "Europe/Tallinn": { country: "Estonia", countryCode: "EE" },
  "Europe/Kiev": { country: "Ukraine", countryCode: "UA" },
  "Europe/Kyiv": { country: "Ukraine", countryCode: "UA" },
  "Europe/Moscow": { country: "Russia", countryCode: "RU" },
  // Americas
  "America/New_York": { country: "United States", countryCode: "US" },
  "America/Chicago": { country: "United States", countryCode: "US" },
  "America/Denver": { country: "United States", countryCode: "US" },
  "America/Los_Angeles": { country: "United States", countryCode: "US" },
  "America/Phoenix": { country: "United States", countryCode: "US" },
  "America/Anchorage": { country: "United States", countryCode: "US" },
  "Pacific/Honolulu": { country: "United States", countryCode: "US" },
  "America/Toronto": { country: "Canada", countryCode: "CA" },
  "America/Vancouver": { country: "Canada", countryCode: "CA" },
  "America/Mexico_City": { country: "Mexico", countryCode: "MX" },
  "America/Bogota": { country: "Colombia", countryCode: "CO" },
  "America/Lima": { country: "Peru", countryCode: "PE" },
  "America/Santiago": { country: "Chile", countryCode: "CL" },
  "America/Buenos_Aires": { country: "Argentina", countryCode: "AR" },
  "America/Argentina/Buenos_Aires": { country: "Argentina", countryCode: "AR" },
  "America/Sao_Paulo": { country: "Brazil", countryCode: "BR" },
  // Oceania
  "Pacific/Auckland": { country: "New Zealand", countryCode: "NZ" },
  "Australia/Sydney": { country: "Australia", countryCode: "AU" },
  "Australia/Melbourne": { country: "Australia", countryCode: "AU" },
  "Australia/Brisbane": { country: "Australia", countryCode: "AU" },
  "Australia/Perth": { country: "Australia", countryCode: "AU" },
  // Africa
  "Africa/Johannesburg": { country: "South Africa", countryCode: "ZA" },
  "Africa/Cairo": { country: "Egypt", countryCode: "EG" },
  "Africa/Nairobi": { country: "Kenya", countryCode: "KE" },
  "Africa/Casablanca": { country: "Morocco", countryCode: "MA" },
  // Generic offsets (Etc zones — Strava sometimes uses these)
  "Etc/GMT-9": { country: "South Korea", countryCode: "KR" },
  "Etc/GMT-8": { country: "China", countryCode: "CN" },
};

export function countryFromTimezone(
  stravaTimezone: string
): { country: string; countryCode: string } | null {
  const tzId = extractTimezoneId(stravaTimezone);
  if (!tzId) return null;
  return TIMEZONE_COUNTRY[tzId] ?? null;
}
