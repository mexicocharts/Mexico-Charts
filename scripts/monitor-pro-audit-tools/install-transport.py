"""Verify each transport representation before exclusive private installation.
No package execution, database access, application imports or overwrite.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import sys
import tarfile
import zlib


def verify(label, data, expected):
    actual = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    if any(actual[key] != expected[key] for key in actual):
        raise ValueError(f'{label} verification failed: {actual}')
    return actual


def unpack(encoded, dictionary, manifest):
    artifacts = {item['file']: item for item in manifest['artifacts']}
    if len(artifacts) != 3 or set(artifacts) != {'host.tar.deflate.b64', 'host.tar.deflate', 'host.tar'}:
        raise ValueError('Unexpected representation registry')
    checks = {'dictionary': verify('dictionary', dictionary, manifest['dictionary'])}
    checks['base64'] = verify('base64', encoded, artifacts['host.tar.deflate.b64'])
    compressed = base64.b64decode(encoded, validate=True)
    checks['compressed'] = verify('compressed', compressed, artifacts['host.tar.deflate'])
    limit = manifest['decompression']['maxOutputLength']
    if limit != artifacts['host.tar']['bytes'] or limit > 10_000_000:
        raise ValueError('Invalid decompression bound')
    decoder = zlib.decompressobj(wbits=-15, zdict=dictionary)
    archive = decoder.decompress(compressed, limit + 1)
    if len(archive) > limit or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
        raise ValueError('Invalid or oversized compressed stream')
    checks['tar'] = verify('tar', archive, artifacts['host.tar'])
    wanted = {item['file']: item for item in manifest['files']}
    if len(wanted) != len(manifest['files']) or not wanted:
        raise ValueError('Duplicate or empty member registry')
    files = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:') as tar:
        for member in tar:
            if (not member.isfile() or member.name not in wanted or member.name in files
                    or Path(member.name).name != member.name or member.mode != 0o600):
                raise ValueError('Unexpected, duplicate or unsafe tar member')
            data = tar.extractfile(member).read()
            checks[member.name] = verify('member:' + member.name, data, wanted[member.name])
            files[member.name] = data
    if set(files) != set(wanted):
        raise ValueError('Missing tar member')
    return files, checks


def directory(path):
    path = Path(os.path.abspath(path))
    for parent in [*reversed(path.parents), path]:
        if not stat.S_ISDIR(parent.lstat().st_mode):
            raise ValueError('Directory or ancestor is not a real directory')
    if stat.S_IMODE(path.stat().st_mode) != 0o700:
        raise ValueError('Private leaf must be mode0700')
    return path


def read_regular(path):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW), 'rb') as handle:
        if not stat.S_ISREG(os.fstat(handle.fileno()).st_mode):
            raise ValueError('Not a regular file')
        return handle.read()


def install(transfer, destination, manifest):
    transfer, destination = directory(transfer), directory(destination)
    parts = []
    for part in manifest['parts']:
        if Path(part['file']).name != part['file']:
            raise ValueError('Unsafe part path')
        data = read_regular(transfer / part['file'])
        verify('part:' + part['file'], data, part)
        parts.append(data)
    name = manifest['dictionary']['file']
    if Path(name).name != name:
        raise ValueError('Unsafe dictionary path')
    dictionary = read_regular(destination / name)
    files, checks = unpack(b''.join(parts), dictionary, manifest)
    for name in files:
        if os.path.lexists(destination / name):
            raise ValueError('Destination already exists; preserve and inspect')
    for name, data in files.items():
        with os.fdopen(os.open(destination / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        verify('installed:' + name, read_regular(destination / name), checks[name])
    verify('unchanged dictionary', read_regular(destination / manifest['dictionary']['file']), checks['dictionary'])
    return {'success': True, 'checks': checks, 'sourceExecuted': False, 'databaseCalls': 0}


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('Usage: install-transport.py TRANSFER PRIVATE_DEST MANIFEST')
    print(json.dumps(install(sys.argv[1], sys.argv[2], json.loads(read_regular(sys.argv[3]))), sort_keys=True))
