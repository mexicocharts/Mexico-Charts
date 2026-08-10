export interface MonitoringCatalogTrack {
  id: string | null;
  title: string;
  spotifyUrl: string | null;
  coverUrl: string | null;
  streams: number;
  daily: number;
}

export interface MonitoringCatalogAlbum extends MonitoringCatalogTrack {
  compilation: boolean;
}

export const LUIS_MIGUEL_CATALOG_UPDATED = "2026-08-08";
export const LUIS_MIGUEL_TRACKS: MonitoringCatalogTrack[] = [
  {
    "id": "1uKjQoh8JZj9ryuYRhpd7E",
    "title": "Ahora Te Puedes Marchar",
    "spotifyUrl": "https://open.spotify.com/track/1uKjQoh8JZj9ryuYRhpd7E",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 1020167149,
    "daily": 484872
  },
  {
    "id": "6F9yAYUaNbUhdlQyt5uZ3b",
    "title": "La Incondicional",
    "spotifyUrl": "https://open.spotify.com/track/6F9yAYUaNbUhdlQyt5uZ3b",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 823136213,
    "daily": 372685
  },
  {
    "id": "6vPAmoERUMRoTZaCCSWQ12",
    "title": "Hasta Que Me Olvides",
    "spotifyUrl": "https://open.spotify.com/track/6vPAmoERUMRoTZaCCSWQ12",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 666003757,
    "daily": 298875
  },
  {
    "id": "1lKI9y1DL6QnYTZguVmACX",
    "title": "La Media Vuelta",
    "spotifyUrl": "https://open.spotify.com/track/1lKI9y1DL6QnYTZguVmACX",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 632875444,
    "daily": 281722
  },
  {
    "id": "7BwxbmYFy0l3ROHDjV2c14",
    "title": "Culpable O No - Miénteme Como Siempre",
    "spotifyUrl": "https://open.spotify.com/track/7BwxbmYFy0l3ROHDjV2c14",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 580154077,
    "daily": 309760
  },
  {
    "id": "4FqfHVML025cwjfhAOFbfa",
    "title": "Por Debajo De La Mesa",
    "spotifyUrl": "https://open.spotify.com/track/4FqfHVML025cwjfhAOFbfa",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 499410916,
    "daily": 190644
  },
  {
    "id": "27XboT5Wb8VOn7A0heo3Ei",
    "title": "Tengo Todo Excepto a Ti",
    "spotifyUrl": "https://open.spotify.com/track/27XboT5Wb8VOn7A0heo3Ei",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 434758297,
    "daily": 214864
  },
  {
    "id": "2DAsLftcRKP3iarCPmI1RY",
    "title": "No Sé Tú",
    "spotifyUrl": "https://open.spotify.com/track/2DAsLftcRKP3iarCPmI1RY",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 409710334,
    "daily": 156351
  },
  {
    "id": "5fj3zNkXfOlrJGVcZBId6D",
    "title": "Entrégate",
    "spotifyUrl": "https://open.spotify.com/track/5fj3zNkXfOlrJGVcZBId6D",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 357993999,
    "daily": 193494
  },
  {
    "id": "68zSzKkU28AfZvr5FkAUWT",
    "title": "Sabor a Mi",
    "spotifyUrl": "https://open.spotify.com/track/68zSzKkU28AfZvr5FkAUWT",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 351998050,
    "daily": 162863
  },
  {
    "id": "21Ullb4TU8qMsQd0Iselng",
    "title": "Sabes Una Cosa",
    "spotifyUrl": "https://open.spotify.com/track/21Ullb4TU8qMsQd0Iselng",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 323563006,
    "daily": 174342
  },
  {
    "id": "1L2TRAA6QJAZTfjDTNQfrP",
    "title": "La Chica Del Bikini Azul",
    "spotifyUrl": "https://open.spotify.com/track/1L2TRAA6QJAZTfjDTNQfrP",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 311152824,
    "daily": 164629
  },
  {
    "id": "4p7XH4NhQ25iGYrrbg93gt",
    "title": "Suave",
    "spotifyUrl": "https://open.spotify.com/track/4p7XH4NhQ25iGYrrbg93gt",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 296388289,
    "daily": 101950
  },
  {
    "id": "3hVaK0zn3sVWWY8TvN1Te5",
    "title": "Cuando Calienta El Sol",
    "spotifyUrl": "https://open.spotify.com/track/3hVaK0zn3sVWWY8TvN1Te5",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 294566465,
    "daily": 91406
  },
  {
    "id": "2J4qy8RyfwgXHt73cWOE6P",
    "title": "Fría Como El Viento",
    "spotifyUrl": "https://open.spotify.com/track/2J4qy8RyfwgXHt73cWOE6P",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 292679898,
    "daily": 156145
  },
  {
    "id": "7nAvryV9PVCt9PQGPx7I0z",
    "title": "Si Nos Dejan - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/7nAvryV9PVCt9PQGPx7I0z",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 258486382,
    "daily": 88520
  },
  {
    "id": "3wogsSWyEEu5eVgLqUqySF",
    "title": "La Mentira",
    "spotifyUrl": "https://open.spotify.com/track/3wogsSWyEEu5eVgLqUqySF",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 258277780,
    "daily": 263873
  },
  {
    "id": "1jxO9AwMqYynDsuMWKrPvi",
    "title": "La bikina - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/1jxO9AwMqYynDsuMWKrPvi",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 240535817,
    "daily": 84061
  },
  {
    "id": "2TOBMDqbtPP6sAQtWc2Br9",
    "title": "Échame a Mi La Culpa",
    "spotifyUrl": "https://open.spotify.com/track/2TOBMDqbtPP6sAQtWc2Br9",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 228163160,
    "daily": 158067
  },
  {
    "id": "0MHSnVk2CrGP8hIkxpxwMJ",
    "title": "Usted",
    "spotifyUrl": "https://open.spotify.com/track/0MHSnVk2CrGP8hIkxpxwMJ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 223205577,
    "daily": 108308
  },
  {
    "id": "4lQWZGUrquRfH9se6nlmp3",
    "title": "Amarte es un placer",
    "spotifyUrl": "https://open.spotify.com/track/4lQWZGUrquRfH9se6nlmp3",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 222254514,
    "daily": 118172
  },
  {
    "id": "0svWUjefj6RBlIQxA3VCvx",
    "title": "Te necesito",
    "spotifyUrl": "https://open.spotify.com/track/0svWUjefj6RBlIQxA3VCvx",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 221944771,
    "daily": 88689
  },
  {
    "id": "3ZRUhvuUE2lwZF19puKM8P",
    "title": "Un Hombre Busca a Una Mujer",
    "spotifyUrl": "https://open.spotify.com/track/3ZRUhvuUE2lwZF19puKM8P",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 204848533,
    "daily": 64022
  },
  {
    "id": "0o3maQdATX6bEnDxZZKXFf",
    "title": "Si tú te atreves",
    "spotifyUrl": "https://open.spotify.com/track/0o3maQdATX6bEnDxZZKXFf",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 204184850,
    "daily": 128756
  },
  {
    "id": "2pSZjEpbXwlocV8js7MNmu",
    "title": "Inolvidable",
    "spotifyUrl": "https://open.spotify.com/track/2pSZjEpbXwlocV8js7MNmu",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 196340482,
    "daily": 93490
  },
  {
    "id": "5SPUsNcUtRUpAPj7rJq7CD",
    "title": "La Gloria Eres Tu",
    "spotifyUrl": "https://open.spotify.com/track/5SPUsNcUtRUpAPj7rJq7CD",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 192893392,
    "daily": 110436
  },
  {
    "id": "2MkeDQiyZ8MV45IjLhCPSF",
    "title": "La Barca",
    "spotifyUrl": "https://open.spotify.com/track/2MkeDQiyZ8MV45IjLhCPSF",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 190236094,
    "daily": 77890
  },
  {
    "id": "6BTte0lvV5phb00xaxseC4",
    "title": "El Reloj",
    "spotifyUrl": "https://open.spotify.com/track/6BTte0lvV5phb00xaxseC4",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 179747181,
    "daily": 69859
  },
  {
    "id": "3WYYTKGbtX2x4fYwSW7Ugl",
    "title": "Palabra De Honor",
    "spotifyUrl": "https://open.spotify.com/track/3WYYTKGbtX2x4fYwSW7Ugl",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 177179623,
    "daily": 60645
  },
  {
    "id": "1kS5xIvvytkr5Ut1JkQ9SM",
    "title": "No Me Platiques Más",
    "spotifyUrl": "https://open.spotify.com/track/1kS5xIvvytkr5Ut1JkQ9SM",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 164564356,
    "daily": 55444
  },
  {
    "id": "7u5wdRqlAC4qeRp47e7hce",
    "title": "O Tu O Ninguna",
    "spotifyUrl": "https://open.spotify.com/track/7u5wdRqlAC4qeRp47e7hce",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 162331364,
    "daily": 61006
  },
  {
    "id": "5BPq1UQa1NSN647R6IzD3n",
    "title": "México En La Piel",
    "spotifyUrl": "https://open.spotify.com/track/5BPq1UQa1NSN647R6IzD3n",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 155621676,
    "daily": 42485
  },
  {
    "id": "6JEgMLyMEqFTaoQyMg4vhQ",
    "title": "Llamarada",
    "spotifyUrl": "https://open.spotify.com/track/6JEgMLyMEqFTaoQyMg4vhQ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 144397323,
    "daily": 49784
  },
  {
    "id": "6av3uLAacGG7c9fjshWmuH",
    "title": "Historia De Un Amor",
    "spotifyUrl": "https://open.spotify.com/track/6av3uLAacGG7c9fjshWmuH",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 137786113,
    "daily": 77535
  },
  {
    "id": "3NKIbFFAioTfznWbnjAMXX",
    "title": "El Día Que Me Quieras",
    "spotifyUrl": "https://open.spotify.com/track/3NKIbFFAioTfznWbnjAMXX",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 135381941,
    "daily": 43405
  },
  {
    "id": "1uSRXFGgEkukRZIa9WsX52",
    "title": "Te Extraño",
    "spotifyUrl": "https://open.spotify.com/track/1uSRXFGgEkukRZIa9WsX52",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 133235711,
    "daily": 43322
  },
  {
    "id": "3zceb1fYe5jdwEmuGvJINO",
    "title": "Soy lo prohibido",
    "spotifyUrl": "https://open.spotify.com/track/3zceb1fYe5jdwEmuGvJINO",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 124493854,
    "daily": 49576
  },
  {
    "id": "6QbEENozheS46xQY56acH9",
    "title": "Y - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/6QbEENozheS46xQY56acH9",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 122686575,
    "daily": 43890
  },
  {
    "id": "03oCjV73Utu9KpXrgcqoTJ",
    "title": "Contigo En La Distancia",
    "spotifyUrl": "https://open.spotify.com/track/03oCjV73Utu9KpXrgcqoTJ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 117698440,
    "daily": 42774
  },
  {
    "id": "2PZtKB8fDoDGLot27oUnWH",
    "title": "Oro De Ley",
    "spotifyUrl": "https://open.spotify.com/track/2PZtKB8fDoDGLot27oUnWH",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 112132469,
    "daily": 70263
  },
  {
    "id": "5C1HYHG6b1wk9MpC2UP9C6",
    "title": "Mucho Corazón",
    "spotifyUrl": "https://open.spotify.com/track/5C1HYHG6b1wk9MpC2UP9C6",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 112032632,
    "daily": 88583
  },
  {
    "id": "1FJSXlDrgr9AS37w67CPHP",
    "title": "Todo Y Nada",
    "spotifyUrl": "https://open.spotify.com/track/1FJSXlDrgr9AS37w67CPHP",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 110972637,
    "daily": 53284
  },
  {
    "id": "4dr2h9rnEW6OBxm8LvRBW2",
    "title": "Somos Novios",
    "spotifyUrl": "https://open.spotify.com/track/4dr2h9rnEW6OBxm8LvRBW2",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 110734578,
    "daily": 27585
  },
  {
    "id": "4yEJ1SNpgfK5GPx3Y0YhIU",
    "title": "Motivos",
    "spotifyUrl": "https://open.spotify.com/track/4yEJ1SNpgfK5GPx3Y0YhIU",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 109436123,
    "daily": 51760
  },
  {
    "id": "4BCiucu42W0U9Y1eqPaQDx",
    "title": "Voy a Apagar La Luz / Contigo Aprendí",
    "spotifyUrl": "https://open.spotify.com/track/4BCiucu42W0U9Y1eqPaQDx",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 107690727,
    "daily": 57006
  },
  {
    "id": "0j0ntQup1Wp9ZiQTUvgnhm",
    "title": "De Qué Manera Te Olvido",
    "spotifyUrl": "https://open.spotify.com/track/0j0ntQup1Wp9ZiQTUvgnhm",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 101675034,
    "daily": 43930
  },
  {
    "id": "3llKUN9le04V1enu8MHudF",
    "title": "Besame Mucho",
    "spotifyUrl": "https://open.spotify.com/track/3llKUN9le04V1enu8MHudF",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 97759676,
    "daily": 35705
  },
  {
    "id": "5SnH7xubfdfvHomShSjiIe",
    "title": "Yo Que No Vivo Sin Ti",
    "spotifyUrl": "https://open.spotify.com/track/5SnH7xubfdfvHomShSjiIe",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 96779769,
    "daily": 50782
  },
  {
    "id": "1TYSbLYd5rqTt7FRva9tgM",
    "title": "No Me Puedes Dejar Asi",
    "spotifyUrl": "https://open.spotify.com/track/1TYSbLYd5rqTt7FRva9tgM",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 91551869,
    "daily": 31018
  },
  {
    "id": "382nUV9KxDHdqQXVDeWNU1",
    "title": "Isabel",
    "spotifyUrl": "https://open.spotify.com/track/382nUV9KxDHdqQXVDeWNU1",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d61f0f4818e3733a8390fc8",
    "streams": 87317950,
    "daily": 26783
  },
  {
    "id": "2ZYvD9zQf1iBLelkgkUl7U",
    "title": "Hoy El Aire Huele a Ti",
    "spotifyUrl": "https://open.spotify.com/track/2ZYvD9zQf1iBLelkgkUl7U",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 86506538,
    "daily": 71639
  },
  {
    "id": "0IrKbfhVKW0xpPEzRDeSUb",
    "title": "Santa Claus Llegó a La Ciudad",
    "spotifyUrl": "https://open.spotify.com/track/0IrKbfhVKW0xpPEzRDeSUb",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 83117292,
    "daily": 4772
  },
  {
    "id": "6hqPglC6X5ZAHtVH4DPb28",
    "title": "Decidete",
    "spotifyUrl": "https://open.spotify.com/track/6hqPglC6X5ZAHtVH4DPb28",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 81095422,
    "daily": 29335
  },
  {
    "id": "6LBnaXnvXFwn1PgLmpxTXM",
    "title": "Será Que No Me Amas - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/6LBnaXnvXFwn1PgLmpxTXM",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 80670406,
    "daily": 8320
  },
  {
    "id": "0ULXIAoxSZBcOwygC3PA0i",
    "title": "Será Que No Me Amas (Blame It on the Boogie)",
    "spotifyUrl": "https://open.spotify.com/track/0ULXIAoxSZBcOwygC3PA0i",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 76473083,
    "daily": 55503
  },
  {
    "id": "4LOoLsXcPdAHzPwSznpq3Y",
    "title": "No discutamos",
    "spotifyUrl": "https://open.spotify.com/track/4LOoLsXcPdAHzPwSznpq3Y",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 74344432,
    "daily": 26910
  },
  {
    "id": "4yakD6EKEjeMezENNCSlcc",
    "title": "Qué Nivel De Mujer",
    "spotifyUrl": "https://open.spotify.com/track/4yakD6EKEjeMezENNCSlcc",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 70359648,
    "daily": 16629
  },
  {
    "id": "4uP2EipoPEAq3InMMCQMG9",
    "title": "Como Yo Te Amé",
    "spotifyUrl": "https://open.spotify.com/track/4uP2EipoPEAq3InMMCQMG9",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 69205919,
    "daily": 37509
  },
  {
    "id": "27P0i2SUqaZaUvHRGnwm9d",
    "title": "1+1=2 Enamorados",
    "spotifyUrl": "https://open.spotify.com/track/27P0i2SUqaZaUvHRGnwm9d",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d61f0f4818e3733a8390fc8",
    "streams": 68564889,
    "daily": 37382
  },
  {
    "id": "2inyRCfWB1ey6vNX43TTCl",
    "title": "Cómo duele",
    "spotifyUrl": "https://open.spotify.com/track/2inyRCfWB1ey6vNX43TTCl",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 68535525,
    "daily": 55956
  },
  {
    "id": "6AOt2y4PzYgiUapxCIrbfV",
    "title": "Que Seas Feliz",
    "spotifyUrl": "https://open.spotify.com/track/6AOt2y4PzYgiUapxCIrbfV",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 65538348,
    "daily": 20714
  },
  {
    "id": "3PoR4LhD7Y74bPpk8lZ6f7",
    "title": "Ayer",
    "spotifyUrl": "https://open.spotify.com/track/3PoR4LhD7Y74bPpk8lZ6f7",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 63883958,
    "daily": 32349
  },
  {
    "id": "6z2gdbLv44WxTfpsnvoPLI",
    "title": "Cielo Rojo",
    "spotifyUrl": "https://open.spotify.com/track/6z2gdbLv44WxTfpsnvoPLI",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 63287994,
    "daily": 25467
  },
  {
    "id": "7wTljp825aJ1bgJ8yakPcr",
    "title": "Devuélveme El Amor",
    "spotifyUrl": "https://open.spotify.com/track/7wTljp825aJ1bgJ8yakPcr",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 57398654,
    "daily": 71866
  },
  {
    "id": "5dlNzEPBCM7HgmhfaK0xph",
    "title": "La Puerta",
    "spotifyUrl": "https://open.spotify.com/track/5dlNzEPBCM7HgmhfaK0xph",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 57338164,
    "daily": 25330
  },
  {
    "id": "1k4GYtmW7edpJ9uhQmzO66",
    "title": "Amor (Amor, amor, amor)",
    "spotifyUrl": "https://open.spotify.com/track/1k4GYtmW7edpJ9uhQmzO66",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 56843689,
    "daily": 22596
  },
  {
    "id": "6tiY3rQJZ8m1SYDm2h6bJJ",
    "title": "La fiesta del mariachi",
    "spotifyUrl": "https://open.spotify.com/track/6tiY3rQJZ8m1SYDm2h6bJJ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 56745679,
    "daily": 9696
  },
  {
    "id": "683fOEDnFrDuFM9oMpuEhK",
    "title": "Navidad, Navidad",
    "spotifyUrl": "https://open.spotify.com/track/683fOEDnFrDuFM9oMpuEhK",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 56445276,
    "daily": 1475
  },
  {
    "id": "3XNKgHcTo3JyWjOdb540Te",
    "title": "Cómo Es Posible Que a Mi Lado",
    "spotifyUrl": "https://open.spotify.com/track/3XNKgHcTo3JyWjOdb540Te",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 55224538,
    "daily": 24869
  },
  {
    "id": "7e3mCGbRFSsYmnGuQf9rMk",
    "title": "Sueña",
    "spotifyUrl": "https://open.spotify.com/track/7e3mCGbRFSsYmnGuQf9rMk",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 54589817,
    "daily": 22675
  },
  {
    "id": "3pJlTmnEjkf1u9Bualfo8X",
    "title": "Sol, arena y mar",
    "spotifyUrl": "https://open.spotify.com/track/3pJlTmnEjkf1u9Bualfo8X",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 53952490,
    "daily": 14883
  },
  {
    "id": "4mu9UDULgYFQfWQFx5fkKM",
    "title": "Dame",
    "spotifyUrl": "https://open.spotify.com/track/4mu9UDULgYFQfWQFx5fkKM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 52894381,
    "daily": 30392
  },
  {
    "id": "2rL3yI7v4R3EKdK0shizrZ",
    "title": "Esa Niña",
    "spotifyUrl": "https://open.spotify.com/track/2rL3yI7v4R3EKdK0shizrZ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 52298887,
    "daily": 22280
  },
  {
    "id": "7CbgafOaqArpdlZVlTpNeA",
    "title": "Más Allá De Todo",
    "spotifyUrl": "https://open.spotify.com/track/7CbgafOaqArpdlZVlTpNeA",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 51703378,
    "daily": 45508
  },
  {
    "id": "0pWAOLzD2VencHdiDnmRos",
    "title": "Cómo",
    "spotifyUrl": "https://open.spotify.com/track/0pWAOLzD2VencHdiDnmRos",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 50647822,
    "daily": 29822
  },
  {
    "id": "2iM66WDc3xPT079WNX4aQ3",
    "title": "Contigo - Estar Contigo",
    "spotifyUrl": "https://open.spotify.com/track/2iM66WDc3xPT079WNX4aQ3",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 50599762,
    "daily": 24587
  },
  {
    "id": "2lM5nIWUkVr794kLZGtHUC",
    "title": "Encadenados",
    "spotifyUrl": "https://open.spotify.com/track/2lM5nIWUkVr794kLZGtHUC",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 48753140,
    "daily": 31915
  },
  {
    "id": "4MAUqdDvCTMS9ZiB5DB6UK",
    "title": "Por Favor Señora",
    "spotifyUrl": "https://open.spotify.com/track/4MAUqdDvCTMS9ZiB5DB6UK",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 47746469,
    "daily": 27729
  },
  {
    "id": "3dsvRFQ7YWkNBH8GTPwf7Q",
    "title": "Cuando Vuelva a Tu Lado",
    "spotifyUrl": "https://open.spotify.com/track/3dsvRFQ7YWkNBH8GTPwf7Q",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 45384640,
    "daily": 21330
  },
  {
    "id": "4jcCh4sq5crnjj68GUOEda",
    "title": "¿Por qué te conocí?",
    "spotifyUrl": "https://open.spotify.com/track/4jcCh4sq5crnjj68GUOEda",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 45380304,
    "daily": 15910
  },
  {
    "id": "5Hq7nD5Ro0rsxlVZHGR62H",
    "title": "Perfidia",
    "spotifyUrl": "https://open.spotify.com/track/5Hq7nD5Ro0rsxlVZHGR62H",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a0802158779f2ebb8c4e45bf",
    "streams": 44692187,
    "daily": 12776
  },
  {
    "id": "2y3C3tWoNictZWuOuUtDuO",
    "title": "Serenata huasteca",
    "spotifyUrl": "https://open.spotify.com/track/2y3C3tWoNictZWuOuUtDuO",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 43848188,
    "daily": 18722
  },
  {
    "id": "5stIIDoqTCHP69BKGdbSEg",
    "title": "Entrega Total",
    "spotifyUrl": "https://open.spotify.com/track/5stIIDoqTCHP69BKGdbSEg",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 42197826,
    "daily": 20875
  },
  {
    "id": "2VbKzmGzbd2qjO0xw3WhKq",
    "title": "Medley (Yo Que No Vivo Sin Ti / Culpable O No / Más Allá De Todo / Fría Como El Viento / Entrégate",
    "spotifyUrl": "https://open.spotify.com/track/2VbKzmGzbd2qjO0xw3WhKq",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 41937876,
    "daily": 13696
  },
  {
    "id": "3HE0wPD30AjKMKtxNaKFQ4",
    "title": "Amante Del Amor",
    "spotifyUrl": "https://open.spotify.com/track/3HE0wPD30AjKMKtxNaKFQ4",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 40929238,
    "daily": 20842
  },
  {
    "id": "3bEcVhtVaWs664zpURqoWi",
    "title": "Nos hizo falta tiempo",
    "spotifyUrl": "https://open.spotify.com/track/3bEcVhtVaWs664zpURqoWi",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 38866967,
    "daily": 41291
  },
  {
    "id": "43U31uHEKbHdrvjIJuvkGa",
    "title": "Cruz De Olvido",
    "spotifyUrl": "https://open.spotify.com/track/43U31uHEKbHdrvjIJuvkGa",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 37602270,
    "daily": 19485
  },
  {
    "id": "4wwmsWGi6mMEqWx8leGFsO",
    "title": "Yo Se Que Volverás",
    "spotifyUrl": "https://open.spotify.com/track/4wwmsWGi6mMEqWx8leGFsO",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 36048010,
    "daily": 22258
  },
  {
    "id": "6xNBJuhCUv24pLdO28AdGc",
    "title": "Nosotros",
    "spotifyUrl": "https://open.spotify.com/track/6xNBJuhCUv24pLdO28AdGc",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 35733572,
    "daily": 16878
  },
  {
    "id": "4e3OPudelVSQQPP8SA76AS",
    "title": "Jurame",
    "spotifyUrl": "https://open.spotify.com/track/4e3OPudelVSQQPP8SA76AS",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 34048681,
    "daily": 13938
  },
  {
    "id": "0REKETXT8fkn2C863KKlO4",
    "title": "Dormir contigo",
    "spotifyUrl": "https://open.spotify.com/track/0REKETXT8fkn2C863KKlO4",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 33222243,
    "daily": 12854
  },
  {
    "id": "5fqTzpRmb1hzL0J5SD5H4b",
    "title": "Deja que salga la luna",
    "spotifyUrl": "https://open.spotify.com/track/5fqTzpRmb1hzL0J5SD5H4b",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 33191620,
    "daily": 17672
  },
  {
    "id": "77J6wE54qpAb2iGegfCVFu",
    "title": "Blanca Navidad",
    "spotifyUrl": "https://open.spotify.com/track/77J6wE54qpAb2iGegfCVFu",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 32682069,
    "daily": 1216
  },
  {
    "id": "0JsCnQ0xGg6zE7WZkBD9hA",
    "title": "Delirio",
    "spotifyUrl": "https://open.spotify.com/track/0JsCnQ0xGg6zE7WZkBD9hA",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 32546159,
    "daily": 13863
  },
  {
    "id": "5QEelAij2rdNm6WzYiw0wc",
    "title": "Tú Y Yo",
    "spotifyUrl": "https://open.spotify.com/track/5QEelAij2rdNm6WzYiw0wc",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 32272613,
    "daily": 17558
  },
  {
    "id": "70BcjMGYixgH1GKkLS40Jr",
    "title": "Solamente Una Vez",
    "spotifyUrl": "https://open.spotify.com/track/70BcjMGYixgH1GKkLS40Jr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 32132346,
    "daily": 11846
  },
  {
    "id": "098fCi4s5RXgbwufb9086i",
    "title": "Amanecer",
    "spotifyUrl": "https://open.spotify.com/track/098fCi4s5RXgbwufb9086i",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 31981137,
    "daily": 11649
  },
  {
    "id": "6Jiom35dhAYX6ohfwJkQEr",
    "title": "Sólo Tú (Only You)",
    "spotifyUrl": "https://open.spotify.com/track/6Jiom35dhAYX6ohfwJkQEr",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 31933771,
    "daily": 21283
  },
  {
    "id": "4tDY2UqYP370iZLJGYDvvz",
    "title": "Pensar En Ti",
    "spotifyUrl": "https://open.spotify.com/track/4tDY2UqYP370iZLJGYDvvz",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 29947142,
    "daily": 17781
  },
  {
    "id": "3td8WklPGKKDSuOHbyxRdD",
    "title": "Labios de miel",
    "spotifyUrl": "https://open.spotify.com/track/3td8WklPGKKDSuOHbyxRdD",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 29919586,
    "daily": 7277
  },
  {
    "id": "7ekLlhVAdxH6mRFoDlA1J3",
    "title": "Frente a La Chimenea",
    "spotifyUrl": "https://open.spotify.com/track/7ekLlhVAdxH6mRFoDlA1J3",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 29710776,
    "daily": 958
  },
  {
    "id": "7FaDBpQuCQxWL0nAYTg8n1",
    "title": "No me amenaces",
    "spotifyUrl": "https://open.spotify.com/track/7FaDBpQuCQxWL0nAYTg8n1",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 29563222,
    "daily": 7017
  },
  {
    "id": "4syvq0aJLeWu0UA9VYcgob",
    "title": "Alguien Como Tú",
    "spotifyUrl": "https://open.spotify.com/track/4syvq0aJLeWu0UA9VYcgob",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 29527355,
    "daily": 12122
  },
  {
    "id": "2ybospMFQiiopuI9P8WjfH",
    "title": "Un Mundo Raro",
    "spotifyUrl": "https://open.spotify.com/track/2ybospMFQiiopuI9P8WjfH",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 29012202,
    "daily": 16282
  },
  {
    "id": "7nQWIZIZ4W7ZKFbrF5R97L",
    "title": "Paloma Querida",
    "spotifyUrl": "https://open.spotify.com/track/7nQWIZIZ4W7ZKFbrF5R97L",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 28790234,
    "daily": 11006
  },
  {
    "id": "0byZkYj5d6UbeyK66tXLPr",
    "title": "El siete mares",
    "spotifyUrl": "https://open.spotify.com/track/0byZkYj5d6UbeyK66tXLPr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 28788552,
    "daily": 7873
  },
  {
    "id": "2kQtm92uUcTTIPN5smIxUl",
    "title": "Perdóname (All by Myself)",
    "spotifyUrl": "https://open.spotify.com/track/2kQtm92uUcTTIPN5smIxUl",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 28747182,
    "daily": 17184
  },
  {
    "id": "6u8aspWIv15rHqm1uuy1uW",
    "title": "Directo Al Corazon",
    "spotifyUrl": "https://open.spotify.com/track/6u8aspWIv15rHqm1uuy1uW",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 27710494,
    "daily": 12783
  },
  {
    "id": "7gQfSsnHaLcZLvr16L1fYw",
    "title": "Soy yo",
    "spotifyUrl": "https://open.spotify.com/track/7gQfSsnHaLcZLvr16L1fYw",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 27087319,
    "daily": 19333
  },
  {
    "id": "1PdgPj8tdE2OAhH40J4f4g",
    "title": "Cuestión De Piel",
    "spotifyUrl": "https://open.spotify.com/track/1PdgPj8tdE2OAhH40J4f4g",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 26890315,
    "daily": 14473
  },
  {
    "id": "4qb8QUWJCrW3hHuUcSSvmC",
    "title": "El Viajero",
    "spotifyUrl": "https://open.spotify.com/track/4qb8QUWJCrW3hHuUcSSvmC",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 26754909,
    "daily": 21061
  },
  {
    "id": "2wUyUpg8oOrvZ2MsEHph0m",
    "title": "Amaneci Entre Tus Brazos - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/2wUyUpg8oOrvZ2MsEHph0m",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 26733783,
    "daily": 6434
  },
  {
    "id": "6ejQdiWRgOUK0f7ws7K0Sf",
    "title": "El Balajú / Huapango",
    "spotifyUrl": "https://open.spotify.com/track/6ejQdiWRgOUK0f7ws7K0Sf",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 26553748,
    "daily": 6994
  },
  {
    "id": "1Ou6RRAWBpVQqkWDY3vFAR",
    "title": "Me Niego Estar Solo",
    "spotifyUrl": "https://open.spotify.com/track/1Ou6RRAWBpVQqkWDY3vFAR",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 26529985,
    "daily": 14193
  },
  {
    "id": "5MALTxghQ66hGWdl1lsGmB",
    "title": "Luz De Luna",
    "spotifyUrl": "https://open.spotify.com/track/5MALTxghQ66hGWdl1lsGmB",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 26118977,
    "daily": 11077
  },
  {
    "id": "0VYSH5t5gIXadaAhcufgPu",
    "title": "Soy Como Quiero Ser",
    "spotifyUrl": "https://open.spotify.com/track/0VYSH5t5gIXadaAhcufgPu",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 25568709,
    "daily": 8187
  },
  {
    "id": "0G8iM0Y7xbireCKILhmXAZ",
    "title": "Sin Ti",
    "spotifyUrl": "https://open.spotify.com/track/0G8iM0Y7xbireCKILhmXAZ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 24959448,
    "daily": 10399
  },
  {
    "id": "1JNYMz4hu58DkPLIt201Cv",
    "title": "Hasta Que Me Olvides - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/1JNYMz4hu58DkPLIt201Cv",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 24721428,
    "daily": 7613
  },
  {
    "id": "4W71wFr8KFDcscVr0lBL5f",
    "title": "De Quererte Así (De T'Avoir Aimee)",
    "spotifyUrl": "https://open.spotify.com/track/4W71wFr8KFDcscVr0lBL5f",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 23599030,
    "daily": 8787
  },
  {
    "id": "0FpYqjOx9Q4khUauXDrVtj",
    "title": "Luz Verde",
    "spotifyUrl": "https://open.spotify.com/track/0FpYqjOx9Q4khUauXDrVtj",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 23186971,
    "daily": 11627
  },
  {
    "id": "45f3AIqqnAhf6EDiFbYFcJ",
    "title": "Noche De Paz",
    "spotifyUrl": "https://open.spotify.com/track/45f3AIqqnAhf6EDiFbYFcJ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 22626075,
    "daily": 656
  },
  {
    "id": "43pYukeKAI6grsckHZs4wQ",
    "title": "Mañana De Carnaval (Manha Do Carnaval)",
    "spotifyUrl": "https://open.spotify.com/track/43pYukeKAI6grsckHZs4wQ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 22352807,
    "daily": 9972
  },
  {
    "id": "3uv0XgCPkTcOWGZJChstLJ",
    "title": "Noche De Ronda",
    "spotifyUrl": "https://open.spotify.com/track/3uv0XgCPkTcOWGZJChstLJ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 22272073,
    "daily": 10034
  },
  {
    "id": "2gxMq6bgexQ0H4kVNdYrP1",
    "title": "Que te vaya bonito",
    "spotifyUrl": "https://open.spotify.com/track/2gxMq6bgexQ0H4kVNdYrP1",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 22143988,
    "daily": 6086
  },
  {
    "id": "2P3RQbqU5xw1heCZSSVyL5",
    "title": "Llegó La Navidad",
    "spotifyUrl": "https://open.spotify.com/track/2P3RQbqU5xw1heCZSSVyL5",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 21698452,
    "daily": 778
  },
  {
    "id": "25N6ODLeaoXWwFAPp53lkD",
    "title": "Tú sólo tú",
    "spotifyUrl": "https://open.spotify.com/track/25N6ODLeaoXWwFAPp53lkD",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 21501523,
    "daily": 12114
  },
  {
    "id": "2UGczF0cRPqOszqJJIjC3M",
    "title": "Historia De Un Amor - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/2UGczF0cRPqOszqJJIjC3M",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 20874064,
    "daily": 3323
  },
  {
    "id": "3DHtkBwlskpqFY4xMnW1Tt",
    "title": "Uno",
    "spotifyUrl": "https://open.spotify.com/track/3DHtkBwlskpqFY4xMnW1Tt",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026a181913ea31219fed3a558b",
    "streams": 20549654,
    "daily": 8569
  },
  {
    "id": "1BkWs6sjxg239MVdm3xOFx",
    "title": "Separados",
    "spotifyUrl": "https://open.spotify.com/track/1BkWs6sjxg239MVdm3xOFx",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 20317326,
    "daily": 7979
  },
  {
    "id": "3Evfk0c7TBJY8TSDORcj24",
    "title": "Qué bonita es mi tierra",
    "spotifyUrl": "https://open.spotify.com/track/3Evfk0c7TBJY8TSDORcj24",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 20051398,
    "daily": 4551
  },
  {
    "id": "5Am8wx7Sgd0G6cj0URVjOM",
    "title": "Soy Un Perdedor",
    "spotifyUrl": "https://open.spotify.com/track/5Am8wx7Sgd0G6cj0URVjOM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 19858025,
    "daily": 10360
  },
  {
    "id": "3Msp0L57aoikzJfHXS44rf",
    "title": "Cómo es posible que a mi lado - Hex Hector Mix",
    "spotifyUrl": "https://open.spotify.com/track/3Msp0L57aoikzJfHXS44rf",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 19714239,
    "daily": 1830
  },
  {
    "id": "6MaaiqPz6nuaVVhDHKiWGa",
    "title": "Pupilas De Gato",
    "spotifyUrl": "https://open.spotify.com/track/6MaaiqPz6nuaVVhDHKiWGa",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 19154600,
    "daily": 9338
  },
  {
    "id": "5BrywDsYxdadc7hwsfdYon",
    "title": "Me Gustas Tal Como Eres",
    "spotifyUrl": "https://open.spotify.com/track/5BrywDsYxdadc7hwsfdYon",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 18983805,
    "daily": 7117
  },
  {
    "id": "0zkOAHCpiPZXuKtWGcFX2q",
    "title": "Sunny",
    "spotifyUrl": "https://open.spotify.com/track/0zkOAHCpiPZXuKtWGcFX2q",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 18673785,
    "daily": 13020
  },
  {
    "id": "1nMd4JxxVJBk4Y2hyCM1TZ",
    "title": "Va a Nevar",
    "spotifyUrl": "https://open.spotify.com/track/1nMd4JxxVJBk4Y2hyCM1TZ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 18146134,
    "daily": 426
  },
  {
    "id": "7KQJyqHkmOk6LTf9OtooYc",
    "title": "El Rey - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/7KQJyqHkmOk6LTf9OtooYc",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 18019763,
    "daily": 5856
  },
  {
    "id": "1KRaDU2NWnUN28Dj1wlnl8",
    "title": "Más",
    "spotifyUrl": "https://open.spotify.com/track/1KRaDU2NWnUN28Dj1wlnl8",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 17994042,
    "daily": 10482
  },
  {
    "id": "5CGoF0BhLnKEWYlb8kWKos",
    "title": "Come Fly With Me",
    "spotifyUrl": "https://open.spotify.com/track/5CGoF0BhLnKEWYlb8kWKos",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02062b0726843ce4aedc70162e",
    "streams": 17833565,
    "daily": 7694
  },
  {
    "id": "45fKgDxHS174490B3qruhx",
    "title": "Te Deseo Muy Felices Fiestas",
    "spotifyUrl": "https://open.spotify.com/track/45fKgDxHS174490B3qruhx",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 17769088,
    "daily": 571
  },
  {
    "id": "5sWknSnxsQm6a9sPR1SIbR",
    "title": "Te Desean",
    "spotifyUrl": "https://open.spotify.com/track/5sWknSnxsQm6a9sPR1SIbR",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 17726688,
    "daily": 7303
  },
  {
    "id": "4rhrcPM66V0nillQQdWyIW",
    "title": "Un te amo",
    "spotifyUrl": "https://open.spotify.com/track/4rhrcPM66V0nillQQdWyIW",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 17687236,
    "daily": 12632
  },
  {
    "id": "45DJcbNAgFI3sawnVtfFnV",
    "title": "Los Muchachos De Hoy",
    "spotifyUrl": "https://open.spotify.com/track/45DJcbNAgFI3sawnVtfFnV",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d61f0f4818e3733a8390fc8",
    "streams": 17104873,
    "daily": 3727
  },
  {
    "id": "5VsqHFSkrCk9oeXAF816aj",
    "title": "Sin sangre en las venas",
    "spotifyUrl": "https://open.spotify.com/track/5VsqHFSkrCk9oeXAF816aj",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 16753034,
    "daily": 4935
  },
  {
    "id": "5NCfrzPK3LwN37ruueafA3",
    "title": "Amorcito corazón",
    "spotifyUrl": "https://open.spotify.com/track/5NCfrzPK3LwN37ruueafA3",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 16189395,
    "daily": 8846
  },
  {
    "id": "6ZlNvrpcU9HiaSguS3t2OE",
    "title": "¿De quién es usted?",
    "spotifyUrl": "https://open.spotify.com/track/6ZlNvrpcU9HiaSguS3t2OE",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 16159853,
    "daily": 2476
  },
  {
    "id": "3x26LBxicCV5Y79T0Dcwte",
    "title": "Nada Es Igual",
    "spotifyUrl": "https://open.spotify.com/track/3x26LBxicCV5Y79T0Dcwte",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 16054407,
    "daily": 10230
  },
  {
    "id": "2fj0xfc4XtTAPqinYJHyZ8",
    "title": "Por un amor",
    "spotifyUrl": "https://open.spotify.com/track/2fj0xfc4XtTAPqinYJHyZ8",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 15742218,
    "daily": 8558
  },
  {
    "id": "4GtKQ7UelLgZAWydmXMnAk",
    "title": "Al que me siga",
    "spotifyUrl": "https://open.spotify.com/track/4GtKQ7UelLgZAWydmXMnAk",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 15723805,
    "daily": 6679
  },
  {
    "id": "5xBgNzopylKVTJnrFcKang",
    "title": "Que Tú Te Vas",
    "spotifyUrl": "https://open.spotify.com/track/5xBgNzopylKVTJnrFcKang",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 15667793,
    "daily": 7046
  },
  {
    "id": "4Jdocmx0SOT8AfYW6Vwh2o",
    "title": "Fiebre De Amor",
    "spotifyUrl": "https://open.spotify.com/track/4Jdocmx0SOT8AfYW6Vwh2o",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 15334139,
    "daily": 3819
  },
  {
    "id": "6T32aKDo9fEQ1E0wDrhrTO",
    "title": "Todo El Amor Del Mundo",
    "spotifyUrl": "https://open.spotify.com/track/6T32aKDo9fEQ1E0wDrhrTO",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 15121201,
    "daily": 4784
  },
  {
    "id": "7MuIKeqmb44yi2dWMSm5M7",
    "title": "El Primero",
    "spotifyUrl": "https://open.spotify.com/track/7MuIKeqmb44yi2dWMSm5M7",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 15120939,
    "daily": 6649
  },
  {
    "id": "3rZySdtQD7kNmpVb8gYQv4",
    "title": "Te propongo esta noche",
    "spotifyUrl": "https://open.spotify.com/track/3rZySdtQD7kNmpVb8gYQv4",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 14984374,
    "daily": 6695
  },
  {
    "id": "52gwH8TUdBBhQEs5FqDfik",
    "title": "Dame Tu Amor",
    "spotifyUrl": "https://open.spotify.com/track/52gwH8TUdBBhQEs5FqDfik",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 14891778,
    "daily": 5558
  },
  {
    "id": "5Du3bmN3s1rrkjYgwBR5Co",
    "title": "Hasta El Fin",
    "spotifyUrl": "https://open.spotify.com/track/5Du3bmN3s1rrkjYgwBR5Co",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 14642324,
    "daily": 4754
  },
  {
    "id": "4mxhziZwkvECLvRoc4T0m6",
    "title": "Hasta que vuelvas",
    "spotifyUrl": "https://open.spotify.com/track/4mxhziZwkvECLvRoc4T0m6",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a0802158779f2ebb8c4e45bf",
    "streams": 14581981,
    "daily": 12598
  },
  {
    "id": "67HOYnFs2hqbKKRNz0YfY8",
    "title": "Tres palabras",
    "spotifyUrl": "https://open.spotify.com/track/67HOYnFs2hqbKKRNz0YfY8",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f1dcf9435bfb49b2f986411c",
    "streams": 14379959,
    "daily": 3635
  },
  {
    "id": "4RDhCX2agyMpLcIeMhZhUu",
    "title": "Romance (No me platiques más / No sé tú / La puerta / La barca / Inolvidable) - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/4RDhCX2agyMpLcIeMhZhUu",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 14217333,
    "daily": 5133
  },
  {
    "id": "2j1zJQA3xbPB9LtxVSnx8G",
    "title": "Todo Por Su Amor",
    "spotifyUrl": "https://open.spotify.com/track/2j1zJQA3xbPB9LtxVSnx8G",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 13954380,
    "daily": 8444
  },
  {
    "id": "5L88nFlpqgkYnVgemRIVwi",
    "title": "Estaré En Mi Casa Esta Navidad",
    "spotifyUrl": "https://open.spotify.com/track/5L88nFlpqgkYnVgemRIVwi",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 13915062,
    "daily": 393
  },
  {
    "id": "13IYWtMDbpY8rf4vPkgCiQ",
    "title": "Mi Ciudad",
    "spotifyUrl": "https://open.spotify.com/track/13IYWtMDbpY8rf4vPkgCiQ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 13741956,
    "daily": 6280
  },
  {
    "id": "1Un83XSiTaFLlH43QWT0Vy",
    "title": "Pensar En Ti - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/1Un83XSiTaFLlH43QWT0Vy",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 13461315,
    "daily": 6087
  },
  {
    "id": "3MMCBN8S3HRrDkJ1flKQQ8",
    "title": "Los días felices",
    "spotifyUrl": "https://open.spotify.com/track/3MMCBN8S3HRrDkJ1flKQQ8",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 13401471,
    "daily": 3280
  },
  {
    "id": "3Byrr4mWMxKC6JhNw51MCs",
    "title": "América, América",
    "spotifyUrl": "https://open.spotify.com/track/3Byrr4mWMxKC6JhNw51MCs",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f51c3ac4705ac687f7745f94",
    "streams": 13128138,
    "daily": 1880
  },
  {
    "id": "4OffH4PkRKzsJtWhNT3LoP",
    "title": "Recuerdos Encadenados",
    "spotifyUrl": "https://open.spotify.com/track/4OffH4PkRKzsJtWhNT3LoP",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 12677048,
    "daily": 6995
  },
  {
    "id": "6mqFVKD7iqABWjAQmxT8Af",
    "title": "Mi Humilde Oración",
    "spotifyUrl": "https://open.spotify.com/track/6mqFVKD7iqABWjAQmxT8Af",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 12602923,
    "daily": 517
  },
  {
    "id": "7exfNBa2ZlzKKDikpyGyKu",
    "title": "Romances (Voy a apagar la luz / Contigo aprendí / Por debajo de la mesa / El reloj / Sabor a mí / L",
    "spotifyUrl": "https://open.spotify.com/track/7exfNBa2ZlzKKDikpyGyKu",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 12598532,
    "daily": 4035
  },
  {
    "id": "2XZxK7IzFaS0BZMpSP8whW",
    "title": "Abrázame",
    "spotifyUrl": "https://open.spotify.com/track/2XZxK7IzFaS0BZMpSP8whW",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 12565154,
    "daily": 9746
  },
  {
    "id": "2LxtK38dlYh9Byvv93ndYY",
    "title": "Sonríe",
    "spotifyUrl": "https://open.spotify.com/track/2LxtK38dlYh9Byvv93ndYY",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 12437408,
    "daily": 683
  },
  {
    "id": "5I54Jwkn1oH8a1l9L001zf",
    "title": "No existen límites",
    "spotifyUrl": "https://open.spotify.com/track/5I54Jwkn1oH8a1l9L001zf",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 12306934,
    "daily": 4008
  },
  {
    "id": "3wEzk1HBTwaDsV6GU0trKN",
    "title": "Suave - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/3wEzk1HBTwaDsV6GU0trKN",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 12204190,
    "daily": 4445
  },
  {
    "id": "7kAnTtUb8SzYogViWFgy13",
    "title": "Toda una vida",
    "spotifyUrl": "https://open.spotify.com/track/7kAnTtUb8SzYogViWFgy13",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 11925411,
    "daily": 7859
  },
  {
    "id": "0BbrG0xytWfEwZrYoqqPKR",
    "title": "La Media Vuelta - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/0BbrG0xytWfEwZrYoqqPKR",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 11652256,
    "daily": 3948
  },
  {
    "id": "0dcX9ATwMWpiw8crwMPrgc",
    "title": "Qué sabes tú",
    "spotifyUrl": "https://open.spotify.com/track/0dcX9ATwMWpiw8crwMPrgc",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 11605135,
    "daily": 6160
  },
  {
    "id": "2yNPZI2zj01FcAJCbsOTRM",
    "title": "Ahora que te vas",
    "spotifyUrl": "https://open.spotify.com/track/2yNPZI2zj01FcAJCbsOTRM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 11562875,
    "daily": 6346
  },
  {
    "id": "6N1DUZscDGyL7z7xtrGHqr",
    "title": "Tú me acostumbraste",
    "spotifyUrl": "https://open.spotify.com/track/6N1DUZscDGyL7z7xtrGHqr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 11444133,
    "daily": 6040
  },
  {
    "id": "5IFhE3o9hk6gIikWjTIynr",
    "title": "Suave - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/5IFhE3o9hk6gIikWjTIynr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 11267693,
    "daily": 3631
  },
  {
    "id": "1vx0yzcHzr7kB3MPB5J2y2",
    "title": "Segundo romance (El día que me quieras / Solamente una vez / Somos novios / Todo y nada / Nosotros)",
    "spotifyUrl": "https://open.spotify.com/track/1vx0yzcHzr7kB3MPB5J2y2",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 11044375,
    "daily": 3708
  },
  {
    "id": "5hNTZloXkMLolrgNaMqd7B",
    "title": "Lo que queda de mí",
    "spotifyUrl": "https://open.spotify.com/track/5hNTZloXkMLolrgNaMqd7B",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 10987940,
    "daily": 4267
  },
  {
    "id": "2O9fgZqchdHEedyGJN6RXQ",
    "title": "Marcela",
    "spotifyUrl": "https://open.spotify.com/track/2O9fgZqchdHEedyGJN6RXQ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 10549308,
    "daily": 1326
  },
  {
    "id": "53BmcJXjueQxGFo99O7cIr",
    "title": "Cómplices",
    "spotifyUrl": "https://open.spotify.com/track/53BmcJXjueQxGFo99O7cIr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 10497627,
    "daily": 5412
  },
  {
    "id": "1hO1Nw8W8ssvFPDJaVec41",
    "title": "La última noche",
    "spotifyUrl": "https://open.spotify.com/track/1hO1Nw8W8ssvFPDJaVec41",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 10485905,
    "daily": 5114
  },
  {
    "id": "4LZK9BGNf7M6N4nBbxYxVd",
    "title": "Mujer de fuego",
    "spotifyUrl": "https://open.spotify.com/track/4LZK9BGNf7M6N4nBbxYxVd",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 10425289,
    "daily": 2015
  },
  {
    "id": "4bC7qHKVCD187qEA4xLqU9",
    "title": "Si Te Vas",
    "spotifyUrl": "https://open.spotify.com/track/4bC7qHKVCD187qEA4xLqU9",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 10332585,
    "daily": 5623
  },
  {
    "id": "1mK6wityZTg1vih9U989hY",
    "title": "Vuelve",
    "spotifyUrl": "https://open.spotify.com/track/1mK6wityZTg1vih9U989hY",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 10260058,
    "daily": 3556
  },
  {
    "id": "0OcPSZlWFl78HvTOh3aKDj",
    "title": "Tú sólo tú - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/0OcPSZlWFl78HvTOh3aKDj",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 10155116,
    "daily": 3738
  },
  {
    "id": "3nMQMdlNAlPJVwJ6frem76",
    "title": "Noi Ragazzi Di Oggi",
    "spotifyUrl": "https://open.spotify.com/track/3nMQMdlNAlPJVwJ6frem76",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025f3a025028b593d016f3bbb1",
    "streams": 10113138,
    "daily": 6268
  },
  {
    "id": "1o7a1TsmOY6uogxfrKfXdT",
    "title": "Es mejor (Reach Out I'll Be There)",
    "spotifyUrl": "https://open.spotify.com/track/1o7a1TsmOY6uogxfrKfXdT",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 10001562,
    "daily": 3509
  },
  {
    "id": "2hVJZYW7DDLYK8uan3ApQP",
    "title": "Con tus besos",
    "spotifyUrl": "https://open.spotify.com/track/2hVJZYW7DDLYK8uan3ApQP",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 9443436,
    "daily": 4928
  },
  {
    "id": "7gLH63Zp0CZyjPG3QiCBzZ",
    "title": "O tú o ninguna - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/7gLH63Zp0CZyjPG3QiCBzZ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 9260667,
    "daily": 3631
  },
  {
    "id": "6YeFF97Rn7G978UoYCGOy4",
    "title": "Volver",
    "spotifyUrl": "https://open.spotify.com/track/6YeFF97Rn7G978UoYCGOy4",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 9232103,
    "daily": 3016
  },
  {
    "id": "5lh0ANbN2FlgT05Dzs0Cym",
    "title": "El tiempo que te quede libre",
    "spotifyUrl": "https://open.spotify.com/track/5lh0ANbN2FlgT05Dzs0Cym",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 9222902,
    "daily": 4529
  },
  {
    "id": "1yJUzwqF3PRiQ0KEDy4kYc",
    "title": "Eres",
    "spotifyUrl": "https://open.spotify.com/track/1yJUzwqF3PRiQ0KEDy4kYc",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 8886032,
    "daily": 4697
  },
  {
    "id": "4LYxjoOi5Eri4rkRvvkOBY",
    "title": "Bravo Amor Bravo",
    "spotifyUrl": "https://open.spotify.com/track/4LYxjoOi5Eri4rkRvvkOBY",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 8740582,
    "daily": 3348
  },
  {
    "id": "3e3ph5gZeqSsjIYDqnocPs",
    "title": "Si Te Perdiera",
    "spotifyUrl": "https://open.spotify.com/track/3e3ph5gZeqSsjIYDqnocPs",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02f51c3ac4705ac687f7745f94",
    "streams": 8671978,
    "daily": 3309
  },
  {
    "id": "5AkV6MdcLZtXZ0eOBbiHzO",
    "title": "Eres tú",
    "spotifyUrl": "https://open.spotify.com/track/5AkV6MdcLZtXZ0eOBbiHzO",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 8611901,
    "daily": 3500
  },
  {
    "id": "0bhpBIGgw3GrDUGtxO21E1",
    "title": "Nosotros - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/0bhpBIGgw3GrDUGtxO21E1",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 8486494,
    "daily": 3074
  },
  {
    "id": "5F8lMQ7N5sLag2dqfueMUi",
    "title": "No Sé Tú - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/5F8lMQ7N5sLag2dqfueMUi",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 8481379,
    "daily": 3010
  },
  {
    "id": "2W6vF3llKtqoI1iZybxcIS",
    "title": "Quiero - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/2W6vF3llKtqoI1iZybxcIS",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 8468522,
    "daily": 3284
  },
  {
    "id": "1vk63V3CJtB65JdPiyUpUJ",
    "title": "No Me Puedo Escapar De Ti",
    "spotifyUrl": "https://open.spotify.com/track/1vk63V3CJtB65JdPiyUpUJ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 8133501,
    "daily": 3752
  },
  {
    "id": "40YcADEfdr9QzAIV5XQ6dM",
    "title": "Alguien Como Tú - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/40YcADEfdr9QzAIV5XQ6dM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 8069277,
    "daily": 2902
  },
  {
    "id": "4QfG9VQEB7R1eXX1UuE6g6",
    "title": "Dímelo en un beso",
    "spotifyUrl": "https://open.spotify.com/track/4QfG9VQEB7R1eXX1UuE6g6",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 8004330,
    "daily": 5774
  },
  {
    "id": "6H5p5mRhaEvn03Jv71bj0O",
    "title": "Cómo es posible que a mi lado - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/6H5p5mRhaEvn03Jv71bj0O",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 7955306,
    "daily": 3176
  },
  {
    "id": "7e0PPZm82nXnxlb0bTm151",
    "title": "Siento",
    "spotifyUrl": "https://open.spotify.com/track/7e0PPZm82nXnxlb0bTm151",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 7944997,
    "daily": 2622
  },
  {
    "id": "3zz6O3luXvDEp9Ehn25kaP",
    "title": "Sin Hablar",
    "spotifyUrl": "https://open.spotify.com/track/3zz6O3luXvDEp9Ehn25kaP",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 7912866,
    "daily": 3333
  },
  {
    "id": "1BsM8HsSqi81X6KUiTl3sE",
    "title": "Y sigo",
    "spotifyUrl": "https://open.spotify.com/track/1BsM8HsSqi81X6KUiTl3sE",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 7896224,
    "daily": 3844
  },
  {
    "id": "5xVSvTEShCwxdiIOxXCFUu",
    "title": "Dame Tu Amor - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/5xVSvTEShCwxdiIOxXCFUu",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 7882372,
    "daily": 2874
  },
  {
    "id": "1AImcYjPDawHdpyftgF3rI",
    "title": "Dicen",
    "spotifyUrl": "https://open.spotify.com/track/1AImcYjPDawHdpyftgF3rI",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 7846751,
    "daily": 2563
  },
  {
    "id": "2V5fZ0WxkZnKt9mZOHqWAd",
    "title": "Es por ti",
    "spotifyUrl": "https://open.spotify.com/track/2V5fZ0WxkZnKt9mZOHqWAd",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 7640687,
    "daily": 1780
  },
  {
    "id": "6ZpReL8oEhfxGz6N1dNSLq",
    "title": "Que Nivel De Mujer - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/6ZpReL8oEhfxGz6N1dNSLq",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 7625515,
    "daily": 2608
  },
  {
    "id": "2M3N4KGdpqhOTH6Wk9ifJH",
    "title": "Sol, arena y mar - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/2M3N4KGdpqhOTH6Wk9ifJH",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 7610455,
    "daily": 2675
  },
  {
    "id": "2IWGjFFHiChCI6g6wE3mQO",
    "title": "Quiero",
    "spotifyUrl": "https://open.spotify.com/track/2IWGjFFHiChCI6g6wE3mQO",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 7605679,
    "daily": 3539
  },
  {
    "id": "6KxcH7M0KIDGiu2HYY3WcI",
    "title": "Lili (Lili)",
    "spotifyUrl": "https://open.spotify.com/track/6KxcH7M0KIDGiu2HYY3WcI",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e020d61f0f4818e3733a8390fc8",
    "streams": 7560685,
    "daily": 3075
  },
  {
    "id": "5smx9yYmlUgIoD5vIz6qLf",
    "title": "Ella es así",
    "spotifyUrl": "https://open.spotify.com/track/5smx9yYmlUgIoD5vIz6qLf",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 7521644,
    "daily": 1813
  },
  {
    "id": "4tz3JxNa139bElFuYJCKeR",
    "title": "Ya Nunca Más",
    "spotifyUrl": "https://open.spotify.com/track/4tz3JxNa139bElFuYJCKeR",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 7508173,
    "daily": 1803
  },
  {
    "id": "50L8nrgUNxSER3oBRkx4yn",
    "title": "Somos Novios - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/50L8nrgUNxSER3oBRkx4yn",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 7449076,
    "daily": 2384
  },
  {
    "id": "3PlhEGoFWvQpPtCycG8xpr",
    "title": "Tu mirada",
    "spotifyUrl": "https://open.spotify.com/track/3PlhEGoFWvQpPtCycG8xpr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 7381558,
    "daily": 3372
  },
  {
    "id": "3tIjNmr0gRLcl6fRYQY1aT",
    "title": "El Dia Que Me Quieras - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/3tIjNmr0gRLcl6fRYQY1aT",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 7351355,
    "daily": 2556
  },
  {
    "id": "2lUWPR61enUIB1obg9eSaj",
    "title": "Luz Verde - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/2lUWPR61enUIB1obg9eSaj",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 7288928,
    "daily": 3096
  },
  {
    "id": "4BKJJevkRtGDlDfKJoYiBM",
    "title": "Que tristeza",
    "spotifyUrl": "https://open.spotify.com/track/4BKJJevkRtGDlDfKJoYiBM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 7140519,
    "daily": 4108
  },
  {
    "id": "2bJo0T1SSiZkTqUOkKkA5Z",
    "title": "Te propongo esta noche - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/2bJo0T1SSiZkTqUOkKkA5Z",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 7071412,
    "daily": 2816
  },
  {
    "id": "6x0V11tujHlNBpPXNVdFAr",
    "title": "Sintiéndote Lejos",
    "spotifyUrl": "https://open.spotify.com/track/6x0V11tujHlNBpPXNVdFAr",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 7032424,
    "daily": 5449
  },
  {
    "id": "6OQwPtGt4lOfiuUYqk1UQr",
    "title": "No me fio",
    "spotifyUrl": "https://open.spotify.com/track/6OQwPtGt4lOfiuUYqk1UQr",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 6968765,
    "daily": 3094
  },
  {
    "id": "1DsSWNLXRQf4fmlmZBWKOe",
    "title": "Un Día Mas",
    "spotifyUrl": "https://open.spotify.com/track/1DsSWNLXRQf4fmlmZBWKOe",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 6643354,
    "daily": 3951
  },
  {
    "id": "10xLuldyRWXfQHgdynGNHQ",
    "title": "Ese momento",
    "spotifyUrl": "https://open.spotify.com/track/10xLuldyRWXfQHgdynGNHQ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 6487455,
    "daily": 3296
  },
  {
    "id": "54uB4Qwsy2pw2m16AHGW21",
    "title": "Tú No Tienes Corazón (Tú Di Coure None Hai)",
    "spotifyUrl": "https://open.spotify.com/track/54uB4Qwsy2pw2m16AHGW21",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 6313682,
    "daily": 1726
  },
  {
    "id": "5sLpjgxM6uRH41AQBAA6HN",
    "title": "Qué Hacer",
    "spotifyUrl": "https://open.spotify.com/track/5sLpjgxM6uRH41AQBAA6HN",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 6257200,
    "daily": 3881
  },
  {
    "id": "7DucBSRFYRvwgV5VNOWL7D",
    "title": "Ay cariño",
    "spotifyUrl": "https://open.spotify.com/track/7DucBSRFYRvwgV5VNOWL7D",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 6256267,
    "daily": 2040
  },
  {
    "id": "5tIm1xyyj2SvfjlpNeHwb5",
    "title": "Déjà Vu",
    "spotifyUrl": "https://open.spotify.com/track/5tIm1xyyj2SvfjlpNeHwb5",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0247bb6c127c2adeb5eb430474",
    "streams": 6228852,
    "daily": 1228
  },
  {
    "id": "0iRxOIcLoqi1POCyN0DU0f",
    "title": "De nuevo el paraíso",
    "spotifyUrl": "https://open.spotify.com/track/0iRxOIcLoqi1POCyN0DU0f",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 6097617,
    "daily": 2465
  },
  {
    "id": "6rEcqWbKCCVz0U5kfYbCCZ",
    "title": "Mentira",
    "spotifyUrl": "https://open.spotify.com/track/6rEcqWbKCCVz0U5kfYbCCZ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e020d61f0f4818e3733a8390fc8",
    "streams": 6042471,
    "daily": 1581
  },
  {
    "id": "2QjMNzXrmpNCTGADHAhv6J",
    "title": "Amor De Hecho",
    "spotifyUrl": "https://open.spotify.com/track/2QjMNzXrmpNCTGADHAhv6J",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 5871101,
    "daily": 2092
  },
  {
    "id": "3JbiduuAFvgeQ1r6VFKAJf",
    "title": "Estrenando Amor",
    "spotifyUrl": "https://open.spotify.com/track/3JbiduuAFvgeQ1r6VFKAJf",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 5614257,
    "daily": 2281
  },
  {
    "id": "1Vx34WTQ5Dh0m9cZpaaybe",
    "title": "Amor A Mares",
    "spotifyUrl": "https://open.spotify.com/track/1Vx34WTQ5Dh0m9cZpaaybe",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 5596468,
    "daily": 1876
  },
  {
    "id": "2tfLnOQalJHP5tMymzbmZb",
    "title": "Este Amor",
    "spotifyUrl": "https://open.spotify.com/track/2tfLnOQalJHP5tMymzbmZb",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 5407727,
    "daily": 3519
  },
  {
    "id": "4tE67bMcR2G3uCEiZEkT3R",
    "title": "Se Amaban",
    "spotifyUrl": "https://open.spotify.com/track/4tE67bMcR2G3uCEiZEkT3R",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 5282962,
    "daily": 1632
  },
  {
    "id": "4etNhqqgMIzlqOF72XNKxH",
    "title": "Será que no me amas - Hex Hector Mix",
    "spotifyUrl": "https://open.spotify.com/track/4etNhqqgMIzlqOF72XNKxH",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 5256833,
    "daily": 1899
  },
  {
    "id": "3RIvQ3bLGsyHLJTPhiJfvx",
    "title": "Misterios Del Amor",
    "spotifyUrl": "https://open.spotify.com/track/3RIvQ3bLGsyHLJTPhiJfvx",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02f51c3ac4705ac687f7745f94",
    "streams": 4890600,
    "daily": 1808
  },
  {
    "id": "1zzeiPdpDrvZPN9V1BMsOR",
    "title": "Tal vez me mientes",
    "spotifyUrl": "https://open.spotify.com/track/1zzeiPdpDrvZPN9V1BMsOR",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 4886657,
    "daily": 1144
  },
  {
    "id": "34XWbPXP6ie3tMqlDotSDa",
    "title": "Sin Ti - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/34XWbPXP6ie3tMqlDotSDa",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 4696508,
    "daily": 1627
  },
  {
    "id": "7roPD9heYOEbEAihVIrE4S",
    "title": "Introduccion Guitarra - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/7roPD9heYOEbEAihVIrE4S",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 4661655,
    "daily": 1436
  },
  {
    "id": "2swhib7LkqzQgqQZgNWkQt",
    "title": "Tu imaginación",
    "spotifyUrl": "https://open.spotify.com/track/2swhib7LkqzQgqQZgNWkQt",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 4582682,
    "daily": 1581
  },
  {
    "id": "73GpxDJCmzyZxI4bMfhV6M",
    "title": "Hay Un Algo",
    "spotifyUrl": "https://open.spotify.com/track/73GpxDJCmzyZxI4bMfhV6M",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 4435581,
    "daily": 1058
  },
  {
    "id": "5tx2DMxAWmybvnDdUpNCPt",
    "title": "Rey De Corazones (Il Re Di Cuori)",
    "spotifyUrl": "https://open.spotify.com/track/5tx2DMxAWmybvnDdUpNCPt",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 4355382,
    "daily": 1854
  },
  {
    "id": "2mVrptJtFdeh7p4VC3Id5g",
    "title": "Introducción - En Vivo",
    "spotifyUrl": "https://open.spotify.com/track/2mVrptJtFdeh7p4VC3Id5g",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 3993123,
    "daily": 1315
  },
  {
    "id": "20A5ozzvGkTBVd5abZNdne",
    "title": "Labios de miel - Dance Remix",
    "spotifyUrl": "https://open.spotify.com/track/20A5ozzvGkTBVd5abZNdne",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 3755084,
    "daily": 551
  },
  {
    "id": "2Vy2ejXvJcBBKLmtqYG6Ep",
    "title": "Intro - En vivo",
    "spotifyUrl": "https://open.spotify.com/track/2Vy2ejXvJcBBKLmtqYG6Ep",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 3622459,
    "daily": 1283
  },
  {
    "id": "0EO5K6h28pVOVlzPUcJFly",
    "title": "Un Rock and Roll Sonó",
    "spotifyUrl": "https://open.spotify.com/track/0EO5K6h28pVOVlzPUcJFly",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ad808013c572aad37455fe66",
    "streams": 3592403,
    "daily": 1943
  },
  {
    "id": "0bO31m1ZfpmG25ATQshqh4",
    "title": "Disfraces",
    "spotifyUrl": "https://open.spotify.com/track/0bO31m1ZfpmG25ATQshqh4",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 3504673,
    "daily": 957
  },
  {
    "id": "2CaZxX7rYOvjYAY4JLLh6G",
    "title": "La Juventud",
    "spotifyUrl": "https://open.spotify.com/track/2CaZxX7rYOvjYAY4JLLh6G",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 3449888,
    "daily": 1055
  },
  {
    "id": "5vYtYSJQETHD4XZrvUn0id",
    "title": "Amor De Escuela",
    "spotifyUrl": "https://open.spotify.com/track/5vYtYSJQETHD4XZrvUn0id",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 3326485,
    "daily": 729
  },
  {
    "id": "7GBY3AFdFG0ViULxp1CGlW",
    "title": "Mujer de fuego - Dance Remix",
    "spotifyUrl": "https://open.spotify.com/track/7GBY3AFdFG0ViULxp1CGlW",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 3284103,
    "daily": 447
  },
  {
    "id": "599NHP48KijfI0naerRdGG",
    "title": "Tal vez me mientes - Dance Remix",
    "spotifyUrl": "https://open.spotify.com/track/599NHP48KijfI0naerRdGG",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 3062811,
    "daily": 440
  },
  {
    "id": "4AUOxWFC7xQ5ney4kfYp1t",
    "title": "Es por ti - Dance Remix",
    "spotifyUrl": "https://open.spotify.com/track/4AUOxWFC7xQ5ney4kfYp1t",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 3039391,
    "daily": 440
  },
  {
    "id": "7vTve1cxKAEHFZiZOXEVYK",
    "title": "Suave - Darío Gómez & Vlad Díaz Mix",
    "spotifyUrl": "https://open.spotify.com/track/7vTve1cxKAEHFZiZOXEVYK",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 2864636,
    "daily": 826
  },
  {
    "id": "1wohvpSik8Oa6HQwKwC0TV",
    "title": "Si te vas - Rocasound Mix",
    "spotifyUrl": "https://open.spotify.com/track/1wohvpSik8Oa6HQwKwC0TV",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 2598629,
    "daily": 599
  },
  {
    "id": "1WGyxboMqNBd7HIQ6oKeXb",
    "title": "Alguien como tú - Rocasound Mix",
    "spotifyUrl": "https://open.spotify.com/track/1WGyxboMqNBd7HIQ6oKeXb",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 2541290,
    "daily": 577
  },
  {
    "id": "6IxEHJtMPLiUTByLEITIvi",
    "title": "Te propongo esta noche - Hex Hector Mix",
    "spotifyUrl": "https://open.spotify.com/track/6IxEHJtMPLiUTByLEITIvi",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 2442500,
    "daily": 547
  },
  {
    "id": "7LBSeihRjIvtMSOL7dThyb",
    "title": "Me Gustas Tal Como Eres (feat. Luis Miguel)",
    "spotifyUrl": "https://open.spotify.com/track/7LBSeihRjIvtMSOL7dThyb",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e024723a133e225e47a3676265b",
    "streams": 2347898,
    "daily": 1551
  },
  {
    "id": "7aZwGAtE9VGDabA7LzTcXB",
    "title": "Sueños",
    "spotifyUrl": "https://open.spotify.com/track/7aZwGAtE9VGDabA7LzTcXB",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 2325255,
    "daily": 1213
  },
  {
    "id": "1XdFc8PDoKqR9KqmIWkaVo",
    "title": "Sol, arena y mar - Danny Saber Club Mix",
    "spotifyUrl": "https://open.spotify.com/track/1XdFc8PDoKqR9KqmIWkaVo",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 2257157,
    "daily": 461
  },
  {
    "id": "4Tb170h3P7mFOROosQBomd",
    "title": "Por Ti",
    "spotifyUrl": "https://open.spotify.com/track/4Tb170h3P7mFOROosQBomd",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 2254446,
    "daily": 1325
  },
  {
    "id": "2RQwVgQVkJvj4rnTfLK4gh",
    "title": "Soy Como Soy",
    "spotifyUrl": "https://open.spotify.com/track/2RQwVgQVkJvj4rnTfLK4gh",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 2160226,
    "daily": 817
  },
  {
    "id": "484fKKYZdd5OBZvQUjR7If",
    "title": "Eres - Darío Gómez & Vlad Díaz Mix",
    "spotifyUrl": "https://open.spotify.com/track/484fKKYZdd5OBZvQUjR7If",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 1941771,
    "daily": 341
  },
  {
    "id": "4ec2MKu2O5M6eFdt4rzbtZ",
    "title": "Safari",
    "spotifyUrl": "https://open.spotify.com/track/4ec2MKu2O5M6eFdt4rzbtZ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 1899607,
    "daily": 295
  },
  {
    "id": "2kp0DV0R3enON8gc43dX0x",
    "title": "Háblame",
    "spotifyUrl": "https://open.spotify.com/track/2kp0DV0R3enON8gc43dX0x",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ad808013c572aad37455fe66",
    "streams": 1804111,
    "daily": 1096
  },
  {
    "id": "2XbnIrf4haI1MuGdKfkTJW",
    "title": "Vuelve - Arena Mix",
    "spotifyUrl": "https://open.spotify.com/track/2XbnIrf4haI1MuGdKfkTJW",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 1670039,
    "daily": 286
  },
  {
    "id": "35iwhFyx66h5ul3kCzR3eM",
    "title": "Tu imaginación - Long Mix",
    "spotifyUrl": "https://open.spotify.com/track/35iwhFyx66h5ul3kCzR3eM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 1631943,
    "daily": 301
  },
  {
    "id": "5rmetQayHObmIel6cKUIz2",
    "title": "Me Muero Por Tí",
    "spotifyUrl": "https://open.spotify.com/track/5rmetQayHObmIel6cKUIz2",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ad808013c572aad37455fe66",
    "streams": 1602677,
    "daily": 996
  },
  {
    "id": "2uvUAJv7OvcjyEU8bhRQNM",
    "title": "Acapulco Amor",
    "spotifyUrl": "https://open.spotify.com/track/2uvUAJv7OvcjyEU8bhRQNM",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 1381485,
    "daily": 561
  },
  {
    "id": "2uQlFpKCOh3vJS6I1NRm59",
    "title": "Il Bikini Blu (La Chica Del Bikini Azul)",
    "spotifyUrl": "https://open.spotify.com/track/2uQlFpKCOh3vJS6I1NRm59",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025f3a025028b593d016f3bbb1",
    "streams": 1301912,
    "daily": 639
  },
  {
    "id": "4G65y9ZCc1l3vU4rfiim66",
    "title": "Siempre Me Quedo Siempre Me Voy",
    "spotifyUrl": "https://open.spotify.com/track/4G65y9ZCc1l3vU4rfiim66",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 1260439,
    "daily": 700
  },
  {
    "id": "03RCxjhcB6abu6pVBYFRFZ",
    "title": "Mini Amor",
    "spotifyUrl": "https://open.spotify.com/track/03RCxjhcB6abu6pVBYFRFZ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 1220916,
    "daily": 716
  },
  {
    "id": "3SGHTY8VNiDJgk6jgWSnoX",
    "title": "Hablame (Chiamami)",
    "spotifyUrl": "https://open.spotify.com/track/3SGHTY8VNiDJgk6jgWSnoX",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 1159124,
    "daily": 357
  },
  {
    "id": "2NAZXAA5Wn3uvH1sVKF7la",
    "title": "Un Rock and Roll Suono",
    "spotifyUrl": "https://open.spotify.com/track/2NAZXAA5Wn3uvH1sVKF7la",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 1146780,
    "daily": 353
  },
  {
    "id": "6hKjTEzzAEQKT4mP7eF6aJ",
    "title": "Muñeca Rota",
    "spotifyUrl": "https://open.spotify.com/track/6hKjTEzzAEQKT4mP7eF6aJ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 1136531,
    "daily": 551
  },
  {
    "id": "7nHKDt7Vv1zw7DGnNTRMQ0",
    "title": "Mama, Mama",
    "spotifyUrl": "https://open.spotify.com/track/7nHKDt7Vv1zw7DGnNTRMQ0",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 1037048,
    "daily": 422
  },
  {
    "id": "3RdFwvdW8CB7VhT8TQ9pUQ",
    "title": "Lo Que Me Gusta",
    "spotifyUrl": "https://open.spotify.com/track/3RdFwvdW8CB7VhT8TQ9pUQ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 901447,
    "daily": 423
  },
  {
    "id": "2b0lmzUBixAP94pOrujnWF",
    "title": "El Tiempo",
    "spotifyUrl": "https://open.spotify.com/track/2b0lmzUBixAP94pOrujnWF",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 889615,
    "daily": 434
  },
  {
    "id": "5rDujgF9ocsL7CPC6iUKae",
    "title": "Lo Lei En Tu Diario",
    "spotifyUrl": "https://open.spotify.com/track/5rDujgF9ocsL7CPC6iUKae",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 827426,
    "daily": 520
  },
  {
    "id": "0Su7oaKb59idfQkkCtWe3u",
    "title": "Isabel - Italian Version",
    "spotifyUrl": "https://open.spotify.com/track/0Su7oaKb59idfQkkCtWe3u",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025f3a025028b593d016f3bbb1",
    "streams": 816170,
    "daily": 460
  },
  {
    "id": "6xtdg01bSGWEbI9jY33sHb",
    "title": "Ora Pronobis",
    "spotifyUrl": "https://open.spotify.com/track/6xtdg01bSGWEbI9jY33sHb",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 773194,
    "daily": 325
  },
  {
    "id": "3GimasgGvXGCa3cf87yJxk",
    "title": "Parola D' Onore",
    "spotifyUrl": "https://open.spotify.com/track/3GimasgGvXGCa3cf87yJxk",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025f3a025028b593d016f3bbb1",
    "streams": 743367,
    "daily": 395
  },
  {
    "id": "4qAdAFrKgAvzDuoYVeUdkT",
    "title": "Siempre Te Seguiré",
    "spotifyUrl": "https://open.spotify.com/track/4qAdAFrKgAvzDuoYVeUdkT",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 726783,
    "daily": 304
  },
  {
    "id": "06iBflOLbxBTDO84vgG1BN",
    "title": "Lupe",
    "spotifyUrl": "https://open.spotify.com/track/06iBflOLbxBTDO84vgG1BN",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 719915,
    "daily": 270
  },
  {
    "id": "6eeqk3RnkoEUZ2oKnSwxjh",
    "title": "Adolescente Soñador",
    "spotifyUrl": "https://open.spotify.com/track/6eeqk3RnkoEUZ2oKnSwxjh",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 715717,
    "daily": 291
  },
  {
    "id": "747Yt0pHZB6EWLNNr5ci2h",
    "title": "Nosotros Dos",
    "spotifyUrl": "https://open.spotify.com/track/747Yt0pHZB6EWLNNr5ci2h",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 714592,
    "daily": 448
  },
  {
    "id": "7iD983vodZI7xIfpR5nP4B",
    "title": "Juego De Amigos",
    "spotifyUrl": "https://open.spotify.com/track/7iD983vodZI7xIfpR5nP4B",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 687574,
    "daily": 218
  },
  {
    "id": "4KggNoSW9WsHSDHo6ct3Ki",
    "title": "Fiebre De Amor - Instrumental",
    "spotifyUrl": "https://open.spotify.com/track/4KggNoSW9WsHSDHo6ct3Ki",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 658333,
    "daily": 335
  },
  {
    "id": "1K1v5iHJOhB7vSYQVIx0rs",
    "title": "A Mis Años Ya Te Amo",
    "spotifyUrl": "https://open.spotify.com/track/1K1v5iHJOhB7vSYQVIx0rs",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 656699,
    "daily": 414
  },
  {
    "id": "7JArXhAkvgyvTsceX9oqux",
    "title": "Io Muoio Per Te (Me Muero Por Ti)",
    "spotifyUrl": "https://open.spotify.com/track/7JArXhAkvgyvTsceX9oqux",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 634279,
    "daily": 210
  },
  {
    "id": "0ZWe6pDzCJL3OxZpUQe1lQ",
    "title": "Tu imaginación - Hex Hector Remix",
    "spotifyUrl": "https://open.spotify.com/track/0ZWe6pDzCJL3OxZpUQe1lQ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 613813,
    "daily": 161
  },
  {
    "id": "6CZtjyaPOjUOXxtEpX7GQh",
    "title": "Tomemos Los Patines",
    "spotifyUrl": "https://open.spotify.com/track/6CZtjyaPOjUOXxtEpX7GQh",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 591357,
    "daily": 242
  },
  {
    "id": "5Dv7YUbxcOzKjYM5Ifuzm0",
    "title": "No Es Permitido",
    "spotifyUrl": "https://open.spotify.com/track/5Dv7YUbxcOzKjYM5Ifuzm0",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 557508,
    "daily": 319
  },
  {
    "id": "52sOnKmkHyCbyf4AgGxZAw",
    "title": "Si Ves a Mi Chica, Dile Que La Amo",
    "spotifyUrl": "https://open.spotify.com/track/52sOnKmkHyCbyf4AgGxZAw",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 547686,
    "daily": 269
  },
  {
    "id": "005XFVsvuKK1mmfAifYVfO",
    "title": "Balada Para Mi Abuela",
    "spotifyUrl": "https://open.spotify.com/track/005XFVsvuKK1mmfAifYVfO",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020ec4c3781087b6eb7fc68bae",
    "streams": 493838,
    "daily": 217
  },
  {
    "id": "7tm0ummX6EvYBZBz8BwByV",
    "title": "Tu Di Cuore Nonne Hai",
    "spotifyUrl": "https://open.spotify.com/track/7tm0ummX6EvYBZBz8BwByV",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025f3a025028b593d016f3bbb1",
    "streams": 487049,
    "daily": 185
  },
  {
    "id": "1um2VKWvHe73QcTcc8kAnK",
    "title": "Bandido Cupido",
    "spotifyUrl": "https://open.spotify.com/track/1um2VKWvHe73QcTcc8kAnK",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 411199,
    "daily": 192
  },
  {
    "id": "4D0jltbj8SThrnxbwajwD2",
    "title": "Rock De La Niña Cruel",
    "spotifyUrl": "https://open.spotify.com/track/4D0jltbj8SThrnxbwajwD2",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 394985,
    "daily": 236
  },
  {
    "id": "5mywBXnH1qeA5vIvMLwRzL",
    "title": "El Brujo",
    "spotifyUrl": "https://open.spotify.com/track/5mywBXnH1qeA5vIvMLwRzL",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 350155,
    "daily": 182
  },
  {
    "id": "0PAjHruwaupXDfRFJL32sQ",
    "title": "En Japon",
    "spotifyUrl": "https://open.spotify.com/track/0PAjHruwaupXDfRFJL32sQ",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 318049,
    "daily": 162
  },
  {
    "id": "5GhQTHoyBd2OSx6ficPdaP",
    "title": "Black Is Black / King Creole / Twist and Shout / Jailhouse Rock (Medley)",
    "spotifyUrl": "https://open.spotify.com/track/5GhQTHoyBd2OSx6ficPdaP",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 316141,
    "daily": 126
  },
  {
    "id": "03B1bxcwITGCRrEBZqiDH2",
    "title": "Campeón",
    "spotifyUrl": "https://open.spotify.com/track/03B1bxcwITGCRrEBZqiDH2",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 303046,
    "daily": 147
  },
  {
    "id": "263FPEmibtoT9v639H9krX",
    "title": "La Juventud - Instrumental",
    "spotifyUrl": "https://open.spotify.com/track/263FPEmibtoT9v639H9krX",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 187488,
    "daily": 87
  },
  {
    "id": "3PtIRtduQXYUEH7tdQbIzg",
    "title": "Ya Nunca Más - Instrumental",
    "spotifyUrl": "https://open.spotify.com/track/3PtIRtduQXYUEH7tdQbIzg",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 184202,
    "daily": 66
  },
  {
    "id": "2cXIr7JJob35ZFw16Innlb",
    "title": "Juego De Amigos - Instrumental",
    "spotifyUrl": "https://open.spotify.com/track/2cXIr7JJob35ZFw16Innlb",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 169471,
    "daily": 74
  },
  {
    "id": "2GLtPgoKYrmCav6cST0MTP",
    "title": "Susie Q / Memphis Tennessee / Rock and Roll Music (Medley)",
    "spotifyUrl": "https://open.spotify.com/track/2GLtPgoKYrmCav6cST0MTP",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 145378,
    "daily": 55
  },
  {
    "id": "2vOozu67ife3DVB30GrPnh",
    "title": "Rock Around the Clock / Rip It Up / When the Saints Go Marchin' In / See You Later Alligator / Luci",
    "spotifyUrl": "https://open.spotify.com/track/2vOozu67ife3DVB30GrPnh",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 141883,
    "daily": 74
  },
  {
    "id": "2U1J5VM9XMIUxnwrr7ReKE",
    "title": "Baby I Don't Care / Treat Me Nice / It's Now or Never (Medley)",
    "spotifyUrl": "https://open.spotify.com/track/2U1J5VM9XMIUxnwrr7ReKE",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 139252,
    "daily": 70
  },
  {
    "id": "76MKOipv5OkPtBBEtLXDnb",
    "title": "C'Mon Everybody / Dynamite / Boney Moronie / High Class Baby (Medley)",
    "spotifyUrl": "https://open.spotify.com/track/76MKOipv5OkPtBBEtLXDnb",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 135646,
    "daily": 76
  },
  {
    "id": "5FbZClDQ3alKADky0PAa7j",
    "title": "Hound Dog / Don't Be Cruel / Teddy Bear / All Shook Up (Medley)",
    "spotifyUrl": "https://open.spotify.com/track/5FbZClDQ3alKADky0PAa7j",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 129027,
    "daily": 62
  },
  {
    "id": "0d0cSGk4xL7tNShvX3xco6",
    "title": "Tallahassee Lassie / High School Confidential / Good Rockin' Tonight (Medley)",
    "spotifyUrl": "https://open.spotify.com/track/0d0cSGk4xL7tNShvX3xco6",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 113303,
    "daily": 62
  }
];
export const LUIS_MIGUEL_ALBUMS: MonitoringCatalogAlbum[] = [
  {
    "id": "0NwQIWxyE13WaqiiHC9kIA",
    "title": "Grandes Éxitos",
    "spotifyUrl": "https://open.spotify.com/album/0NwQIWxyE13WaqiiHC9kIA",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f51c3ac4705ac687f7745f94",
    "streams": 8151311023,
    "daily": 3457128,
    "compilation": true
  },
  {
    "id": "2RTzSYUsrbecOYJQbElNc9",
    "title": "Grandes Exitos - US CD version",
    "spotifyUrl": "https://open.spotify.com/album/2RTzSYUsrbecOYJQbElNc9",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02cbe75d3301af57e68af170d3",
    "streams": 7416069890,
    "daily": 3159822,
    "compilation": true
  },
  {
    "id": "1acqznTFsJ7ekLNp00bj1p",
    "title": "Todos Los Romances",
    "spotifyUrl": "https://open.spotify.com/album/1acqznTFsJ7ekLNp00bj1p",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0270d23929d5dedd49af1f544d",
    "streams": 5000704425,
    "daily": 2348776,
    "compilation": true
  },
  {
    "id": "0KxKUvK8sDRyvmGN8uMdx2",
    "title": "Mis Boleros Favoritos",
    "spotifyUrl": "https://open.spotify.com/album/0KxKUvK8sDRyvmGN8uMdx2",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a0802158779f2ebb8c4e45bf",
    "streams": 2512622609,
    "daily": 1041151,
    "compilation": false
  },
  {
    "id": "6gPSAXonNnnjWLk9cuhA1I",
    "title": "Canciones De Amor",
    "spotifyUrl": "https://open.spotify.com/album/6gPSAXonNnnjWLk9cuhA1I",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02141f5902be4ea8441ae71122",
    "streams": 2509334736,
    "daily": 1079295,
    "compilation": false
  },
  {
    "id": "6JSqwckfTYWbJj4R1fdOOo",
    "title": "Busca Una Mujer",
    "spotifyUrl": "https://open.spotify.com/album/6JSqwckfTYWbJj4R1fdOOo",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027144526743136029a4d61aca",
    "streams": 2075314967,
    "daily": 986949,
    "compilation": false
  },
  {
    "id": "4MjzdTkEmTwPAlVwDSSivP",
    "title": "Romance",
    "spotifyUrl": "https://open.spotify.com/album/4MjzdTkEmTwPAlVwDSSivP",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02bda5c1e56bf06c3c7fc173f7",
    "streams": 1958672032,
    "daily": 1006521,
    "compilation": false
  },
  {
    "id": "3OdgRM6jaoh8Q1Nu3BnheU",
    "title": "Romances",
    "spotifyUrl": "https://open.spotify.com/album/3OdgRM6jaoh8Q1Nu3BnheU",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02c57a66b0e7b4f65850594107",
    "streams": 1683656226,
    "daily": 745968,
    "compilation": false
  },
  {
    "id": "2dJCC5WZDKqQbXmUJeLe9Z",
    "title": "Soy Como Quiero Ser",
    "spotifyUrl": "https://open.spotify.com/album/2dJCC5WZDKqQbXmUJeLe9Z",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026d2d141c6f14e161ca551971",
    "streams": 1551096660,
    "daily": 700831,
    "compilation": false
  },
  {
    "id": "2e6Hp6xaTbUDVzcGLNTHm0",
    "title": "Segundo Romance",
    "spotifyUrl": "https://open.spotify.com/album/2e6Hp6xaTbUDVzcGLNTHm0",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025bbb2861d3459dbff0148f50",
    "streams": 1358376167,
    "daily": 596286,
    "compilation": false
  },
  {
    "id": "41VfVz6sKvbm1yCbqAlwfM",
    "title": "Mexico en la Piel (edicion diamante)",
    "spotifyUrl": "https://open.spotify.com/album/41VfVz6sKvbm1yCbqAlwfM",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d7d95fdd960f6d2ec2370ae2",
    "streams": 1267245933,
    "daily": 631392,
    "compilation": false
  },
  {
    "id": "6UFAOiLDzOOt75eJhrhFNC",
    "title": "Aries",
    "spotifyUrl": "https://open.spotify.com/album/6UFAOiLDzOOt75eJhrhFNC",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02780268564c65ca302786e6ff",
    "streams": 1238106465,
    "daily": 521276,
    "compilation": false
  },
  {
    "id": "3D9NENGfg4DFmYJrEaxRHd",
    "title": "20 Años",
    "spotifyUrl": "https://open.spotify.com/album/3D9NENGfg4DFmYJrEaxRHd",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02e6cab0ffee915cdbe7c7d85a",
    "streams": 1234908714,
    "daily": 709193,
    "compilation": false
  },
  {
    "id": "3pq2qxM4U1qIscdExsZmBU",
    "title": "30 Exitos Insuperables",
    "spotifyUrl": "https://open.spotify.com/album/3pq2qxM4U1qIscdExsZmBU",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02772002854e23636b62edb377",
    "streams": 962407848,
    "daily": 401286,
    "compilation": false
  },
  {
    "id": "2oHF59HQoCwm67wXS4OzPK",
    "title": "La Miel De Mis Primeros Éxitos",
    "spotifyUrl": "https://open.spotify.com/album/2oHF59HQoCwm67wXS4OzPK",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025b91826115f26bb6d7fa8c92",
    "streams": 959758816,
    "daily": 396886,
    "compilation": true
  },
  {
    "id": "0sLmtNwESwIJADdtwRNqXs",
    "title": "Solo Lo Mejor - 20 Exitos",
    "spotifyUrl": "https://open.spotify.com/album/0sLmtNwESwIJADdtwRNqXs",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0289dd8f8f595a881a3af90305",
    "streams": 938428747,
    "daily": 395481,
    "compilation": false
  },
  {
    "id": "28KtwGLD5soKpzJyP1tGUo",
    "title": "El Idolo De Mexico",
    "spotifyUrl": "https://open.spotify.com/album/28KtwGLD5soKpzJyP1tGUo",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b6d3c1b2372d542e8fffdac3",
    "streams": 934708159,
    "daily": 394119,
    "compilation": false
  },
  {
    "id": "3xCJKZUVsEEbaKV9jNvsJl",
    "title": "14 Grandes Exitos",
    "spotifyUrl": "https://open.spotify.com/album/3xCJKZUVsEEbaKV9jNvsJl",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02eaf45540d44d4d2bcc70db12",
    "streams": 910903500,
    "daily": 384748,
    "compilation": true
  },
  {
    "id": "7raoW9DhHdfU9iEU5yZjcE",
    "title": "Romantico Desde Siempre",
    "spotifyUrl": "https://open.spotify.com/album/7raoW9DhHdfU9iEU5yZjcE",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020d61f0f4818e3733a8390fc8",
    "streams": 815034323,
    "daily": 347655,
    "compilation": false
  },
  {
    "id": "0wXfbN7mRkmZPkfJjkHSMP",
    "title": "Latin Classics",
    "spotifyUrl": "https://open.spotify.com/album/0wXfbN7mRkmZPkfJjkHSMP",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02d5d20b8a281b9737070c949f",
    "streams": 712845883,
    "daily": 305612,
    "compilation": false
  },
  {
    "id": "46FkZmwdxnGPVXUTTfhche",
    "title": "¡MÉXICO Por Siempre!",
    "spotifyUrl": "https://open.spotify.com/album/46FkZmwdxnGPVXUTTfhche",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025c342174dcbadcc1d686121c",
    "streams": 679656813,
    "daily": 229009,
    "compilation": false
  },
  {
    "id": "45xKQlOetCnDcZxRu4tEwh",
    "title": "Palabra De Honor",
    "spotifyUrl": "https://open.spotify.com/album/45xKQlOetCnDcZxRu4tEwh",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ad808013c572aad37455fe66",
    "streams": 620999673,
    "daily": 270416,
    "compilation": false
  },
  {
    "id": "1cpQHKtfCtrxMz7zUlX7of",
    "title": "Celebridades- Luis Miguel",
    "spotifyUrl": "https://open.spotify.com/album/1cpQHKtfCtrxMz7zUlX7of",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f2a2ca9434bc127d28e68d3f",
    "streams": 607475532,
    "daily": 218768,
    "compilation": false
  },
  {
    "id": "6efyUFJcUK18KRFTMoxNSI",
    "title": "El Concierto",
    "spotifyUrl": "https://open.spotify.com/album/6efyUFJcUK18KRFTMoxNSI",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02169e706f0973015f03f4de97",
    "streams": 583810648,
    "daily": 174314,
    "compilation": false
  },
  {
    "id": "59hPa94rgOLoOBKHz98i7n",
    "title": "Amarte Es Un Placer",
    "spotifyUrl": "https://open.spotify.com/album/59hPa94rgOLoOBKHz98i7n",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021b25e96513de862a69d1c54c",
    "streams": 571781614,
    "daily": 264134,
    "compilation": false
  },
  {
    "id": "2GtCBgC1SYeeb8fcxGWCLo",
    "title": "Vivo",
    "spotifyUrl": "https://open.spotify.com/album/2GtCBgC1SYeeb8fcxGWCLo",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027ceabb44b7d22d151d7af5ea",
    "streams": 467430759,
    "daily": 165878,
    "compilation": false
  },
  {
    "id": "2iHlHuAzbGeMt9J2udUDAl",
    "title": "Romantico Desde Siempre II",
    "spotifyUrl": "https://open.spotify.com/album/2iHlHuAzbGeMt9J2udUDAl",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a394377ddffc909e55f511cb",
    "streams": 445738640,
    "daily": 155730,
    "compilation": false
  },
  {
    "id": "5HooteTWKKPU1GjuOo5Bpf",
    "title": "33",
    "spotifyUrl": "https://open.spotify.com/album/5HooteTWKKPU1GjuOo5Bpf",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e023bc5251815626cf22fc71b30",
    "streams": 397343972,
    "daily": 245841,
    "compilation": false
  },
  {
    "id": "6e7eemEtlg2hi61kjIGDt5",
    "title": "Serie Verde- Luis Miguel",
    "spotifyUrl": "https://open.spotify.com/album/6e7eemEtlg2hi61kjIGDt5",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02979ab05612b62b5d93d5a871",
    "streams": 363457373,
    "daily": 122302,
    "compilation": false
  },
  {
    "id": "0tu9kY2tDMuuuI6GtSDH9i",
    "title": "Navidades Luis Miguel",
    "spotifyUrl": "https://open.spotify.com/album/0tu9kY2tDMuuuI6GtSDH9i",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0227493bf423901995cf6759f7",
    "streams": 321150555,
    "daily": 12447,
    "compilation": false
  },
  {
    "id": "63up1MbRz4A0I8gXD7CAQc",
    "title": "Cómplices (Edición Especial)",
    "spotifyUrl": "https://open.spotify.com/album/63up1MbRz4A0I8gXD7CAQc",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027fb2f087f2e15290947aaf38",
    "streams": 292416338,
    "daily": 162472,
    "compilation": false
  },
  {
    "id": "0PsSywVZE4qeOPBNiSj4Hz",
    "title": "Cómplices",
    "spotifyUrl": "https://open.spotify.com/album/0PsSywVZE4qeOPBNiSj4Hz",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02bff862e2b02cc9e346ab21be",
    "streams": 288297852,
    "daily": 161353,
    "compilation": false
  },
  {
    "id": "0hAqX9l2oj2RQAHLWrilLv",
    "title": "Mis Romances",
    "spotifyUrl": "https://open.spotify.com/album/0hAqX9l2oj2RQAHLWrilLv",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fce696a58c41bc9d3d9135ae",
    "streams": 265900190,
    "daily": 139574,
    "compilation": false
  },
  {
    "id": "0WN5rXI75cVpVMiZ646oyn",
    "title": "Nada Es Igual",
    "spotifyUrl": "https://open.spotify.com/album/0WN5rXI75cVpVMiZ646oyn",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0279444b7e1f30ee546f05d8eb",
    "streams": 244958833,
    "daily": 128427,
    "compilation": false
  },
  {
    "id": "3mO9TKGfnyfWGionNCwYvq",
    "title": "Decidete",
    "spotifyUrl": "https://open.spotify.com/album/3mO9TKGfnyfWGionNCwYvq",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02533be14bc528a3fd480298d5",
    "streams": 180030404,
    "daily": 63136,
    "compilation": false
  },
  {
    "id": "3MpbAt21ozNGRmmLCmP2ed",
    "title": "Luis Miguel (Edición De Lujo)",
    "spotifyUrl": "https://open.spotify.com/album/3MpbAt21ozNGRmmLCmP2ed",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ca8e970862449fcefa51b426",
    "streams": 135314935,
    "daily": 32918,
    "compilation": false
  },
  {
    "id": "1gpyLgIsXBUpq8RVGDSnZF",
    "title": "Luis Miguel",
    "spotifyUrl": "https://open.spotify.com/album/1gpyLgIsXBUpq8RVGDSnZF",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0276e6b80416691da792626a27",
    "streams": 122173546,
    "daily": 31039,
    "compilation": false
  },
  {
    "id": "6nTKGrjZSwfUQdQqAaA4aK",
    "title": "1 + 1 = 2 Enamorados",
    "spotifyUrl": "https://open.spotify.com/album/6nTKGrjZSwfUQdQqAaA4aK",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e020ec4c3781087b6eb7fc68bae",
    "streams": 85961400,
    "daily": 42358,
    "compilation": false
  },
  {
    "id": "7n9YR331Amwqwl0mdOuV9b",
    "title": "Fiebre De Amor",
    "spotifyUrl": "https://open.spotify.com/album/7n9YR331Amwqwl0mdOuV9b",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0221136af456784cf891a684a3",
    "streams": 61574681,
    "daily": 20289,
    "compilation": false
  },
  {
    "id": "1qLSYu2HwnMyirHb6mkN9S",
    "title": "Directo Al Corazon",
    "spotifyUrl": "https://open.spotify.com/album/1qLSYu2HwnMyirHb6mkN9S",
    "coverUrl": "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e020d3ffab389c27b2b73437e10",
    "streams": 58085634,
    "daily": 24368,
    "compilation": false
  },
  {
    "id": "7HO1MyIU1LmgcnL7nCCtRS",
    "title": "No culpes a la noche (Club remixes)",
    "spotifyUrl": "https://open.spotify.com/album/7HO1MyIU1LmgcnL7nCCtRS",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fc7f73043914da2acdc688d1",
    "streams": 42919037,
    "daily": 7670,
    "compilation": false
  },
  {
    "id": "3PIns2QvAPHuDZ807zmHJz",
    "title": "Canta En Italiano",
    "spotifyUrl": "https://open.spotify.com/album/3PIns2QvAPHuDZ807zmHJz",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e025f3a025028b593d016f3bbb1",
    "streams": 28317886,
    "daily": 13797,
    "compilation": false
  },
  {
    "id": "4lwfDQIQOS4cC1Gug3Of8d",
    "title": "Ya Nunca Más",
    "spotifyUrl": "https://open.spotify.com/album/4lwfDQIQOS4cC1Gug3Of8d",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0226b7b27a21817bcb4065ee5d",
    "streams": 13997038,
    "daily": 4052,
    "compilation": false
  },
  {
    "id": "2PrjVzvpPxVU2z6SeyrlYc",
    "title": "Cómplices EP",
    "spotifyUrl": "https://open.spotify.com/album/2PrjVzvpPxVU2z6SeyrlYc",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e024a92688659eb492763107d15",
    "streams": 4118486,
    "daily": 1119,
    "compilation": false
  },
  {
    "id": "0xOOQbCipvzY1Bl62ShFrZ",
    "title": "Tambien Es Rock",
    "spotifyUrl": "https://open.spotify.com/album/0xOOQbCipvzY1Bl62ShFrZ",
    "coverUrl": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02fd8023a649bd6ea5ac40e0be",
    "streams": 1120630,
    "daily": 527,
    "compilation": false
  }
];
