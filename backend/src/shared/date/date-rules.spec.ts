import { futureDateOnly, isUpcoming, isoDateOnly } from "./date-rules.js";

describe("date rules", () => {
  const now = new Date("2026-08-29T10:00:00.000Z");

  it("treats an instant equal to now as upcoming", () => {
    expect(isUpcoming(new Date(now), now)).toBe(true);
  });

  it("rejects a past instant and keeps a future date", () => {
    expect(futureDateOnly(new Date("2026-08-29T09:59:59.999Z"), now)).toBeNull();
    expect(futureDateOnly(new Date("2026-09-02T09:00:00.000Z"), now)).toBe(
      "2026-09-02",
    );
  });

  it("serializes a date without duplicating timezone rules", () => {
    expect(isoDateOnly(new Date("2026-08-29T23:00:00.000Z"))).toBe("2026-08-29");
    expect(isoDateOnly(null)).toBeNull();
  });
});
