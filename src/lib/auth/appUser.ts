import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  clerkUserId: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function pickPrimaryEmail(clerk: Awaited<ReturnType<typeof currentUser>>) {
  if (!clerk) return null;
  const preferred = clerk.emailAddresses.find((entry) => entry.id === clerk.primaryEmailAddressId)?.emailAddress;
  return normalizeEmail(preferred || clerk.emailAddresses[0]?.emailAddress);
}

function pickDisplayName(clerk: Awaited<ReturnType<typeof currentUser>>) {
  if (!clerk) return null;
  const fullName = [clerk.firstName, clerk.lastName].filter(Boolean).join(" ").trim();
  if (fullName.length) return fullName;
  if (clerk.username?.trim()) return clerk.username.trim();
  return null;
}

async function linkAppUser(clerkUserId: string, email: string, name: string | null): Promise<AppUser> {
  const existingByClerk = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true, name: true, clerkUserId: true }
  });
  if (existingByClerk) {
    const shouldUpdateName = name && existingByClerk.name !== name;
    const shouldUpdateEmail = existingByClerk.email !== email;
    if (!shouldUpdateName && !shouldUpdateEmail) return existingByClerk;
    return prisma.user.update({
      where: { id: existingByClerk.id },
      data: {
        ...(shouldUpdateName ? { name } : {}),
        ...(shouldUpdateEmail ? { email } : {})
      },
      select: { id: true, email: true, name: true, clerkUserId: true }
    });
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, clerkUserId: true }
  });
  if (existingByEmail) {
    if (existingByEmail.clerkUserId && existingByEmail.clerkUserId !== clerkUserId) {
      throw new Error("Email already linked to a different Clerk account.");
    }

    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkUserId,
        ...(name && !existingByEmail.name ? { name } : {})
      },
      select: { id: true, email: true, name: true, clerkUserId: true }
    });
  }

  return prisma.user.create({
    data: {
      email,
      name: name || undefined,
      clerkUserId
    },
    select: { id: true, email: true, name: true, clerkUserId: true }
  });
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerk = await currentUser();
  const email = pickPrimaryEmail(clerk);
  if (!email) {
    throw new Error("Authenticated Clerk user has no email address.");
  }

  return linkAppUser(userId, email, pickDisplayName(clerk));
}
