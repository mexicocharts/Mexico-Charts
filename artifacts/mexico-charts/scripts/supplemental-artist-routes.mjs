const names = [
  "5050 Flow Malandro", "Caztro", "Charles Ans", "Contacto Norte", "Cornelio Vega", "Cri-Cri",
  "Cuisillos De Arturo Macias", "DAAZ", "Dani Flow", "Dj Aza", "Duelo", "Edwin Luna",
  "El Coyote", "El Malilla", "Gala Montes", "Gera MX", "Grupo Cañaveral De Humberto Pabón",
  "Grupo Quintanna", "Joy", "Jósean Log", "La Arrolladora Banda El Limón De René Camacho",
  "La Rondalla De Saltillo", "La Trakalosa de Monterrey", "Luis Alfonso Partida El Yaki",
  "Makabelico", "Millonario", "Pedrito Fernández", "Pequeños Musical", "Sabino", "Yubeili",
];

const slugify = value => value
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const supplementalArtistRoutes = names.map(name => ({
  path: `/artist/${slugify(name)}`,
  name,
  context: "streaming, YouTube, Spotify, Kworb, charts y datos de artista",
}));
