export function normalizeBrazilianTaxId(value: string): string {
  return value.replace(/[./-]/g, '');
}

export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);
  const firstCheckDigit = calculateCheckDigit(
    digits.slice(0, 9),
    [10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondCheckDigit = calculateCheckDigit(
    [...digits.slice(0, 9), firstCheckDigit],
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return digits[9] === firstCheckDigit && digits[10] === secondCheckDigit;
}

export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) {
    return false;
  }

  const digits = value.split('').map(Number);
  const firstCheckDigit = calculateCheckDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondCheckDigit = calculateCheckDigit(
    [...digits.slice(0, 12), firstCheckDigit],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return digits[12] === firstCheckDigit && digits[13] === secondCheckDigit;
}

function calculateCheckDigit(digits: number[], weights: number[]): number {
  const remainder =
    digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
