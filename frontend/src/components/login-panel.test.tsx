// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPanel } from "./login-panel";
import { authApi } from "@/lib/auth";

const mockLogin = vi.fn();
const mockVerifyMfa = vi.fn();

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    login: mockLogin,
    verifyMfa: mockVerifyMfa,
    status: "anonymous",
    user: null,
    error: null,
    refreshSession: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
    },
  };
});

describe("<LoginPanel />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders login form by default with email and password fields", () => {
    render(<LoginPanel />);

    expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeDefined();
    expect(screen.getByLabelText("E-mail")).toBeDefined();
    expect(screen.getByLabelText("Senha")).toBeDefined();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Esqueci minha senha" })).toBeDefined();
  });

  it("submits login credentials when form is submitted", async () => {
    mockLogin.mockResolvedValueOnce({
      id: "u-1",
      name: "Admin",
      email: "admin@local.test",
      roles: ["ADMIN"],
    });

    render(<LoginPanel />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "admin@local.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "SecretPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("admin@local.test", "SecretPass123!");
    });
  });

  it("switches to MFA mode when login returns MFA challenge", async () => {
    mockLogin.mockResolvedValueOnce({
      mfaRequired: true,
      mfaToken: "challenge-token-xyz",
    });

    render(<LoginPanel />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "mfa@local.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "SecretPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Autenticação em duas etapas" }),
      ).toBeDefined();
    });
    expect(
      screen.getByLabelText(/Código de autenticação/i),
    ).toBeDefined();
  });

  it("switches to password recovery mode and requests reset instructions", async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValueOnce({
      message: "Instruções enviadas com sucesso.",
    });

    render(<LoginPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));

    expect(
      screen.getByRole("heading", { name: "Esqueci minha senha" }),
    ).toBeDefined();

    fireEvent.change(screen.getByLabelText("E-mail cadastrado"), {
      target: { value: "operador@local.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    await waitFor(() => {
      expect(authApi.requestPasswordReset).toHaveBeenCalledWith("operador@local.test");
      expect(screen.getByText("Instruções enviadas com sucesso.")).toBeDefined();
    });
  });

  it("validates password length and match in password reset confirm mode", async () => {
    render(<LoginPanel />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Já tem um token de recuperação? Redefina aqui",
      }),
    );

    expect(screen.getByRole("heading", { name: "Definir nova senha" })).toBeDefined();

    fireEvent.change(screen.getByLabelText("Token de recuperação"), {
      target: { value: "a".repeat(32) },
    });
    fireEvent.change(screen.getByLabelText("Nova senha (mínimo 12 caracteres)"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "short" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(
        screen.getByText("A nova senha deve ter no mínimo 12 caracteres."),
      ).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Nova senha (mínimo 12 caracteres)"), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "DifferentPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(
        screen.getByText("A confirmação da nova senha não confere com a senha digitada."),
      ).toBeDefined();
    });
  });

  it("successfully resets password with valid token and passwords", async () => {
    vi.mocked(authApi.confirmPasswordReset).mockResolvedValueOnce({
      message: "Senha redefinida com sucesso. Faça login com a nova senha.",
    });

    render(<LoginPanel />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Já tem um token de recuperação? Redefina aqui",
      }),
    );

    const token = "a".repeat(32);
    const newPass = "NewSecurePassword2026!";

    fireEvent.change(screen.getByLabelText("Token de recuperação"), {
      target: { value: token },
    });
    fireEvent.change(screen.getByLabelText("Nova senha (mínimo 12 caracteres)"), {
      target: { value: newPass },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: newPass },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(authApi.confirmPasswordReset).toHaveBeenCalledWith(token, newPass);
      // Returns to login mode and shows success banner
      expect(screen.getByRole("heading", { name: "Entre na sua conta" })).toBeDefined();
      expect(
        screen.getByText("Senha redefinida com sucesso. Faça login com a nova senha."),
      ).toBeDefined();
    });
  });
});
