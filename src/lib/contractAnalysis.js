const DAY_MS = 86_400_000;
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function isoDate(year, month, day) {
  if (year < 1990 || year > 2199 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 ? date.toISOString().slice(0, 10) : null;
}

export function parseContractDate(value) {
  const source = value?.trim().replace(/[ \t]*(?:-[ \t]*)?(?:auto renew(?:al)?|stop service)[ \t]*$/i, '').trim();
  if (!source) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(source);
  if (iso) return isoDate(+iso[1], +iso[2], +iso[3]);
  const dmy = /^(\d{1,2})[-/ ]([a-z]{3}|\d{1,2})[-/ ](\d{4}|\d{2})$/i.exec(source);
  if (!dmy) return null;
  const [, day, token, year] = dmy;
  const month = /^\d+$/.test(token) ? +token : MONTH_NAMES.indexOf(token.toLowerCase()) + 1;
  return isoDate(year.length === 2 ? 2000 + +year : +year, month, +day);
}

function hasTermination(record) {
  return /\b(?:terminated|stop service)\b/i.test(`${record.notes ?? ''} ${record.end ?? ''}`);
}

function endDate(record) {
  const end = parseContractDate(record.values['Contract end'] || record.end);
  const start = parseContractDate(record.start);
  return start && end && start > end ? null : end;
}

export function renewalStatus(record, today, horizon = 60) {
  const end = endDate(record);
  const remainingDays = end ? (Date.parse(end) - Date.parse(today)) / DAY_MS : null;
  let status = 'later';
  if (hasTermination(record)) status = 'ended';
  else if (!end) status = 'unknown';
  else if (remainingDays < 0) status = 'past';
  else if (remainingDays <= horizon) status = 'soon';
  return { end, remainingDays, status };
}

export function monthBounds(year, month) {
  return {
    first: isoDate(Number(year), month, 1),
    last: new Date(Date.UTC(Number(year), month, 0)).toISOString().slice(0, 10),
  };
}

const warehouseKey = value => value?.normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/\s*\(북부\)$/, '').replace(/[^a-z0-9]/g, '') || '';

// DPL is in the contract warehouse name. The Nam Hai entries identify the northern Nam Hai DC.
const LINKED_WAREHOUSE_LABELS = {
  namhai: 'namhaidc',
  minhquang: 'dpl',
  minhquangdpl: 'dpl',
};

function siteKey(record) {
  if (record.sheet === 'WH') return warehouseKey(record.name);
  const location = record.location?.trim();
  if (!location || /[,;/\n]/.test(location) || /^(all|os)$/i.test(location)) return '';
  return warehouseKey(location);
}

export function linkWarehouseContracts(tabs, warehouseEntities) {
  const names = new Map();
  for (const entity of warehouseEntities) {
    for (const label of [entity.name, ...(entity.aliasNames || [])]) {
      const key = warehouseKey(label);
      const prior = names.get(key);
      names.set(key, prior === undefined || prior === entity.name ? entity.name : null);
    }
  }
  const bySite = new Map();
  const unlinked = [];
  for (const record of tabs.flatMap(tab => tab.records)) {
    const key = siteKey(record);
    const name = names.get(LINKED_WAREHOUSE_LABELS[key] ?? key);
    if (!name) {
      unlinked.push(record);
      continue;
    }
    if (!bySite.has(name)) bySite.set(name, []);
    bySite.get(name).push(record);
  }
  return { bySite, unlinked };
}

function contractAmount(record) {
  const raw = record.fee?.trim() || '';
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw) ? Number(raw.replaceAll(',', '')) : null;
}

function terminationMonth(record) {
  const match = /\bterminated since\s+([a-z]{3})\s*['’]?(\d{2}|\d{4})\b/i.exec(record.notes || '');
  return match ? parseContractDate(`1-${match[1]}-${match[2]}`) : null;
}

export function contractMonth(record, { first, last }) {
  const start = parseContractDate(record.values['Current contract start'] ||
    record.values['Current Contract start'] || record.values['Contract start (DD/MM/YY)'] || record.start);
  const end = endDate(record);
  if (start && end && (start > last || end < first)) return { status: 'outside', amount: null };
  if (hasTermination(record)) {
    const stopped = terminationMonth(record);
    if (stopped && stopped <= first) return { status: 'outside', amount: null };
    if (!stopped || stopped <= last) return { status: 'terminationCheck', amount: null };
  }
  if (record.sheet === 'WH' && /^in-house$/i.test(record.values['Ownership Type']?.trim())) {
    return { status: 'inHouse', amount: null };
  }
  if (!start || !end) return { status: 'dateCheck', amount: null };
  if (start > first || end < last) return { status: 'partial', amount: null };
  const amount = contractAmount(record);
  return amount === null ? { status: 'amountCheck', amount } : { status: 'included', amount };
}
