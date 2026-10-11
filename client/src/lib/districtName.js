import { pickText } from "./pickText";

// Turns a district key like "kandy" into its name in the current language.
export function districtName(districts, key, locale) {
  const district = districts?.find((candidate) => candidate.key === key);
  return district ? pickText(district.name, locale) : "";
}
