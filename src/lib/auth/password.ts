import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

// Hashes user passwords before persistence to prevent plaintext credential storage.
export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verifies login input against a stored bcrypt hash during authentication.
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
