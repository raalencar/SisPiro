import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_COST = 32768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

@Injectable()
export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await this.derive(password, salt);
    return [
      'scrypt',
      SCRYPT_COST,
      SCRYPT_BLOCK_SIZE,
      SCRYPT_PARALLELIZATION,
      salt.toString('hex'),
      derivedKey.toString('hex'),
    ].join('$');
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, saltHex, keyHex] =
      storedHash.split('$');
    if (
      algorithm !== 'scrypt' ||
      Number(cost) !== SCRYPT_COST ||
      Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
      Number(parallelization) !== SCRYPT_PARALLELIZATION ||
      !saltHex ||
      !keyHex ||
      !/^[0-9a-f]{32}$/i.test(saltHex) ||
      !/^[0-9a-f]{128}$/i.test(keyHex)
    ) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await this.derive(password, salt);
    return timingSafeEqual(actual, expected);
  }

  private derive(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(
        password,
        salt,
        KEY_LENGTH,
        {
          N: SCRYPT_COST,
          r: SCRYPT_BLOCK_SIZE,
          p: SCRYPT_PARALLELIZATION,
          maxmem: MAX_MEMORY,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(derivedKey);
        },
      );
    });
  }
}
