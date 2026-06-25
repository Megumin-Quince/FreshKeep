import { FreshnessStatus } from "../types/inventory";

const dayMs = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysUntil(dateText: string): number {
  const today = new Date();
  const target = new Date(`${dateText}T23:59:59`);
  return Math.ceil((target.getTime() - today.getTime()) / dayMs);
}

export function freshnessStatus(expiresAt: string): FreshnessStatus {
  const remaining = daysUntil(expiresAt);
  if (remaining < 0) {
    return "expired";
  }
  if (remaining <= 2) {
    return "soon";
  }
  return "fresh";
}

export function formatRemaining(expiresAt: string): string {
  const remaining = daysUntil(expiresAt);
  if (remaining < 0) {
    return `已过期 ${Math.abs(remaining)} 天`;
  }
  if (remaining === 0) {
    return "今天到期";
  }
  return `${remaining} 天后到期`;
}
