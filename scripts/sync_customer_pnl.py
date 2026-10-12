"""Read the approved Google Sheet, validate, and atomically refresh dashboard inputs.
No Google credential or original workbook is persisted. Run from GitHub Actions or locally.
"""
import argparse
import hashlib
import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from import_customer_pnl import import_workbook, SOURCE_ID, ROOT

FILES = ('ops.json', 'plan3y.json', 'pnl_import_quality.json')
EXPORT_URL = f'https://docs.google.com/spreadsheets/d/{SOURCE_ID}/export?format=xlsx'


def canonical(value):
    value = json.loads(json.dumps(value))
    if isinstance(value.get('source'), dict):
        value['source'].pop('importedAt', None)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def validate_transition(previous, current):
    if current['source']['spreadsheetId'] != SOURCE_ID:
        raise ValueError('Unexpected source identity')
    if previous:
        if not set(previous['years']).issubset(current['years']):
            raise ValueError('Historical year removed; retain last good snapshot')
        for year in previous['years']:
            if current['actualMonths'][year] < previous['actualMonths'][year]:
                raise ValueError(f'{year}: actual period regressed')
            old = previous['source']['rowCounts'].get(year, 0)
            new = current['source']['rowCounts'].get(year, 0)
            if old and new < old * .8:
                raise ValueError(f'{year}: more than 20% of source rows disappeared')
    for year in current['years']:
        months = current['source']['months'][year]
        if months != list(range(1, max(months) + 1)):
            raise ValueError(f'{year}: missing month in confirmed period')
    if not current['customers'] or not current['warehouses']:
        raise ValueError('Empty entity collection')


def download(path):
    request = urllib.request.Request(EXPORT_URL, headers={'User-Agent': 'VN-Dashboard-SourceSync/1.0'})
    with urllib.request.urlopen(request, timeout=120) as response:
        content_type = response.headers.get('Content-Type', '')
        if 'spreadsheetml' not in content_type:
            raise ValueError('Source is not an XLSX export; check source access')
        data = response.read(50 * 1024 * 1024 + 1)
    if len(data) > 50 * 1024 * 1024 or not data.startswith(b'PK'):
        raise ValueError('Invalid or oversized workbook')
    path.write_bytes(data)


def sync(workbook=None, root=ROOT):
    root = Path(root)
    target = root / 'src/data'
    old = {name: json.loads((target / name).read_text()) for name in FILES}
    with tempfile.TemporaryDirectory(prefix='pnl-source-') as temp:
        folder = Path(temp)
        source = Path(workbook) if workbook else folder / 'source.xlsx'
        if not workbook:
            download(source)
        import_workbook(source, folder / 'converted')
        new = {name: json.loads((folder / 'converted' / name).read_text()) for name in FILES}
        validate_transition(old['ops.json'], new['ops.json'])
        changed = any(canonical(old[name]) != canonical(new[name]) for name in FILES)
        # Preserve the last real update time when only an export timestamp changed.
        if not changed:
            new = old
        else:
            for name in FILES:
                destination = target / name
                staged = destination.with_suffix('.json.tmp')
                staged.write_text(json.dumps(new[name], ensure_ascii=False, separators=(',', ':'), allow_nan=False))
                os.replace(staged, destination)
        checked = datetime.now(timezone.utc).isoformat()
        revision = hashlib.sha256(canonical(new['ops.json']).encode()).hexdigest()
        status = {'status': 'ok', 'automationEnabled': os.environ.get('GITHUB_ACTIONS') == 'true', 'lastCheckedAt': checked,
                  'lastUpdatedAt': new['ops.json']['source']['importedAt'], 'revision': revision,
                  'sourceId': SOURCE_ID, 'intervalHours': 3,
                  'years': new['ops.json']['years'], 'months': new['ops.json']['source']['months']}
        (root / 'public').mkdir(exist_ok=True)
        (root / 'public/pnl-sync.json').write_text(json.dumps(status, ensure_ascii=False, separators=(',', ':')))
        print(json.dumps({'changed': changed, 'revision': revision, 'months': status['months']}, ensure_ascii=False))
        return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--workbook', help='Validate a previously downloaded export without network')
    args = parser.parse_args()
    sync(args.workbook)
