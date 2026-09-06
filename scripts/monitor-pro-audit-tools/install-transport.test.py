import base64
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
import zlib

spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('install-transport.py'))
i = importlib.util.module_from_spec(spec)
spec.loader.exec_module(i)


def record(name, data):
    return {'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def fixture():
    dictionary = b'original immutable driver dictionary'
    data = b'private helper; never execute'
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w') as tar:
        member = tarfile.TarInfo('helper.cjs')
        member.size, member.mode = len(data), 0o600
        tar.addfile(member, io.BytesIO(data))
    archive = buf.getvalue()
    encoder = zlib.compressobj(wbits=-15, zdict=dictionary)
    compressed = encoder.compress(archive) + encoder.flush()
    encoded = base64.b64encode(compressed)
    manifest = {'dictionary': record('original.cjs', dictionary),
                'artifacts': [record('host.tar.deflate.b64', encoded), record('host.tar.deflate', compressed), record('host.tar', archive)],
                'decompression': {'maxOutputLength': len(archive)},
                'files': [record('helper.cjs', data)], 'parts': [record('part01', encoded)]}
    return encoded, dictionary, manifest, data


class Tests(unittest.TestCase):
    def test_correct_representations(self):
        encoded, dictionary, m, data = fixture()
        files, checks = i.unpack(encoded, dictionary, m)
        self.assertEqual(files, {'helper.cjs': data})
        self.assertNotEqual(checks['compressed'], checks['tar'])

    def test_swapped_compressed_and_tar_expectations(self):
        encoded, dictionary, m, _ = fixture()
        a, b = m['artifacts'][1:]
        for key in ['bytes', 'sha256']:
            a[key], b[key] = b[key], a[key]
        with self.assertRaisesRegex(ValueError, 'compressed verification failed'):
            i.unpack(encoded, dictionary, m)

    def test_tar_hash_cannot_use_compressed_hash(self):
        encoded, dictionary, m, _ = fixture()
        m['artifacts'][2]['sha256'] = m['artifacts'][1]['sha256']
        with self.assertRaisesRegex(ValueError, 'tar verification failed'):
            i.unpack(encoded, dictionary, m)

    def test_each_stage_rejects_corruption(self):
        for index, label in [(0, 'base64'), (1, 'compressed'), (2, 'tar')]:
            with self.subTest(stage=label):
                encoded, dictionary, m, _ = fixture()
                m['artifacts'][index]['sha256'] = '0' * 64
                with self.assertRaisesRegex(ValueError, label + ' verification failed'):
                    i.unpack(encoded, dictionary, m)

    def test_dictionary_and_member_validation(self):
        encoded, dictionary, m, _ = fixture()
        with self.assertRaisesRegex(ValueError, 'dictionary verification failed'):
            i.unpack(encoded, dictionary + b'x', m)
        m['files'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'member:helper.cjs verification failed'):
            i.unpack(encoded, dictionary, m)

    def test_inflate_bound(self):
        encoded, dictionary, m, _ = fixture()
        m['decompression']['maxOutputLength'] = 1
        m['artifacts'][2]['bytes'] = 1
        with self.assertRaisesRegex(ValueError, 'oversized'):
            i.unpack(encoded, dictionary, m)

    def test_install_exclusive_and_preserves_original(self):
        encoded, dictionary, m, data = fixture()
        with tempfile.TemporaryDirectory() as root:
            root = Path(root).resolve()
            src, dst = root/'src', root/'dst'
            src.mkdir(mode=0o700); dst.mkdir(mode=0o700)
            (src/'part01').write_bytes(encoded)
            (dst/'original.cjs').write_bytes(dictionary)
            self.assertTrue(i.install(src, dst, m)['success'])
            self.assertEqual((dst/'helper.cjs').read_bytes(), data)
            self.assertEqual((dst/'helper.cjs').stat().st_mode & 0o777, 0o600)
            with self.assertRaisesRegex(ValueError, 'already exists'):
                i.install(src, dst, m)
            self.assertEqual((dst/'original.cjs').read_bytes(), dictionary)

    def test_bad_tar_leaves_destination_unwritten(self):
        encoded, dictionary, m, _ = fixture()
        m['artifacts'][2]['sha256'] = '0' * 64
        with tempfile.TemporaryDirectory() as root:
            root = Path(root).resolve()
            src, dst = root/'src', root/'dst'
            src.mkdir(mode=0o700); dst.mkdir(mode=0o700)
            (src/'part01').write_bytes(encoded); (dst/'original.cjs').write_bytes(dictionary)
            with self.assertRaises(ValueError):
                i.install(src, dst, m)
            self.assertEqual([p.name for p in dst.iterdir()], ['original.cjs'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
