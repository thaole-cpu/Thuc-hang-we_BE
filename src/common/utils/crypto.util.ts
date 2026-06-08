import { randomInt } from 'crypto';
export function generate4DigitCode(): string {
  return String(randomInt(1000, 10000));
}