"use client";

import { signOut } from "next-auth/react";

// Signs the user out and redirects to the login page.
export function LogoutButton() {
  return (
    <button
      className="secondary"
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
    >
      Logout
    </button>
  );
}