import unittest,runpy,hashlib
from pathlib import Path
f=runpy.run_path(str(Path(__file__).with_name('reconcile-captured-catalog.py')))['reconcile_document']
class Capture(unittest.TestCase):
 def fixture(self,cell=''):
  body=('Last updated: 2026/09/05<table class="addpos"><tr><td><a href="https://open.spotify.com/track/abc">Title</a></td><td>123</td><td>'+cell+'</td></tr></table>').encode()
  meta={'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'httpStatus':200,'fetchedAt':'2026-09-06T00:00:00Z','kind':'songs','spotifyId':'a'*22,'url':'https://kworb.net/spotify/artist/'+('a'*22)+'_songs.html'}
  return body,meta
 def test_blank_measure_remains_unknown(self):
  b,m=self.fixture();d=f(b,m);self.assertIsNone(d['items'][0]['dailyStreams']);self.assertEqual(d['expectedCount'],1)
 def test_digest_and_size_cannot_be_substituted(self):
  b,m=self.fixture();m['bytes']+=1
  with self.assertRaises(AssertionError):f(b,m)
 def test_malformed_measure_rejected(self):
  b,m=self.fixture('unknown')
  with self.assertRaises(AssertionError):f(b,m)
 def test_source_date_required(self):
  b,m=self.fixture();b=b.replace(b'Last updated: 2026/09/05',b'');m.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
  with self.assertRaises(AssertionError):f(b,m)
if __name__=='__main__':unittest.main()
