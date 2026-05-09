import { Router } from "express";

const router = Router();

const ARTIST_IMAGES: Record<string, string> = {
  "Peso Pluma":         "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174e5283f5b671cf618b82a2696",
  "Fuerza Regida":      "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174ce436c411ab2436c7ab2c04d",
  "Natanael Cano":      "https://image-cdn-fa.spotifycdn.com/image/ab676161000051740d4838ef7ef6c0f889266f60",
  "Junior H":           "https://image-cdn-fa.spotifycdn.com/image/ab676161000051745fbe9b7dc7d9a2295bd6022c",
  "Carin León":         "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517469543997b9f68a0d2bb37a4a",
  "Grupo Frontera":     "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174b8bb50dc787d5893156689f6",
  "Luis R Conriquez":   "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174616b1d17ef24f784e60d99af",
  "Xavi":               "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174d024eb5ee433a89b19d54c2a",
  "Eslabon Armado":     "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174efb9255bbd0acdcd6a32accb",
  "Gabito Ballesteros": "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174a9e1da6d545e2f5b05878d31",
  "Tito Double P":      "https://image-cdn-fa.spotifycdn.com/image/ab676161000051746aaf8a0d393605e8489447f3",
  "Oscar Maydon":       "https://image-cdn-fa.spotifycdn.com/image/ab676161000051743dd468a8fb2641286c5b02a6",
  "Clave Especial":     "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174c8f9f4334a8583d976aeff0d",
  "Jasiel Nuñez":       "https://image-cdn-ak.spotifycdn.com/image/ab676161000051740476bece9f63717f55c976f1",
  "Yng Lvcas":          "https://image-cdn-fa.spotifycdn.com/image/ab67616100005174442355e50167bc26afa179ac",
  "Santa Fe Klan":      "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174cc8e116e76c85e1880d9889f",
  "Marca MP":           "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517431b1b084ec2994040aec37d0",
  "Grupo Firme":        "https://image-cdn-ak.spotifycdn.com/image/ab676161000051747ab0eb0c8b52f4639b167363",
};

router.get("/spotify/artist-images", (req, res) => {
  const namesParam = req.query.names as string;
  if (!namesParam?.trim()) {
    res.status(400).json({ error: "names query parameter is required" });
    return;
  }

  const names = namesParam.split(",").map((n) => n.trim()).filter(Boolean);
  const results: Record<string, string | null> = {};
  for (const name of names) {
    results[name] = ARTIST_IMAGES[name] ?? null;
  }

  res.json(results);
});

export default router;
