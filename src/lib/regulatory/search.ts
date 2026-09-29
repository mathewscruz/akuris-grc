/** Accent-insensitive matching shared by the CRA lists; DataTable only renders controls. */
export function matchesRegulatorySearch(search: string, ...fields: unknown[]) {
  const normalize = (value: unknown) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  return normalize(fields.join(" ")).includes(normalize(search.trim()));
}
