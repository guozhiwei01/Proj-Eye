export const isMac: boolean =
  typeof navigator !== "undefined" &&
  navigator.userAgent.toLowerCase().includes("mac");

export const modifierKey: "meta" | "ctrl" = isMac ? "meta" : "ctrl";

export const modifierLabel: string = isMac ? "Cmd" : "Ctrl";
