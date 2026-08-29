import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const qa = Object.fromEntries(
  readFileSync(resolve(__dirname, "../../.phase-c-qa.env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
