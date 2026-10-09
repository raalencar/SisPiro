import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

@Injectable()
export class TotpService {
  private readonly stepSeconds = 30;
  private readonly digits = 6;
  private readonly encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawKey = this.config.getOrThrow<string>('AUTH_MFA_ENCRYPTION_KEY');
    this.encryptionKey = createHash('sha256').update(rawKey).digest();
  }

  /**
   * Criptografa o segredo TOTP (AES-256-GCM) antes de persistir. O segredo
   * precisa ser reversível para gerar códigos, então não pode ser apenas
   * hasheado como os tokens de reset/refresh.
   */
  encryptSecret(secret: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  /**
   * Descriptografa um segredo TOTP persistido por `encryptSecret`.
   */
  decryptSecret(payload: string): string {
    const buffer = Buffer.from(payload, 'base64');
    const iv = buffer.subarray(0, IV_LENGTH_BYTES);
    const authTag = buffer.subarray(
      IV_LENGTH_BYTES,
      IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
    );
    const ciphertext = buffer.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Converte bytes para string Base32 RFC 4648
   */
  encodeBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Decodifica string Base32 RFC 4648 para Buffer
   */
  decodeBase32(str: string): Buffer {
    const cleanStr = str.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const char = cleanStr[i];
      const index = BASE32_ALPHABET.indexOf(char);
      if (index === -1) {
        throw new Error(`Caractere Base32 inválido: ${char}`);
      }

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Gera segredo Base32 criptograficamente seguro (20 bytes / 160 bits)
   */
  generateSecret(): string {
    const buffer = randomBytes(20);
    return this.encodeBase32(buffer);
  }

  /**
   * Constrói a URL padrão otpauth:// para leitura por apps autenticadores
   */
  generateOtpAuthUrl(email: string, secret: string, issuer = 'SisPiro ERP'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Calcula o código TOTP de 6 dígitos para uma determinada timestamp/janela
   */
  generateCode(secret: string, timestampMs = Date.now()): string {
    const secretBuffer = this.decodeBase32(secret);
    const counter = Math.floor(timestampMs / 1000 / this.stepSeconds);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % 10 ** this.digits;
    return otp.toString().padStart(this.digits, '0');
  }

  /**
   * Valida código TOTP com tolerância de janela (clock drift)
   */
  verifyCode(
    token: string,
    secret: string,
    windowSteps = 1,
    timestampMs = Date.now(),
  ): boolean {
    if (!token || token.trim().length !== this.digits) {
      return false;
    }
    const cleanToken = token.trim();
    const tokenBuffer = Buffer.from(cleanToken);

    for (let step = -windowSteps; step <= windowSteps; step++) {
      const stepTimestamp = timestampMs + step * this.stepSeconds * 1000;
      try {
        const expectedCode = this.generateCode(secret, stepTimestamp);
        const expectedBuffer = Buffer.from(expectedCode);
        if (
          tokenBuffer.length === expectedBuffer.length &&
          timingSafeEqual(tokenBuffer, expectedBuffer)
        ) {
          return true;
        }
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Gera códigos de recuperação (backup) de uso único em formato legível
   */
  generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // 8 caracteres hexadecimais em maiúsculas (ex: 4A7B9C2E)
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Hasheia código de backup usando SHA-256 para persistência segura
   */
  hashBackupCode(code: string): string {
    return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  /**
   * Verifica se o código de backup informado coincide com algum hash da lista
   * Retorna o índice do código consumido, ou -1 se inválido
   */
  verifyAndConsumeBackupCode(
    code: string,
    storedHashes: string[],
  ): number {
    const inputHash = this.hashBackupCode(code);
    const inputBuffer = Buffer.from(inputHash);

    for (let i = 0; i < storedHashes.length; i++) {
      const storedBuffer = Buffer.from(storedHashes[i]);
      if (
        storedBuffer.length === inputBuffer.length &&
        timingSafeEqual(storedBuffer, inputBuffer)
      ) {
        return i;
      }
    }

    return -1;
  }
}

