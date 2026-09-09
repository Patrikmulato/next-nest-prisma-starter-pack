import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const SCRYPT_KEY_LENGTH = 64;
const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, salt, hashHex] = encodedHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
