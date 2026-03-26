import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userCreate: vi.fn()
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
      create: mocks.userCreate
    }
  }
}));

import { getCurrentAppUser } from "@/lib/auth/appUser";

function buildClerkUser(email: string) {
  return {
    id: "clerk_1",
    firstName: "Niels",
    lastName: "Koeman",
    username: null,
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      { id: "email_primary", emailAddress: email }
    ]
  };
}

describe("getCurrentAppUser", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.currentUser.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.userUpdate.mockReset();
    mocks.userCreate.mockReset();
  });

  it("returns null when no Clerk session exists", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await getCurrentAppUser();

    expect(result).toBeNull();
    expect(mocks.currentUser).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("returns existing linked user by clerkUserId", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_1" });
    mocks.currentUser.mockResolvedValue(buildClerkUser("user@example.com"));
    mocks.userFindUnique.mockResolvedValueOnce({
      id: "user_1",
      email: "user@example.com",
      name: "Niels Koeman",
      clerkUserId: "clerk_1"
    });

    const result = await getCurrentAppUser();

    expect(result?.id).toBe("user_1");
    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("links existing user by email on first Clerk sign-in", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_1" });
    mocks.currentUser.mockResolvedValue(buildClerkUser("user@example.com"));
    mocks.userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user_1",
        email: "user@example.com",
        name: null,
        clerkUserId: null
      });
    mocks.userUpdate.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      name: "Niels Koeman",
      clerkUserId: "clerk_1"
    });

    const result = await getCurrentAppUser();

    expect(result?.clerkUserId).toBe("clerk_1");
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        clerkUserId: "clerk_1",
        name: "Niels Koeman"
      },
      select: { id: true, email: true, name: true, clerkUserId: true }
    });
  });

  it("creates a local user when no match exists", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_1" });
    mocks.currentUser.mockResolvedValue(buildClerkUser("new@example.com"));
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({
      id: "user_2",
      email: "new@example.com",
      name: "Niels Koeman",
      clerkUserId: "clerk_1"
    });

    const result = await getCurrentAppUser();

    expect(result?.id).toBe("user_2");
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        name: "Niels Koeman",
        clerkUserId: "clerk_1"
      },
      select: { id: true, email: true, name: true, clerkUserId: true }
    });
  });

  it("throws if email is already linked to another Clerk account", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_1" });
    mocks.currentUser.mockResolvedValue(buildClerkUser("user@example.com"));
    mocks.userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "user_1",
        email: "user@example.com",
        name: "Existing",
        clerkUserId: "clerk_other"
      });

    await expect(getCurrentAppUser()).rejects.toThrow("Email already linked to a different Clerk account.");
  });
});
