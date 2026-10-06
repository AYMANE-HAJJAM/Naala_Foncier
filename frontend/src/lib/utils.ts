import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export { formatDate } from "./domain/date";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
