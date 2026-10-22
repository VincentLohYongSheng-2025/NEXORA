"""Download selected CLEMD CSV members, checking ZIP CRC without extracting paths.

Uses HTTP ranges to avoid downloading unrelated electrical panels. Metadata is
obtained from the public Figshare API; raw data stays in ignored data/source/.
"""
import io
import json
from pathlib import Path
import zipfile
import zlib
import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/source/clemd'


class RemoteZip(io.RawIOBase):
    def __init__(self, url, size):
        self.url, self.size, self.pos = url, size, 0
        self.session = requests.Session()

    def seekable(self):
        return True

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def tell(self):
        return self.pos

    def read(self, n=-1):
        n = self.size - self.pos if n < 0 else min(n, self.size - self.pos)
        if n <= 0:
            return b''
        response = self.session.get(self.url, headers={'Range': f'bytes={self.pos}-{self.pos+n-1}'}, timeout=180)
        response.raise_for_status()
        if response.status_code != 206 or len(response.content) != n:
            raise ValueError(f'Server did not honour range: {response.status_code}, {len(response.content)} != {n}')
        self.pos += n
        return response.content


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    items = requests.get('https://api.figshare.com/v2/collections/6946581/articles', timeout=60).json()
    records = []
    for item in items:
        if item['defined_type_name'] != 'dataset':
            continue
        metadata = requests.get(item['url'], timeout=60).json()
        if metadata['license']['name'] != 'CC BY 4.0':
            raise ValueError('Unexpected licence')
        (OUT / f"metadata-{item['id']}.json").write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        file = metadata['files'][0]
        with zipfile.ZipFile(RemoteZip(file['download_url'], file['size'])) as archive:
            members = [{'name': f.filename, 'bytes': f.file_size, 'crc32': f'{f.CRC:08x}'} for f in archive.infolist()]
            print(item['title'], json.dumps(members), flush=True)
            selected = [f for f in archive.infolist() if Path(f.filename).name.lower() in ('aggregate.csv', 'aggregtae.csv')]
            for index, member in enumerate(selected):
                target = OUT / f"{item['id']}-incoming-{index}.csv"
                if not target.exists():
                    content = archive.read(member)  # zipfile verifies CRC32
                    target.write_bytes(content)
                cached = target.read_bytes()
                if len(cached) != member.file_size or zlib.crc32(cached) != member.CRC:
                    raise ValueError(f'Cached CSV differs from archive CRC: {target.name}')
                print(f'Saved {target.name}: {target.stat().st_size} bytes', flush=True)
            records.append({'id': item['id'], 'doi': metadata['doi'], 'licence': metadata['license'],
                            'archive': file, 'members': members, 'selected': [f.filename for f in selected]})
        (OUT / 'download-manifest.json').write_text(json.dumps(records, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
