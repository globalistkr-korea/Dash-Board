import snapshot from '../data/contracts.json';

export const contractSource = snapshot.source;

export function columnLetter(index) {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + (n - 1) % 26) + result;
  }
  return result;
}

export function groupContractRows(sheet) {
  const records = [];
  const nameIndex = sheet.name === 'WH' ? 1 : 2;
  for (const row of sheet.rows) {
    if (row.values[nameIndex]?.trim()) {
      records.push({ id: `${sheet.sheetId}-${row.row}`, sheetId: sheet.sheetId, sheet: sheet.name, rows: [] });
    }
    const record = records.at(-1);
    if (!record) throw new Error(`Contract detail without a parent: ${sheet.name}!${row.row}`);
    record.rows.push(row);
  }
  return records.map(record => {
    const width = Math.max(sheet.headers.length, ...record.rows.map(row => row.values.length));
    const fields = Array.from({ length: width }, (_, index) => ({
      header: sheet.headers[index] || 'Unlabelled column',
      column: columnLetter(index),
      uncertain: !sheet.headers[index] || (sheet.name === 'CUSTOMER' && index >= 17) ||
        (sheet.name === 'WH' && index === 33 && record.rows.some(row => /^M[rs][. ]/i.test(row.values[index] || ''))),
      values: record.rows.filter(row => String(row.values[index] ?? '').trim()).map(row => ({ row: row.row, value: String(row.values[index]) })),
    })).filter(field => field.values.length);
    const values = Object.fromEntries(fields.map(field => [field.header, [...new Set(field.values.map(cell => cell.value))].join('\n')]));
    const first = record.rows[0].values;
    const hasSourceError = record.rows.some(row => row.values.some(value => /#{3,}|#(?:ERROR!|REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!)/.test(String(value))));
    const start = sheet.name === 'WH' ? first[22] : sheet.name === 'CUSTOMER' ? first[5] : first[10];
    const end = sheet.name === 'WH' ? first[23] : sheet.name === 'CUSTOMER' ? first[6] : first[11];
    return {
      ...record, fields, values,
      name: first[nameIndex],
      location: sheet.name === 'WH' ? first[2] : values[sheet.name === 'CUSTOMER' ? 'WH' : 'WH Location'],
      entity: sheet.name === 'WH' ? '' : first[1],
      fee: sheet.name === 'WH' ? first[8] : sheet.name === 'CUSTOMER' ? first[9] : first[8],
      start, end,
      renewal: sheet.name === 'WH' ? first[24] : sheet.name === 'CUSTOMER' ? first[7] : end?.match(/auto renew/i)?.[0],
      termination: sheet.name === 'CUSTOMER' ? null : values['Termination clause'] || values['Termination Clause'],
      terminationUncertain: sheet.name === 'CUSTOMER',
      contact: values['Person in Charge'] || values.PIC,
      notes: values.Remarks,
      scope: values['Operation Scppe'],
      needsReview: hasSourceError || fields.some(field => field.uncertain) || /\b0\d{3}\b/.test(`${start} ${end}`),
      sourceUrl: `${snapshot.source.url}#gid=${sheet.sheetId}&range=A${record.rows[0].row}:${columnLetter(width - 1)}${record.rows.at(-1).row}`,
    };
  });
}

export const contractTabs = snapshot.sheets.map(sheet => ({ id: sheet.name, records: groupContractRows(sheet) }));
