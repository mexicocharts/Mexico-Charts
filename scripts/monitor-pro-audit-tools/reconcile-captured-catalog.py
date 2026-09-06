"""Offline captured-Kworb document reconciliation; no network or database access."""
import re, hashlib
from html.parser import HTMLParser
class Table(HTMLParser):
 def __init__(self):
  super().__init__();self.active=False;self.tables=0;self.row=None;self.cell=None;self.rows=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='table' and 'addpos' in a.get('class','').split():self.active=True;self.tables+=1
  if not self.active:return
  if tag=='tr':self.row=[]
  if tag=='td' and self.row is not None:self.cell={'text':'','links':[]}
  if tag=='a' and self.cell is not None:self.cell['links'].append(a.get('href',''))
 def handle_data(self,s):
  if self.cell is not None:self.cell['text']+=s
 def handle_endtag(self,t):
  if t=='td' and self.cell is not None:self.row.append(self.cell);self.cell=None
  if t=='tr' and self.row is not None:
   if self.row:self.rows.append(self.row)
   self.row=None
  if t=='table':self.active=False

def reconcile_document(body,meta):
 assert hashlib.sha256(body).hexdigest()==meta['sha256'] and len(body)==meta['bytes'],'capture representation changed'
 assert meta['httpStatus']==200 and meta['fetchedAt'],'unsuccessful or undated capture'
 kind={'songs':'track','albums':'album'}[meta['kind']]
 assert re.fullmatch(r'https://kworb.net/spotify/artist/'+re.escape(meta['spotifyId'])+'_'+meta['kind']+r'\.html',meta['url'])
 html=body.decode('utf-8');parser=Table();parser.feed(html);assert parser.tables==1 and parser.rows,'unrecognized source table'
 dates=re.findall(r'Last updated:\s*(\d{4}/\d{2}/\d{2})',html);assert len(set(dates))==1,'source date unknown'
 assert not re.search(r'(?:rel=["\x27]next|>\s*Next page\s*<)',html,re.I),'unaccounted pagination'
 items=[]
 for r in parser.rows:
  assert len(r)==3,'unaccounted table row'
  links=[v for v in r[0]['links'] if re.fullmatch(r'https://open.spotify.com/'+kind+r'/[A-Za-z0-9]+',v)]
  assert len(links)==1,'unresolved source item identity'
  marked=r[0]['text'].strip();title=re.sub(r'^[*^]\s*','',marked);assert title
  def number(s):
   s=s.strip();assert not s or re.fullmatch(r'[0-9,]+',s),'unrecognized source measure'
   return int(s.replace(',','')) if s else None
  items.append({'item_type':kind,'item_key':links[0].split('/')[-1],'title':title,'artwork_url':None,'spotifyUrl':links[0],'totalStreams':number(r[1]['text']),'dailyStreams':number(r[2]['text']),'compilation':kind=='album' and marked.startswith('^')})
 assert len({v['item_key'] for v in items})==len(items),'duplicate source item'
 declared=re.search(r'>Tracks</td><td>([\d,]+)</td>',html)
 if kind=='track' and declared:assert int(declared.group(1).replace(',',''))==len(items),'declared source count mismatch'
 return {'source':meta,'sourceDate':dates[0].replace('/','-'),'scope':'complete_captured_kworb_table_not_all_spotify_objects','expectedCount':len(parser.rows),'observedCount':len(items),'allRowsAccounted':True,'items':items}
