import { useLanguage } from "@/contexts/LanguageContext";
import { regulatoryLabel, regulatoryText } from "@/lib/regulatory/presentation";

/** Dictionary keys for UI copy; paired catalog labels retain their versioned translations. */
export function useCraText() {
  const { locale, t } = useLanguage();
  return {
    locale,
    text: (key: string, english?: string) =>
      english === undefined ? t(key) : regulatoryText(locale, key, english),
    label: (key: string) => regulatoryLabel(locale, key),
  };
}
