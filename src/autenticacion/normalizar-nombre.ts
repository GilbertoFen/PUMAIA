/**
 * Las cuentas @pcpuma traen el nombre como:
 *   "<GENERACIÓN> <ABREV. CARRERA> <APELLIDO PATERNO> <APELLIDO MATERNO> <NOMBRE(S)>"
 *   ej. "2024 Mat CASAS LORENZO SAUL"
 * Devuelve null si no se puede interpretar con confianza (el alumno lo confirma después).
 */
const PARTICLES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'VAN', 'VON', 'SAN', 'SANTA']);
const WORD = /^[\p{L}][\p{L}'.-]*$/u;

function titleCase(words: string[]): string {
  return words
    .map((w, i) =>
      i > 0 && PARTICLES.has(w.toUpperCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}

export function parseUnamAccountName(
  fullName: string | undefined | null,
): { generation: number; name: string; lastNameP: string; lastNameM: string } | null {
  if (!fullName) return null;
  const m = fullName.trim().match(/^(\d{4})\s+(\p{L}{2,6})\s+(.+)$/u);
  if (!m) return null;

  const tokens = m[3].trim().split(/\s+/);
  if (!tokens.every((t) => WORD.test(t))) return null;

  const takeSurname = (): string[] | null => {
    const unit: string[] = [];
    while (tokens.length > 0 && PARTICLES.has(tokens[0].toUpperCase())) {
      unit.push(tokens.shift()!);
    }
    if (tokens.length === 0) return null;
    unit.push(tokens.shift()!);
    return unit;
  };

  const apP = takeSurname();
  const apM = apP ? takeSurname() : null;
  // Debe sobrar al menos 1 palabra de nombre y no más de 4 (si no, es ambiguo)
  if (!apP || !apM || tokens.length < 1 || tokens.length > 4) return null;

  return {
    generation: parseInt(m[1], 10),
    lastNameP: titleCase(apP),
    lastNameM: titleCase(apM),
    name: titleCase(tokens),
  };
}
