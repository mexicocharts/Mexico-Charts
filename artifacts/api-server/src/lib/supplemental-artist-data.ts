export type SupplementalArtist = {
  artistKey: string;
  artistName: string;
  spotifyArtistId: string;
  genre: string;
  subgenre: string;
  kworbYoutube?: boolean;
  kworbItunes?: boolean;
};

/** Kworb keys are compact ASCII slugs (for example, "Gera MX" -> "geramx"). */
export function toKworbArtistKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Provider-verified Mexican artists approved from the official-chart review. */
export const SUPPLEMENTAL_ARTISTS: SupplementalArtist[] = [
  { artistKey: "aleman", artistName: "Alemán", spotifyArtistId: "4QFG9KrGWEbr6hNA58CAqE", genre: "Hip-Hop", subgenre: "hip-hop" },
  { artistKey: "caifanes", artistName: "Caifanes", spotifyArtistId: "1GImnM7WYVp95431ypofy9", genre: "Rock", subgenre: "rock mexicano", kworbYoutube: true },
  { artistKey: "camilafernandez", artistName: "Camila Fernández", spotifyArtistId: "52Y9UQWlCoArmqJVFwaR2Q", genre: "Regional Mexicano", subgenre: "mariachi" },
  { artistKey: "5050 flow malandro", artistName: "5050 Flow Malandro", spotifyArtistId: "77XFXNr9l7yMoIhzCRK9Ta", genre: "Hip-Hop", subgenre: "hip-hop", kworbItunes: true },
  { artistKey: "caztro", artistName: "Caztro", spotifyArtistId: "1YvkzmaJLVRHSJ8J5YzoaW", genre: "Pop", subgenre: "pop" },
  { artistKey: "charles ans", artistName: "Charles Ans", spotifyArtistId: "5lYeiQxUTcGKVgAuTqbTeL", genre: "Hip-Hop", subgenre: "hip-hop", kworbItunes: true },
  { artistKey: "contacto norte", artistName: "Contacto Norte", spotifyArtistId: "5yMyvfg5YKQGx4EpUrcZbU", genre: "Regional Mexicano", subgenre: "norteño" },
  { artistKey: "cornelio vega", artistName: "Cornelio Vega", spotifyArtistId: "3xNhaqwvNIAP57dWgMTP1d", genre: "Regional Mexicano", subgenre: "regional mexicano" },
  { artistKey: "cri-cri", artistName: "Cri-Cri", spotifyArtistId: "4vM6clYXqkZbQv4O2OT5P4", genre: "Infantil", subgenre: "infantil", kworbItunes: true },
  { artistKey: "cuisillos de arturo macias", artistName: "Cuisillos De Arturo Macias", spotifyArtistId: "32lXHXuhXtdA2j3IDXNND4", genre: "Regional Mexicano", subgenre: "banda" },
  { artistKey: "daaz", artistName: "DAAZ", spotifyArtistId: "3EmNguRllf32GJRqIKnD0C", genre: "Hip-Hop", subgenre: "hip-hop" },
  { artistKey: "dani flow", artistName: "Dani Flow", spotifyArtistId: "1yX62RHdYysNcIrO33WQxJ", genre: "Urbano", subgenre: "reggaetón", kworbItunes: true },
  { artistKey: "dj aza", artistName: "Dj Aza", spotifyArtistId: "2qsETcaDdvTRTaL3nU4zNK", genre: "Urbano", subgenre: "reggaetón" },
  { artistKey: "duelo", artistName: "Duelo", spotifyArtistId: "0nnp7oJpY2J6yZOqtdKaWq", genre: "Regional Mexicano", subgenre: "norteño" },
  { artistKey: "edwin luna", artistName: "Edwin Luna", spotifyArtistId: "10tyI6ROBsJJ6lBi3m5iph", genre: "Regional Mexicano", subgenre: "banda" },
  { artistKey: "el coyote", artistName: "El Coyote", spotifyArtistId: "7sQ3Q6yYyg0SdpEezJN8UT", genre: "Regional Mexicano", subgenre: "banda" },
  { artistKey: "el malilla", artistName: "El Malilla", spotifyArtistId: "6BV37tKh6pY97mnNdTCzly", genre: "Urbano", subgenre: "reggaetón" },
  { artistKey: "gala montes", artistName: "Gala Montes", spotifyArtistId: "0qcbuRzAu4q1oHX66qFlPJ", genre: "Pop", subgenre: "pop", kworbItunes: true },
  { artistKey: "gera mx", artistName: "Gera MX", spotifyArtistId: "2hejA1Dkf8v8R0koF44FvW", genre: "Hip-Hop", subgenre: "hip-hop", kworbYoutube: true },
  { artistKey: "gaelvalenzuela", artistName: "Gael Valenzuela", spotifyArtistId: "5mo9Z7aGxbLG7gVYajpCar", genre: "Regional Mexicano", subgenre: "corridos tumbados", kworbYoutube: true },
  { artistKey: "grupo canaveral de humberto pabon", artistName: "Grupo Cañaveral De Humberto Pabón", spotifyArtistId: "48zixAu4wMDZwpVbOenDU7", genre: "Cumbia", subgenre: "cumbia" },
  { artistKey: "grupo quintanna", artistName: "Grupo Quintanna", spotifyArtistId: "17jlmfAaFHbfrauHk2HiNc", genre: "Regional Mexicano", subgenre: "regional mexicano" },
  { artistKey: "joy", artistName: "Joy", spotifyArtistId: "6iH6aIbOCOdO3Ja6JeyOm1", genre: "Pop", subgenre: "pop" },
  { artistKey: "josean log", artistName: "Jósean Log", spotifyArtistId: "1LMyTeRhjaitILs98h3MaF", genre: "Alternativo", subgenre: "indie pop", kworbItunes: true },
  { artistKey: "la arrolladora banda el limon de rene camacho", artistName: "La Arrolladora Banda El Limón De René Camacho", spotifyArtistId: "5bSfBBCxY8QAk4Pifveisz", genre: "Regional Mexicano", subgenre: "banda" },
  { artistKey: "latinmafia", artistName: "LATIN MAFIA", spotifyArtistId: "6XTGKOV9jceQ6f67lnhpbF", genre: "Alternativo", subgenre: "alternativo" },
  { artistKey: "la rondalla de saltillo", artistName: "La Rondalla De Saltillo", spotifyArtistId: "65wmIidwFZCCoT1BUewp5P", genre: "Balada", subgenre: "rondalla", kworbItunes: true },
  { artistKey: "la trakalosa de monterrey", artistName: "La Trakalosa de Monterrey", spotifyArtistId: "4LFOoXhMhnq9U8VsZkSwxl", genre: "Regional Mexicano", subgenre: "banda", kworbYoutube: true },
  { artistKey: "luis alfonso partida el yaki", artistName: "Luis Alfonso Partida El Yaki", spotifyArtistId: "5l6N2hoIaP7snXdjnCULvk", genre: "Regional Mexicano", subgenre: "banda" },
  { artistKey: "makabelico", artistName: "Makabelico", spotifyArtistId: "0rJ0xlAQI0wLRucDRoQQbO", genre: "Hip-Hop", subgenre: "hip-hop", kworbYoutube: true },
  { artistKey: "millonario", artistName: "Millonario", spotifyArtistId: "2N2aJ1SXQxMkhHD8C6fhYD", genre: "Hip-Hop", subgenre: "hip-hop" },
  { artistKey: "omarcamacho", artistName: "Omar Camacho", spotifyArtistId: "0rUu2qzqezBrCddX1RuUyJ", genre: "Hip-Hop", subgenre: "hip-hop", kworbYoutube: true },
  { artistKey: "pedrito fernandez", artistName: "Pedrito Fernández", spotifyArtistId: "24dYJ8P3YuFihvMcElFUWh", genre: "Regional Mexicano", subgenre: "mariachi" },
  { artistKey: "pequenos musical", artistName: "Pequeños Musical", spotifyArtistId: "46WT0eTBzCslHoVsLahvfE", genre: "Regional Mexicano", subgenre: "banda" },
  { artistKey: "sabino", artistName: "Sabino", spotifyArtistId: "0zgFL90nGTrH2iOMD8Vysy", genre: "Hip-Hop", subgenre: "hip-hop" },
  { artistKey: "elrabbanito", artistName: "El Rabbanito", spotifyArtistId: "4VPLEp6rYxqpf6n0QEkS5z", genre: "Regional Mexicano", subgenre: "corridos", kworbYoutube: true },
  { artistKey: "herenciadegrandes", artistName: "Herencia De Grandes", spotifyArtistId: "0ocHleb3SllGNQQcDH35Xz", genre: "Regional Mexicano", subgenre: "corridos", kworbYoutube: true },
  { artistKey: "yubeili", artistName: "Yubeili", spotifyArtistId: "4Fsv1gBjfqSyhzAPbhInXV", genre: "Urbano", subgenre: "hip-hop", kworbItunes: true },
  { artistKey: "zoe", artistName: "Zoé", spotifyArtistId: "6IdtcAwaNVAggwd6sCKgTI", genre: "Rock", subgenre: "rock alternativo" },
];

export function supplementalMetadataRows(): Record<string, string>[] {
  return SUPPLEMENTAL_ARTISTS.map(artist => ({
    artist_key: artist.artistKey,
    artist_name: artist.artistName,
    source_country: "Mexico",
    genre: artist.genre,
    subgenre: artist.subgenre,
    eligibility_type: "approved",
    eligibility_reason: "Verified Mexican artist from official-chart review",
  }));
}

export function mergeSupplementalMetadata(rows: Record<string, string>[]) {
  const existing = new Set(rows.map(row => (row.artist_key || row.artist_name || "").trim().toLowerCase()));
  return [...rows, ...supplementalMetadataRows().filter(row => !existing.has(row.artist_key))];
}
