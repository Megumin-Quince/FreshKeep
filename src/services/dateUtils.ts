import { FreshnessStatus } from "../types/inventory";

const dayMs = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseISODateAsLocal(dateText: string): Date {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(dateText: string): number {
  const today = startOfLocalDay(new Date());
  const target = parseISODateAsLocal(dateText);
  return Math.round((target.getTime() - today.getTime()) / dayMs);
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
