import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';

describe('LoginRateLimiterService', () => {
  it('allows attempts within limit', () => {
    const service = new LoginRateLimiterService();
    const key = 'test-ip-1';

    expect(() => service.assertNotRateLimited([key], 5)).not.toThrow();

    service.recordFailure([key], 60000, 5);
    service.recordFailure([key], 60000, 5);

    expect(() => service.assertNotRateLimited([key], 5)).not.toThrow();
  });

  it('throws 429 when max attempts is exceeded', () => {
    const service = new LoginRateLimiterService();
    const key = 'test-ip-blocked';

    for (let i = 0; i < 5; i++) {
      service.recordFailure([key], 60000, 5);
    }

    try {
      service.assertNotRateLimited([key], 5);
      expect.fail('Deveria ter lançado HttpException 429');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('resets attempts on successful login', () => {
    const service = new LoginRateLimiterService();
    const key = 'test-ip-reset';

    service.recordFailure([key], 60000, 5);
    service.recordFailure([key], 60000, 5);

    service.recordSuccess([key]);

    // O contador deve estar limpo
    expect(() => service.assertNotRateLimited([key], 5)).not.toThrow();
  });
});

