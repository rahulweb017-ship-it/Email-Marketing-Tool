function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface CsvColumn {
  key: string;
  header: string;
}

export function generateCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}
