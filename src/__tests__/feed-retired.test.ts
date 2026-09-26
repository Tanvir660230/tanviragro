import { feedRoles, isRetired } from "@/lib/feed/feed-data";

describe("an item with stock is never tucked away as retired", () => {
  it("retired only when flagged, empty and not in use", () => {
    expect(isRetired(true, 0)).toBe(true);
    expect(isRetired(true, 330)).toBe(false);          // the 25 Sep mix made into a retired item
    expect(isRetired(true, 0, true)).toBe(false);      // in use
    expect(isRetired(false, 0)).toBe(false);
  });
  it("a mix is a mix even when its item was retired", () => {
    const roles = feedRoles({ items: [{ id: "m", name: "দানাদার মিক্স", unit: "kg", category: "feed", is_discontinued: true }], mixOutputIds: [], ingredientIds: [] });
    expect(roles.m).toBe("mix");
  });
});
