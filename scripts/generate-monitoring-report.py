#!/usr/bin/env python3
"""Generate a customer-ready Mexico Charts monthly artist monitoring PDF."""

from __future__ import annotations

import argparse
import io
import json
import math
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


W, H = letter
INK = colors.HexColor("#0A0A0A")
PAPER = colors.HexColor("#F3F1EA")
GREEN = colors.HexColor("#39FF14")
GREEN_DARK = colors.HexColor("#178A0A")
WHITE = colors.white
MUTED = colors.HexColor("#686868")
LIGHT = colors.HexColor("#E2E0D8")
PANEL = colors.HexColor("#141414")
PANEL_RAISED = colors.HexColor("#202020")
ON_DARK_MUTED = colors.HexColor("#A7A7A7")
RULE = colors.HexColor("#333333")
NEGATIVE = colors.HexColor("#FF6B5F")


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "MexicoChartsReport/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_image(url: str | None) -> ImageReader | None:
    if not url:
        return None
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "MexicoChartsReport/1.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            return ImageReader(io.BytesIO(response.read()))
    except Exception:
        return None


def compact(value: int | float | None) -> str:
    if value is None:
        return "No disponible"
    number = float(value)
    for divisor, suffix in ((1_000_000_000, "B"), (1_000_000, "M"), (1_000, "K")):
        if abs(number) >= divisor:
            scaled = number / divisor
            decimals = 0 if abs(scaled) >= 100 else 1
            return f"{scaled:.{decimals}f}{suffix}"
    return f"{int(number):,}"


def localized_city_name(name: str) -> str:
    return {
        "Mexico City": "Ciudad de México",
    }.get(name, name)


def signed(value: int | float | None) -> str:
    if value is None:
        return "No disponible"
    return f"{value:+,.0f}"


def pct(value: int | float | None) -> str:
    if value is None:
        return "No disponible"
    return f"{value:+.2f}%"


def spanish_date(raw: str | None) -> str:
    if not raw:
        return "Fecha no disponible"
    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return f"{parsed.day} de {months[parsed.month - 1]} de {parsed.year}"


def para(c: canvas.Canvas, text: str, x: float, y_top: float, width: float, *, size: float = 10, leading: float = 14, color=MUTED, bold: bool = False) -> float:
    style = ParagraphStyle(
        "report",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, H)
    paragraph.drawOn(c, x, y_top - height)
    return height


def footer(c: canvas.Canvas, page: int, snapshot_date: str | None) -> None:
    c.setStrokeColor(RULE)
    c.line(42, 35, W - 42, 35)
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(42, 22, f"MEXICO CHARTS MONITOR - Datos al {spanish_date(snapshot_date)}")
    c.drawRightString(W - 42, 22, f"PAGINA {page}")


def metric_card(c: canvas.Canvas, x: float, y: float, width: float, label: str, value: str, detail: str = "") -> None:
    c.setFillColor(PANEL)
    c.roundRect(x, y, width, 76, 8, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 14, y + 57, label.upper())
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 19)
    c.drawString(x + 14, y + 30, value)
    if detail:
        c.setFillColor(ON_DARK_MUTED)
        c.setFont("Helvetica", 7)
        c.drawString(x + 14, y + 14, detail)


def draw_line_chart(c: canvas.Canvas, x: float, y: float, width: float, height: float, points: list[dict], title: str, color=GREEN) -> None:
    c.setFillColor(PANEL)
    c.roundRect(x, y, width, height, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 15, y + height - 21, title)
    if len(points) < 2:
        c.setFillColor(ON_DARK_MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(x + 15, y + height / 2, "Historial insuficiente")
        return
    values = [float(point["value"]) for point in points]
    low, high = min(values), max(values)
    span = max(high - low, 1)
    chart_x, chart_y = x + 15, y + 24
    chart_w, chart_h = width - 30, height - 58
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    for row in range(3):
        grid_y = chart_y + chart_h * row / 2
        c.line(chart_x, grid_y, chart_x + chart_w, grid_y)
    coords = []
    for index, value in enumerate(values):
        px = chart_x + chart_w * index / (len(values) - 1)
        py = chart_y + chart_h * (value - low) / span
        coords.append((px, py))
    c.setStrokeColor(color)
    c.setLineWidth(2)
    path = c.beginPath()
    path.moveTo(*coords[0])
    for point in coords[1:]:
        path.lineTo(*point)
    c.drawPath(path, stroke=1, fill=0)
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica", 6.5)
    c.drawString(chart_x, y + 10, points[0]["date"])
    c.drawRightString(chart_x + chart_w, y + 10, points[-1]["date"])
    c.setFont("Helvetica-Bold", 7)
    c.drawRightString(x + width - 15, y + height - 21, f"{compact(values[0])}  >  {compact(values[-1])}")


def growth_cell(c: canvas.Canvas, x: float, y: float, width: float, label: str, window: dict | None) -> None:
    c.setFillColor(PANEL)
    c.roundRect(x, y, width, 45, 5, fill=1, stroke=0)
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 10, y + 29, label)
    percentage = window.get("percentage") if window else None
    c.setFillColor(GREEN if percentage is not None and percentage >= 0 else NEGATIVE)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 10, y + 11, pct(percentage))


def generate_report(data: dict, youtube: dict | None, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    snapshot = data.get("snapshot") or {}
    growth = data.get("growth") or {}
    trends = data.get("trends") or {}
    cities = data.get("topMexicoCities") or []
    name = data.get("name") or "Artista"
    avatar = fetch_image(data.get("avatarUrl"))
    official_yt_subs = (youtube or {}).get("subscriberCount")
    official_yt_views = (youtube or {}).get("viewCount")
    official_yt_growth = ((youtube or {}).get("analytics") or {}).get("subscribers") or {}
    snapshot_date = snapshot.get("snapshotDate")

    c = canvas.Canvas(str(output), pagesize=letter)
    c.setTitle(f"Mexico Charts Monitor - {name} - {snapshot_date or date.today().isoformat()}")
    c.setAuthor("Mexico Charts")
    c.setSubject("Reporte mensual de monitoreo de artista")

    # Cover
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#10200C"))
    c.circle(W + 10, H - 30, 250, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.rect(0, H - 9, W, 9, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48, H - 56, "MEXICO CHARTS  /  MONITOR")
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, H - 99, "REPORTE MENSUAL DE ARTISTA")
    c.setFillColor(WHITE)
    cover_size = 52
    while stringWidth(name.upper(), "Helvetica-Bold", cover_size) > W - 96 and cover_size > 28:
        cover_size -= 2
    c.setFont("Helvetica-Bold", cover_size)
    c.drawString(48, H - 158, name.upper())
    c.setFillColor(colors.HexColor("#9B9B9B"))
    c.setFont("Helvetica", 13)
    c.drawString(48, H - 188, f"Corte de datos: {spanish_date(snapshot_date)}")
    if avatar:
        c.saveState()
        c.circle(W - 112, H - 230, 64, fill=0, stroke=0)
        clip = c.beginPath()
        clip.circle(W - 112, H - 230, 64)
        c.clipPath(clip, stroke=0, fill=0)
        c.drawImage(avatar, W - 176, H - 294, 128, 128, preserveAspectRatio=True, anchor="c", mask="auto")
        c.restoreState()

    c.setFillColor(colors.HexColor("#141414"))
    c.roundRect(48, 240, W - 96, 242, 12, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(70, 448, "RESUMEN DEL MES")
    spotify_30 = (growth.get("spotifyMonthlyListeners") or {}).get("days30") or {}
    tiktok_30 = (growth.get("tiktokFollowers") or {}).get("days30") or {}
    yt_30_abs = official_yt_growth.get("monthlyGrowth")
    summary = (
        f"{name} registra {compact(snapshot.get('spotifyMonthlyListeners'))} oyentes mensuales en Spotify. "
        f"En los últimos 30 días, los oyentes cambiaron {pct(spotify_30.get('percentage'))} "
        f"({signed(spotify_30.get('absolute'))}). TikTok avanzó {pct(tiktok_30.get('percentage'))}. "
        + (f"El canal oficial de YouTube sumó {signed(yt_30_abs)} suscriptores en el periodo. " if yt_30_abs is not None else "")
        + (f"La principal ciudad mexicana por oyentes es {localized_city_name(cities[0]['name'])}, con {compact(cities[0]['currentListeners'])}." if cities else "La fuente no proporcionó ciudades mexicanas para este corte.")
    )
    para(c, summary, 70, 422, W - 140, size=11, leading=18, color=colors.HexColor("#CECECE"))
    c.setFillColor(colors.HexColor("#222222"))
    c.roundRect(70, 267, W - 140, 82, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(88, 311, compact(snapshot.get("spotifyMonthlyListeners")))
    c.drawString(250, 311, compact(snapshot.get("spotifyFollowers")))
    c.drawString(412, 311, compact(official_yt_subs))
    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(88, 290, "OYENTES SPOTIFY")
    c.drawString(250, 290, "SEGUIDORES SPOTIFY")
    c.drawString(412, 290, "SUSCRIPTORES YOUTUBE OFICIAL")
    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica", 8)
    c.drawString(48, 60, "Reporte preparado para el suscriptor. Uso personal o interno.")
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(W - 48, 60, "MEXICOCHART.COM")
    c.showPage()

    # Current audience
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, H - 52, "01 / AUDIENCIA ACTUAL")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 29)
    c.drawString(42, H - 86, "PANORAMA DE PLATAFORMAS")
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(42, H - 106, "Cifras disponibles en el corte más reciente; un dato ausente no equivale a cero.")
    metrics = [
        ("Oyentes mensuales Spotify", compact(snapshot.get("spotifyMonthlyListeners")), "Corte licenciado"),
        ("Seguidores Spotify", compact(snapshot.get("spotifyFollowers")), "Corte licenciado"),
        ("Suscriptores YouTube", compact(official_yt_subs), "Canal oficial registrado"),
        ("Vistas YouTube", compact(official_yt_views), "Canal oficial registrado"),
        ("Seguidores Instagram", compact(snapshot.get("instagramFollowers")), "Corte licenciado"),
        ("Seguidores TikTok", compact(snapshot.get("tiktokFollowers")), "Corte licenciado"),
        ("Seguidores Facebook", compact(snapshot.get("facebookFollowers")), "Corte licenciado"),
        ("Fans Deezer", compact(snapshot.get("deezerFollowers")), "Corte licenciado"),
    ]
    for index, (label, value, detail) in enumerate(metrics):
        col, row = index % 2, index // 2
        metric_card(c, 42 + col * 264, H - 214 - row * 90, 250, label, value, detail)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(42, 272, "MOVIMIENTO POR PERIODO")
    growth_rows = [
        ("Oyentes Spotify", growth.get("spotifyMonthlyListeners") or {}),
        ("Seguidores Spotify", growth.get("spotifyFollowers") or {}),
        ("Instagram", growth.get("instagramFollowers") or {}),
        ("TikTok", growth.get("tiktokFollowers") or {}),
    ]
    y = 215
    for label, windows in growth_rows:
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(42, y + 17, label.upper())
        for idx, key in enumerate(("days7", "days30", "days90")):
            growth_cell(c, 180 + idx * 123, y, 112, ("7 DIAS", "30 DIAS", "90 DIAS")[idx], windows.get(key))
        y -= 52
    footer(c, 2, snapshot_date)
    c.showPage()

    # Trends
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, H - 52, "02 / EVOLUCION")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 29)
    c.drawString(42, H - 86, "SEIS MESES EN CONTEXTO")
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(42, H - 106, "Las líneas muestran snapshots periódicos guardados por Mexico Charts.")
    draw_line_chart(c, 42, 470, 528, 170, trends.get("spotifyMonthlyListeners") or [], "OYENTES MENSUALES SPOTIFY")
    draw_line_chart(c, 42, 275, 255, 170, trends.get("instagramFollowers") or [], "SEGUIDORES INSTAGRAM", colors.HexColor("#A83371"))
    draw_line_chart(c, 315, 275, 255, 170, trends.get("tiktokFollowers") or [], "SEGUIDORES TIKTOK", WHITE)
    c.setFillColor(PANEL)
    c.roundRect(42, 85, 528, 160, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(60, 218, "LECTURA DEL MES")
    insights = []
    if spotify_30.get("percentage") is not None:
        direction = "creció" if spotify_30["percentage"] >= 0 else "disminuyó"
        insights.append(f"La audiencia mensual de Spotify {direction} {abs(spotify_30['percentage']):.2f}% en 30 días.")
    if tiktok_30.get("percentage") is not None:
        insights.append(f"TikTok cambió {pct(tiktok_30['percentage'])}, equivalente a {signed(tiktok_30.get('absolute'))} seguidores.")
    insta_30 = (growth.get("instagramFollowers") or {}).get("days30") or {}
    if insta_30.get("percentage") is not None:
        insights.append(f"Instagram cambió {pct(insta_30['percentage'])} durante el mismo periodo.")
    para(c, "<br/>".join(f"• {item}" for item in insights) or "No hay ventanas comparables suficientes para este corte.", 60, 195, 492, size=10, leading=18, color=ON_DARK_MUTED)
    footer(c, 3, snapshot_date)
    c.showPage()

    # Mexico and methodology
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, H - 52, "03 / MEXICO Y METODOLOGIA")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 29)
    c.drawString(42, H - 86, "AUDIENCIA EN MEXICO")
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(42, H - 106, "Principales ciudades disponibles para el artista en el corte actual.")
    max_city = max((city.get("currentListeners") or 0 for city in cities), default=1)
    y = 620
    for rank, city in enumerate(cities[:5], 1):
        value = city.get("currentListeners") or 0
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(42, y + 13, f"{rank:02d}")
        c.drawString(74, y + 13, localized_city_name(city.get("name") or "Ciudad"))
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(W - 42, y + 13, compact(value))
        c.setFillColor(RULE)
        c.roundRect(74, y - 1, W - 158, 6, 3, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.roundRect(74, y - 1, (W - 158) * value / max_city, 6, 3, fill=1, stroke=0)
        y -= 55

    c.setFillColor(PANEL)
    c.roundRect(42, 188, 528, 160, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(60, 318, "COMO LEER ESTE REPORTE")
    methodology = (
        "Mexico Charts combina métricas seleccionadas de acceso licenciado con fuentes oficiales vinculadas al registro correcto del artista. "
        "Los cambios se calculan sobre snapshots guardados. Para YouTube, este reporte prioriza el canal oficial registrado y no suma canales temáticos o ajenos. "
        "Las fechas de corte pueden variar por plataforma. Un campo ausente se omite o se marca como no disponible; nunca se interpreta automáticamente como cero."
    )
    para(c, methodology, 60, 296, 492, size=9.5, leading=16, color=ON_DARK_MUTED)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(42, 150, "FUENTES Y CORTE")
    c.setFillColor(ON_DARK_MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(42, 132, f"Datos de audiencia e historial: acceso licenciado - corte {spanish_date(snapshot_date)}")
    c.drawString(42, 117, f"YouTube: canal oficial {((youtube or {}).get('title') or 'no disponible')} - corte {spanish_date((youtube or {}).get('snapshotDate'))}")
    c.drawString(42, 102, "Cálculos, normalización y presentación: Mexico Charts")
    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica", 7)
    c.drawString(42, 70, "Este informe es informativo y no implica afiliación, autorización o respaldo del artista.")
    footer(c, 4, snapshot_date)
    c.showPage()

    c.save()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artist-key", required=True, help="Catalog artist key, e.g. 'luis miguel'")
    parser.add_argument("--base-url", default="https://mexicochart.com")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    query = urllib.parse.urlencode({"artistKey": args.artist_key})
    data = fetch_json(f"{args.base_url.rstrip('/')}/api/providers/songstats/artist?{query}")
    try:
        youtube = fetch_json(f"{args.base_url.rstrip('/')}/api/providers/youtube/channel?{query}")
    except Exception:
        youtube = None
    generate_report(data, youtube, Path(args.output))


if __name__ == "__main__":
    main()
