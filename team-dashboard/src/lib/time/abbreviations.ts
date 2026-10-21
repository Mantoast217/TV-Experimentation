/**
 * Standard and summer-time abbreviations, so people can search for "JST" or "BST". Copied from
 * the meeting scheduler's GeoNames-based catalogue for the zones the sample team uses; a zone
 * that isn't listed (or has no common abbreviation, like America/Sao_Paulo) just doesn't match.
 */
export const TIME_ZONE_ABBREVIATIONS: Readonly<Record<string, readonly string[]>> = {
  "Africa/Johannesburg": ["SAST"],
  "America/Los_Angeles": ["PST", "PDT"],
  "America/Mexico_City": ["CST"],
  "America/New_York": ["EST", "EDT"],
  "Asia/Kolkata": ["IST"],
  "Asia/Tokyo": ["JST"],
  "Australia/Sydney": ["AEST", "AEDT"],
  "Europe/London": ["GMT", "BST"],
  "Europe/Stockholm": ["CET", "CEST"],
};
