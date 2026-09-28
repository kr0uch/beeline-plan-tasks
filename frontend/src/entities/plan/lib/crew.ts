export function crewShortName(name: string): string {
  const num = name.match(/\d+/)?.[0]
  const letters = name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .map((w) => w[0].toUpperCase())
  return num ? `${letters[0] ?? ''}${num}` : letters.slice(0, 2).join('') || '—'
}
