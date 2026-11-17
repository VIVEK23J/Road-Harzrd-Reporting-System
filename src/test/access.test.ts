import { describe, expect, it } from "vitest";
import { adminAccess } from "@/lib/access";

describe("admin dashboard access", () => {
  it("lets admins in", () => {
    expect(adminAccess(true, true)).toBe("allow");
  });
  it("keeps signed-in regular users out", () => {
    expect(adminAccess(true, false)).toBe("not-admin");
  });
  it("sends signed-out visitors to sign in", () => {
    expect(adminAccess(false, false)).toBe("sign-in");
  });
});
