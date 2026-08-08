const COUNTRY_LABELS: Record<string, string> = {
  country: "País",
  mexico: "México",
  "united states": "Estados Unidos",
  usa: "Estados Unidos",
  "u.s.": "Estados Unidos",
};

const ARTIST_TYPE_LABELS: Record<string, string> = {
  mexican: "Mexicano/a",
  "mexican artist": "Artista mexicano/a",
  "mexican group": "Grupo mexicano",
  "mexican band": "Banda mexicana",
  "mexican group/band": "Grupo/Banda mexicana",
};

const GENRE_LABELS: Record<string, string> = {
  "regional mexican": "Regional mexicano",
  "latin pop": "Pop latino",
  "latin hip hop": "Hip-hop latino",
  "latin rock": "Rock latino",
  "mexican hip hop": "Hip-hop mexicano",
  "mexican rock": "Rock mexicano",
  alternative: "Alternativo",
  electronic: "Electrónica",
};

function translated(value: string, dictionary: Record<string, string>) {
  const clean = value.trim();
  return dictionary[clean.toLowerCase()] ?? clean;
}

export const countryLabel = (value: string) => translated(value, COUNTRY_LABELS);
export const artistTypeLabel = (value: string) => translated(value, ARTIST_TYPE_LABELS);
export const genreLabel = (value: string) => {
  const exact = translated(value, GENRE_LABELS);
  if (exact !== value.trim()) return exact;
  return value
    .trim()
    .replace(/Mexican-American/gi, "Mexicano-estadounidense")
    .replace(/Regional Mexican/gi, "Regional mexicano")
    .replace(/Mexican Hip[- ]Hop/gi, "Hip-hop mexicano")
    .replace(/Latin Pop/gi, "Pop latino")
    .replace(/Latin Rock/gi, "Rock latino")
    .replace(/\bMexican\b/gi, "Mexicano/a");
};
export const labelAssociationValue = (value: string) => (
  value.trim().toLowerCase() === "other indie / unsigned" ? "Independiente / Sin sello" : value.trim()
);
