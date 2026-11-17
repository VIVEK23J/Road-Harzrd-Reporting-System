/** Where a visitor may go when they open the admin dashboard. */
export type AdminAccess = "allow" | "sign-in" | "not-admin";

export function adminAccess(signedIn: boolean, isAdmin: boolean): AdminAccess {
  if (!signedIn) return "sign-in";
  return isAdmin ? "allow" : "not-admin";
}
