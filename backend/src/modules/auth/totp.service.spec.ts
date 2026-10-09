import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { TotpService } from './totp.service.js';

function createService(): TotpService {
  const config = {
    getOrThrow: () => 'test-only-mfa-encryption-key-with-32-chars-min',
  } as unknown as ConfigService;
  return new TotpService(config);
}

describe('TotpService', () => {
  const service = createService();

  it('generates a valid Base32 secret', () => {
    const secret = service.generateSecret();
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('correctly encodes and decodes Base32', () => {
    const buffer = Buffer.from('SisPiro-ERP-2026');
    const encoded = service.encodeBase32(buffer);
    const decoded = service.decodeBase32(encoded);
    expect(decoded.toString()).toBe('SisPiro-ERP-2026');
  });

  it('generates and verifies TOTP code within valid window', () => {
    const secret = service.generateSecret();
    const now = Date.now();
    const code = service.generateCode(secret, now);

    expect(code).toMatch(/^\d{6}$/);

    // Deve validar no momento atual
    expect(service.verifyCode(code, secret, 1, now)).toBe(true);

    // Deve validar no passo anterior (-30s)
    expect(service.verifyCode(code, secret, 1, now + 30000)).toBe(true);

    // Deve validar no passo posterior (+30s)
    expect(service.verifyCode(code, secret, 1, now - 30000)).toBe(true);

    // Deve rejeitar fora da janela (> 60s)
    expect(service.verifyCode(code, secret, 1, now + 90000)).toBe(false);

    // Deve rejeitar código incorreto
    expect(service.verifyCode('999999', secret, 1, now)).toBe(false);
  });

  it('generates, hashes, and consumes single-use backup codes', () => {
    const backupCodes = service.generateBackupCodes(8);
    expect(backupCodes).toHaveLength(8);
    for (const code of backupCodes) {
      expect(code).toMatch(/^[A-F0-9]{8}$/);
    }

    const hashes = backupCodes.map((code) => service.hashBackupCode(code));

    // Consome o primeiro código
    const index0 = service.verifyAndConsumeBackupCode(backupCodes[0], hashes);
    expect(index0).toBe(0);

    // Consome o terceiro código
    const index2 = service.verifyAndConsumeBackupCode(backupCodes[2], hashes);
    expect(index2).toBe(2);

    // Rejeita código inválido
    const invalidIndex = service.verifyAndConsumeBackupCode('INVALID1', hashes);
    expect(invalidIndex).toBe(-1);
  });

  it('generates correct otpauth URL', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const email = 'operador@sispiro.com.br';
    const url = service.generateOtpAuthUrl(email, secret);

    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(encodeURIComponent(email));
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('issuer=SisPiro%20ERP');
  });

  it('encrypts the secret so it is never stored in plain text', () => {
    const secret = service.generateSecret();
    const encrypted = service.encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(encrypted).not.toBe(secret);
  });

  it('round-trips encrypt/decrypt back to the original secret', () => {
    const secret = service.generateSecret();
    const encrypted = service.encryptSecret(secret);
    expect(service.decryptSecret(encrypted)).toBe(secret);
  });

  it('produces a different ciphertext each time (random IV) for the same secret', () => {
    const secret = service.generateSecret();
    const first = service.encryptSecret(secret);
    const second = service.encryptSecret(secret);
    expect(first).not.toBe(second);
    expect(service.decryptSecret(first)).toBe(secret);
    expect(service.decryptSecret(second)).toBe(secret);
  });

  it('rejects decryption with a different encryption key', () => {
    const secret = service.generateSecret();
    const encrypted = service.encryptSecret(secret);
    const otherService = new TotpService({
      getOrThrow: () => 'a-completely-different-32-char-plus-key',
    } as unknown as ConfigService);
    expect(() => otherService.decryptSecret(encrypted)).toThrow();
  });
});

