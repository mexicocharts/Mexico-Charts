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
    text(c, W-76, H-35, f"{page} / 7", 8, MUTED, "Helvetica-Bold")
    c.setStrokeColor(LINE); c.line(34, H-50, W-34, H-50)

def footer(c):
    c.setStrokeColor(LINE); c.line(34, 25, W-34, 25)
    text(c, 34, 12, "Datos: Songstats y YouTube / Analisis: Mexico Charts", 6.5, MUTED)
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
    text(c, 44, H-80, "MONITOR / REPORTE SEMANAL", 8, MUTED, "Helvetica-Bold")
    text(c, 44, 330, "PESO", 54, WHITE, "Helvetica-Bold")
    text(c, 44, 275, "PLUMA", 54, WHITE, "Helvetica-Bold")
    text(c, 47, 242, "23 AL 29 AGOSTO 2026", 15, GREEN, "Helvetica-Bold")
    text(c, 47, 214, "Audiencia, video, mercados y comparaciones", 11, MUTED)
    panel(c,44,78,325,95)
    text(c,62,145,"RESUMEN SEMANAL",7,GREEN,"Helvetica-Bold")
    text(c,62,122,"YouTube lidera el crecimiento",13,WHITE,"Helvetica-Bold",286)
    text(c,62,98,"Tendencias 30d y 90d / 5 mercados / 3 videos",8,MUTED)
    text(c, W-126, 42, "PRIVADO", 8, GREEN, "Helvetica-Bold")

def executive_analysis(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Resumen semanal",2)
    text(c,34,H-86,"Resumen de la semana",24,WHITE,"Helvetica-Bold")
    panel(c,34,365,724,105,fill=HexColor("#0A140B"),stroke=HexColor("#245D21"))
    text(c,54,438,"DATO PRINCIPAL",7,GREEN,"Helvetica-Bold")
    text(c,54,405,"YouTube lidera el crecimiento",24,WHITE,"Helvetica-Bold")
    text(c,54,382,"El canal registra +815.7M vistas en 30 dias mientras bajan los oyentes mensuales de Spotify",9,MUTED)
    columns=[
        ("CAMBIOS","YouTube +815.7M", "Spotify perdio 192.4K oyentes mensuales y gano 586.8K seguidores en 30 dias"),
        ("ANALISIS","Catalogo en crecimiento", "El video y los seguidores mantienen cifras positivas mientras bajan los oyentes mensuales"),
        ("RECOMENDACIONES","Preparar nuevos hitos", "BELLAKEO se acerca a 800M y NUEVA VIDA se acerca a 700M vistas"),
    ]
    for i,(k,title,body) in enumerate(columns):
        x=34+i*242; panel(c,x,174,230,167)
        text(c,x+16,316,k,7,GREEN,"Helvetica-Bold")
        text(c,x+16,286,title,15,WHITE,"Helvetica-Bold",198)
        words=body.split(); lines=[]; line=""
        for word in words:
            candidate=(line+" "+word).strip()
            if stringWidth(candidate,"Helvetica",8)>198: lines.append(line); line=word
            else: line=candidate
        if line: lines.append(line)
        for j,value in enumerate(lines[:5]): text(c,x+16,256-j*15,value,8,MUTED)
    text(c,34,143,"PRIORIDAD DE LA SEMANA",7,GREEN,"Helvetica-Bold")
    text(c,34,116,"Preparar contenidos para BELLAKEO 800M y NUEVA VIDA 700M",11,WHITE,"Helvetica-Bold",724)
    text(c,34,91,"Seguimiento: oyentes mensuales de Spotify y crecimiento de los tres videos principales",8,MUTED)
    footer(c)

def audience(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Audiencia y crecimiento",3)
    text(c,34,H-86,"Rendimiento digital",24,WHITE,"Helvetica-Bold")
    cards=[("OYENTES SPOTIFY","44.9M","-192,445 / 30d",RED),("SEGUIDORES SPOTIFY","30.0M","+586,808 / 30d",GREEN),("VISTAS YOUTUBE","13.1B","+815.7M / 30d",GREEN),("INSTAGRAM","16.5M","-80,056 / 30d",RED)]
    for i,(label,value,delta,color) in enumerate(cards):
        x=34+i*181; panel(c,x,H-190,169,85); text(c,x+14,H-125,label,6.5,MUTED,"Helvetica-Bold"); text(c,x+14,H-155,value,24,WHITE,"Helvetica-Bold"); text(c,x+14,H-174,delta,7,color,"Helvetica-Bold")
    panel(c,34,84,724,245); text(c,52,303,"OYENTES MENSUALES SPOTIFY / 90 DIAS",7,GREEN,"Helvetica-Bold")
    text(c,52,278,"47.1M -> 44.9M",19,WHITE,"Helvetica-Bold"); text(c,215,281,"-4.64%",10,RED,"Helvetica-Bold")
    sparkline(c,spotify,54,118,676,118)
    text(c,54,101,"30 MAY",6.5,MUTED,"Helvetica-Bold"); text(c,694,101,"28 AGO",6.5,MUTED,"Helvetica-Bold")
    footer(c)

def video_page(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Videos e hitos",4)
    text(c,34,H-86,"Videos con mayor actividad",22,WHITE,"Helvetica-Bold")
    for i,(title,views,delta,interval,filename) in enumerate(videos):
        x=34+i*242; panel(c,x,242,230,240); image(c,IMG/filename,x+12,348,206,116)
        text(c,x+14,324,f"0{i+1} / {title}",9,WHITE,"Helvetica-Bold"); text(c,x+14,292,compact(views),23,WHITE,"Helvetica-Bold")
        text(c,x+14,276,"VISTAS ACUMULADAS",6.5,MUTED,"Helvetica-Bold"); text(c,x+14,253,f"+{delta:,} / {interval}",8,GREEN,"Helvetica-Bold")
    panel(c,34,70,724,145,fill=HexColor("#0A140B"),stroke=HexColor("#245D21")); text(c,54,185,"PROXIMO HITO / BELLAKEO",7,GREEN,"Helvetica-Bold")
    text(c,54,146,"755,225,298",29,WHITE,"Helvetica-Bold"); text(c,54,124,"94.4% hacia 800M / faltan 44,774,702",9,MUTED,"Helvetica-Bold")
    c.setFillColor(LINE); c.roundRect(54,96,650,8,4,fill=1,stroke=0); c.setFillColor(GREEN); c.roundRect(54,96,614,8,4,fill=1,stroke=0)
    text(c,54,79,"Ultima lectura: +14,623 vistas en 67 min",7,MUTED)
    footer(c)

def markets(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Mercados, comparaciones y alertas",5)
    text(c,34,H-86,"Mercados y rendimiento comparado",22,WHITE,"Helvetica-Bold")
    panel(c,34,202,355,280); text(c,52,454,"TOP MERCADOS MEXICO / SPOTIFY",7,GREEN,"Helvetica-Bold")
    for i,(name,current,peak) in enumerate(cities):
        y=410-i*43; text(c,52,y,f"0{i+1}",7,GREEN,"Helvetica-Bold"); text(c,75,y,name,9,WHITE,"Helvetica-Bold"); text(c,262,y,f"{current:,}",8,WHITE,"Helvetica-Bold")
        c.setFillColor(LINE); c.roundRect(75,y-12,270,5,2,fill=1,stroke=0); c.setFillColor(GREEN); c.roundRect(75,y-12,270*current/cities[0][1],5,2,fill=1,stroke=0)
    panel(c,403,202,355,280); text(c,421,454,"COMPARACION / DATOS DEL 29 AGO",7,GREEN,"Helvetica-Bold")
    text(c,421,428,"ARTISTA",6,MUTED,"Helvetica-Bold"); text(c,545,428,"OYENTES",6,MUTED,"Helvetica-Bold"); text(c,615,428,"SPOTIFY 30D",6,MUTED,"Helvetica-Bold"); text(c,700,428,"YT 30D",6,MUTED,"Helvetica-Bold")
    for i,(name,listeners,sp30,yt30) in enumerate(bench):
        y=394-i*47; text(c,421,y,name,9,WHITE,"Helvetica-Bold"); text(c,545,y,compact(listeners),8,WHITE,"Helvetica-Bold"); text(c,615,y,("+" if sp30>=0 else "-")+compact(abs(sp30)),8,GREEN if sp30>=0 else RED,"Helvetica-Bold"); text(c,700,y,"+"+compact(yt30),8,GREEN,"Helvetica-Bold")
    text(c,34,170,"ALERTAS DEL CORTE",7,GREEN,"Helvetica-Bold")
    alerts=[("YOUTUBE +100M / 30D","ACTIVADA",GREEN),("OYENTES SPOTIFY <45M","ACTIVADA",GREEN),("INSTAGRAM CAMBIA +/-1%","SIN DISPARAR",MUTED)]
    for i,(label,status,color) in enumerate(alerts):
        x=34+i*242; panel(c,x,78,230,70); text(c,x+14,119,label,7,WHITE,"Helvetica-Bold"); text(c,x+14,96,status.replace("DISPARAR","CAMBIOS"),7,color,"Helvetica-Bold")
    footer(c)

def benchmark_actions(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Comparacion y recomendaciones",6)
    text(c,34,H-86,"Rendimiento frente a otros artistas",22,WHITE,"Helvetica-Bold")
    cards=[
        ("OYENTES","#1","44.9M oyentes / 77% mas que Natanael Cano"),
        ("YOUTUBE 30D","2.6X","502.7M mas vistas que el segundo lugar"),
        ("SPOTIFY 30D","-192K","Unico artista del grupo con oyentes a la baja"),
    ]
    for i,(label,value,body) in enumerate(cards):
        x=34+i*242; panel(c,x,350,230,122)
        text(c,x+16,444,label,7,GREEN,"Helvetica-Bold")
        text(c,x+16,405,value,25,WHITE,"Helvetica-Bold")
        text(c,x+16,376,body,8,MUTED,"Helvetica",196)
    panel(c,34,92,724,230)
    text(c,54,292,"RECOMENDACIONES / PROXIMA SEMANA",7,GREEN,"Helvetica-Bold")
    actions=[
        ("01","PREPARAR HITOS","BELLAKEO 800M y NUEVA VIDA 700M"),
        ("02","IMPULSAR SPOTIFY","Reforzar playlists, colaboraciones y contenido corto"),
        ("03","SEGUIR PUEBLA","Es el mercado Top 5 mas cerca de su pico historico"),
        ("04","MEDIR EL PROXIMO ESTRENO","Usar 44.9M oyentes como punto de comparacion"),
    ]
    for i,(num,title,body) in enumerate(actions):
        col=i%2; row=i//2; x=54+col*350; y=248-row*80
        text(c,x,y,num,8,GREEN,"Helvetica-Bold"); text(c,x+30,y,title,9,WHITE,"Helvetica-Bold")
        text(c,x+30,y-20,body,7.5,MUTED,"Helvetica",285)
    text(c,54,111,"Recomendaciones de Mexico Charts basadas en los datos del corte semanal",7,MUTED)
    footer(c)

def appendix(c):
    c.setFillColor(BG); c.rect(0,0,W,H,fill=1,stroke=0); header(c,"Datos y fuentes",7)
    text(c,34,H-86,"Cifras exactas del reporte",22,WHITE,"Helvetica-Bold")
    panel(c,34,248,355,230); text(c,52,450,"METRICAS DEL CORTE",7,GREEN,"Helvetica-Bold")
    rows=[
        ("Oyentes mensuales Spotify","44,948,653","-192,445 / 30d"),
        ("Seguidores Spotify","30,018,680","+586,808 / 30d"),
        ("Vistas totales YouTube","13,125,619,666","+815,716,080 / 30d"),
        ("Seguidores Instagram","16,453,239","-80,056 / 30d"),
        ("Seguidores TikTok","9,417,158","-50,650 / 30d"),
    ]
    for i,(label,value,delta) in enumerate(rows):
        y=416-i*37; text(c,52,y,label,7.5,MUTED); text(c,201,y,value,8,WHITE,"Helvetica-Bold"); text(c,302,y,delta,7,GREEN if delta.startswith("+") else RED,"Helvetica-Bold")
    panel(c,403,248,355,230); text(c,421,450,"FUENTES",7,GREEN,"Helvetica-Bold")
    notes=[
        "Songstats: audiencia y estadisticas de plataformas",
        "YouTube: conteos guardados por video y canal",
        "Cambios 30d y 90d: diferencia entre fechas guardadas",
        "Comparaciones: mismo corte para los tres artistas",
        "Las vistas no se estiman entre actualizaciones",
    ]
    for i,note in enumerate(notes):
        y=410-i*38; text(c,421,y,f"0{i+1}",7,GREEN,"Helvetica-Bold"); text(c,448,y,note,7.5,MUTED,"Helvetica",285)
    panel(c,34,78,724,140,fill=HexColor("#0A140B"),stroke=HexColor("#245D21"))
    text(c,54,187,"NOTAS",7,GREEN,"Helvetica-Bold")
    text(c,54,158,"Cifras de plataforma",10,WHITE,"Helvetica-Bold"); text(c,171,158,"Songstats y YouTube",10,MUTED)
    text(c,54,137,"Analisis y comparaciones",10,WHITE,"Helvetica-Bold"); text(c,205,137,"Mexico Charts",10,MUTED)
    text(c,54,105,"Proximo reporte: 5 SEP 2026 / Frecuencia semanal",8,WHITE,"Helvetica-Bold")
    footer(c)

def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
    for fn in (cover,executive_analysis,audience,video_page,markets,benchmark_actions,appendix): fn(c); c.showPage()
    c.save(); print(OUT)

if __name__ == "__main__": main()
