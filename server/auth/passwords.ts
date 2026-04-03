import bcrypt from "bcrypt";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPasswordAgainstUser(
  plain: string,
  user: { password?: string; passwordHash?: string | null }
): boolean {
  const h = user.passwordHash?.trim();
  if (h && h.startsWith("$2")) {
    try {
      return bcrypt.compareSync(plain, h);
    } catch {
      return false;
    }
  }
  if (user.password && user.password.length > 0) {
    return user.password === plain;
  }
  return false;
}
