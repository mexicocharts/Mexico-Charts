from pathlib import Path
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/mexico-charts/public/reports/peso-pluma-monitor-agosto-2026.pdf"
IMG = ROOT / "tmp/pdfs/peso-monitor"
W, H = landscape(letter)
BG, PANEL, LINE = HexColor("#050505"), HexColor("#101010"), HexColor("#292929")
WHITE, MUTED, GREEN, RED = HexColor("#FFFFFF"), HexColor("#8B8B8B"), HexColor("#39FF14"), HexColor("#FF5C68")

spotify = [47137843,46993944,46940324,46835086,46892803,46561657,46404479,46208568,46153745,46146395,46221969,46230214,45947648,45581642,45656833,45640802,45598515,45369656,45302897,45164232,45101438,45078446,45186883,45056684,45053879,45159905,45252609,45217465,45026445,44948653]
cities = [("Ciudad de Mexico",3997897,5566817),("Guadalajara",1435286,1958210),("Puebla",1344685,1643004),("Monterrey",1014895,1340069),("Zapopan",985815,1224283)]
bench = [("Peso Pluma",44948653,-192445,815716080),("Natanael Cano",25334693,476327,313000517),("Luis Miguel",22041391,629267,310769062)]
videos = [("BELLAKEO",755225298,14623,"67 min","bellakeo.jpg"),("NUEVA VIDA",656329575,25773,"62 min","nueva-vida.jpg"),("HOLLYWOOD",481069561,2259086,"111 h","hollywood.jpg")]

def compact(n):
    if abs(n) >= 1_000_000_000: return f"{n/1_000_000_000:.1f}B"
    if abs(n) >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if abs(n) >= 1_000: return f"{n/1_000:.1f}K"
    return f"{n:,}"

def text(c, x, y, value, size=10, color=WHITE, font="Helvetica", max_width=None):
    c.setFillColor(color); c.setFont(font, size)
    if max_width and stringWidth(value, font, size) > max_width:
        while size > 6 and stringWidth(value, font, size) > max_width: size -= .5
        c.setFont(font, size)
    c.drawString(x, y, value)

def panel(c, x, y, w, h, radius=12, fill=PANEL, stroke=LINE):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(.7)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

def image(c, path, x, y, w, h):
    if path.exists():
        c.drawImage(ImageReader(str(path)), x, y, w, h, preserveAspectRatio=True, anchor="c", mask="auto")

def header(c, section, page):
    text(c, 34, H-28, "MEXICO CHARTS / MONITOR", 8, GREEN, "Helvetica-Bold")
    text(c, 34, H-42, section.upper(), 8, MUTED, "Helvetica-Bold")
    text(c, W-76, H-35, f"{page} / 4", 8, MUTED, "Helvetica-Bold")
    c.setStrokeColor(LINE); c.line(34, H-50, W-34, H-50)

def footer(c):
    c.setStrokeColor(LINE); c.line(34, 25, W-34, 25)
    text(c, 34, 12, "Datos directos: snapshots almacenados de Songstats y YouTube. Analisis y comparaciones: Mexico Charts.", 6.5, MUTED)
    text(c, W-170, 12, "CORTE: 29 AGO 2026", 6.5, MUTED, "Helvetica-Bold")

def sparkline(c, values, x, y, w, h, color=GREEN):
    lo, hi = min(values), max(values); span = max(1, hi-lo)
    pts = [(x+i*w/(len(values)-1), y+(v-lo)*h/span) for i,v in enumerate(values)]
    c.setFillColor(Color(color.red,color.green,color.blue,alpha=.10)); path=c.beginPath(); path.moveTo(x,y)
    for px,py in pts: path.lineTo(px,py)
    path.lineTo(x+w,y); path.close(); c.drawPath(path,fill=1,stroke=0)
    c.setStrokeColor(color); c.setLineWidth(2); path=c.beginPath(); path.moveTo(*pts[0])
    for p in pts[1:]: path.lineTo(*p)
    c.drawPath(path,fill=0,stroke=1)

def cover(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0)
    image(c, IMG/"peso.jpg", W-330, 70, 285, 470)
    c.setFillColor(Color(0,0,0,alpha=.55)); c.rect(W-410,0,410,H,fill=1,stroke=0)
    text(c, 44, H-58, "MEXICO CHARTS", 10, GREEN, "Helvetica-Bold")
    text(c, 44, H-80, "MONITOR / REPORTE EJECUTIVO", 8, MUTED, "Helvetica-Bold")
    text(c, 44, 330, "PESO", 54, WHITE, "Helvetica-Bold")
    text(c, 44, 275, "PLUMA", 54, WHITE, "Helvetica-Bold")
    text(c, 47, 242, "AGOSTO 2026", 15, GREEN, "Helvetica-Bold")
    text(c, 47, 214, "Audiencia, video, mercados y senales accionables", 11, MUTED)
    panel(c,44,78,325,95)
    text(c,62,145,"LECTURA EJECUTIVA",7,GREEN,"Helvetica-Bold")
    text(c,62,122,"YouTube acelera; Spotify ajusta alcance mensual",13,WHITE,"Helvetica-Bold",286)
    text(c,62,98,"30 lecturas historicas / 5 mercados MX / 3 videos destacados",8,MUTED)
    text(c, W-126, 42, "PRIVADO", 8, GREEN, "Helvetica-Bold")

def audience(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Audiencia y crecimiento",2)
    text(c,34,H-86,"Escala actual",24,WHITE,"Helvetica-Bold")
    cards=[("OYENTES SPOTIFY","44.9M","-192,445 / 30d",RED),("SEGUIDORES SPOTIFY","30.0M","+586,808 / 30d",GREEN),("VISTAS YOUTUBE","13.1B","+815.7M / 30d",GREEN),("INSTAGRAM","16.5M","-80,056 / 30d",RED)]
    for i,(label,value,delta,color) in enumerate(cards):
        x=34+i*181; panel(c,x,H-190,169,85); text(c,x+14,H-125,label,6.5,MUTED,"Helvetica-Bold"); text(c,x+14,H-155,value,24,WHITE,"Helvetica-Bold"); text(c,x+14,H-174,delta,7,color,"Helvetica-Bold")
    panel(c,34,84,724,245); text(c,52,303,"OYENTES MENSUALES SPOTIFY / 90 DIAS",7,GREEN,"Helvetica-Bold")
    text(c,52,278,"47.1M -> 44.9M",19,WHITE,"Helvetica-Bold"); text(c,215,281,"-4.64%",10,RED,"Helvetica-Bold")
    sparkline(c,spotify,54,118,676,118)
    text(c,54,101,"30 MAY",6.5,MUTED,"Helvetica-Bold"); text(c,694,101,"28 AGO",6.5,MUTED,"Helvetica-Bold")
    footer(c)

def video_page(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Video Pulse y hitos",3)
    text(c,34,H-86,"Catalogo que esta moviendo la conversacion",22,WHITE,"Helvetica-Bold")
    for i,(title,views,delta,interval,filename) in enumerate(videos):
        x=34+i*242; panel(c,x,242,230,240); image(c,IMG/filename,x+12,348,206,116)
        text(c,x+14,324,f"0{i+1} / {title}",9,WHITE,"Helvetica-Bold"); text(c,x+14,292,compact(views),23,WHITE,"Helvetica-Bold")
        text(c,x+14,276,"VISTAS ACUMULADAS",6.5,MUTED,"Helvetica-Bold"); text(c,x+14,253,f"+{delta:,} / {interval}",8,GREEN,"Helvetica-Bold")
    panel(c,34,70,724,145,fill=HexColor("#0A140B"),stroke=HexColor("#245D21")); text(c,54,185,"PROXIMO HITO / BELLAKEO",7,GREEN,"Helvetica-Bold")
    text(c,54,146,"755,225,298",29,WHITE,"Helvetica-Bold"); text(c,54,124,"94.4% hacia 800M / faltan 44,774,702",9,MUTED,"Helvetica-Bold")
    c.setFillColor(LINE); c.roundRect(54,96,650,8,4,fill=1,stroke=0); c.setFillColor(GREEN); c.roundRect(54,96,614,8,4,fill=1,stroke=0)
    text(c,54,79,"Ultimo movimiento exacto: +14,623 entre lecturas separadas por 67 min. Sin proyeccion.",7,MUTED)
    footer(c)

def markets(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Mercados, benchmarks y alertas",4)
    text(c,34,H-86,"Donde esta la audiencia y que exige atencion",22,WHITE,"Helvetica-Bold")
    panel(c,34,202,355,280); text(c,52,454,"TOP MERCADOS MEXICO / SPOTIFY",7,GREEN,"Helvetica-Bold")
    for i,(name,current,peak) in enumerate(cities):
        y=410-i*43; text(c,52,y,f"0{i+1}",7,GREEN,"Helvetica-Bold"); text(c,75,y,name,9,WHITE,"Helvetica-Bold"); text(c,262,y,f"{current:,}",8,WHITE,"Helvetica-Bold")
        c.setFillColor(LINE); c.roundRect(75,y-12,270,5,2,fill=1,stroke=0); c.setFillColor(GREEN); c.roundRect(75,y-12,270*current/cities[0][1],5,2,fill=1,stroke=0)
    panel(c,403,202,355,280); text(c,421,454,"BENCHMARK / LECTURA DEL 29 AGO",7,GREEN,"Helvetica-Bold")
    text(c,421,428,"ARTISTA",6,MUTED,"Helvetica-Bold"); text(c,545,428,"OYENTES",6,MUTED,"Helvetica-Bold"); text(c,615,428,"SPOTIFY 30D",6,MUTED,"Helvetica-Bold"); text(c,700,428,"YT 30D",6,MUTED,"Helvetica-Bold")
    for i,(name,listeners,sp30,yt30) in enumerate(bench):
        y=394-i*47; text(c,421,y,name,9,WHITE,"Helvetica-Bold"); text(c,545,y,compact(listeners),8,WHITE,"Helvetica-Bold"); text(c,615,y,("+" if sp30>=0 else "-")+compact(abs(sp30)),8,GREEN if sp30>=0 else RED,"Helvetica-Bold"); text(c,700,y,"+"+compact(yt30),8,GREEN,"Helvetica-Bold")
    text(c,34,170,"ALERTAS DEL CORTE",7,GREEN,"Helvetica-Bold")
    alerts=[("YOUTUBE +100M / 30D","ACTIVADA",GREEN),("OYENTES SPOTIFY <45M","ACTIVADA",GREEN),("INSTAGRAM CAMBIA +/-1%","SIN DISPARAR",MUTED)]
    for i,(label,status,color) in enumerate(alerts):
        x=34+i*242; panel(c,x,78,230,70); text(c,x+14,119,label,7,WHITE,"Helvetica-Bold"); text(c,x+14,96,status,7,color,"Helvetica-Bold")
    footer(c)

def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
    for fn in (cover,audience,video_page,markets): fn(c); c.showPage()
    c.save(); print(OUT)

if __name__ == "__main__": main()
