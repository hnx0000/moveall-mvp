import { hash, verify, type Options } from "@node-rs/argon2";

const options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} satisfies Options;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
