export interface ContrastResult {
  theme: "light" | "dark";
  fg: string;
  bg: string;
  min: number;
  use: string;
  ratio: number;
  pass: boolean;
}
export const PAIRS: [fg: string, bg: string, min: number, use: string][];
export function toRgb(value: string): [number, number, number];
export function contrast(a: number[], b: number[]): number;
export function checkContrast(cssTexts?: string[]): ContrastResult[];
