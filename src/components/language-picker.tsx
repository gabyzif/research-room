"use client";
import { Fragment } from "react";
import { useLanguage } from "@/components/language-provider";
const languages = [{ value: "es", label: "ES" }, { value: "en", label: "EN" }, { value: "pt", label: "PT" }] as const;
export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-picker" aria-label="Language / Idioma">{languages.map((item, index) => <Fragment key={item.value}>{index > 0 && <span className="language-divider">&middot;</span>}<button type="button" aria-pressed={language === item.value} onClick={() => setLanguage(item.value)} className="language-option">{item.label}</button></Fragment>)}</div>;
}
