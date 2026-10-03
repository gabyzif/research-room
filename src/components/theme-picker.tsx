"use client";
import { useTranslations } from "@/components/language-provider";

export type Theme = "dark" | "violet" | "light";
export function ThemePicker({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const t = useTranslations();
  const options: { value: Theme; label: string }[] = [{ value: "light", label: t("theme.light") }, { value: "dark", label: t("theme.dark") }, { value: "violet", label: t("theme.contrast") }];
  return <div className="theme-picker" role="group" aria-label="Elegir tema">{options.map((option) => <button type="button" key={option.value} aria-pressed={theme === option.value} onClick={() => onChange(option.value)} className="theme-segment">{option.label}</button>)}</div>;
}
