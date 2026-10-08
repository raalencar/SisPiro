import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types.js';

const testAdmin = {
  name: 'Administrador E2E',
  email: 'e2e-admin@local.test',
  password: 'Local E2E Admin Password 2026',
};
let accessToken: string | undefined;

export async function authenticateE2eAdmin(
  app: INestApplication<App>,
): Promise<string> {
  const bootstrap = await supertest(app.getHttpServer())
    .post('/api/v1/auth/bootstrap')
    .send(testAdmin);
  if (bootstrap.status === 201) {
    accessToken = bootstrap.body.accessToken as string;
    return accessToken;
  }
  if (bootstrap.status !== 409) {
    throw new Error(
      `Falha no bootstrap de autenticação E2E: ${bootstrap.status}`,
    );
  }

  const login = await supertest(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: testAdmin.email, password: testAdmin.password });
  if (login.status !== 200 || typeof login.body.accessToken !== 'string') {
    throw new Error(`Falha no login de autenticação E2E: ${login.status}`);
  }
  accessToken = login.body.accessToken as string;
  return accessToken;
}

export function request(server: App): ReturnType<typeof supertest> {
  if (!accessToken) {
    throw new Error(
      'A autenticação E2E deve ser configurada antes das requisições.',
    );
  }
  const test = supertest(server);
  const methods = new Set([
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
  ]);
  return new Proxy(test, {
    get(target, property) {
      const member = Reflect.get(target, property, target) as unknown;
      if (methods.has(String(property)) && typeof member === 'function') {
        return (...args: unknown[]) =>
          Reflect.apply(member, target, args).set(
            'Authorization',
            `Bearer ${accessToken}`,
          );
      }
      return typeof member === 'function' ? member.bind(target) : member;
    },
  }) as ReturnType<typeof supertest>;
}
