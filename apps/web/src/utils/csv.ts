export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** 1-based line number in the file where each row starts (matches what users see in Excel). */
  lineNumbers: number[];
  delimiter: string;
  hadHeader: boolean;
}

const DELIMITERS = [',', ';', '\t', '|'];

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let best = ',', bestCount = 0;
  for (const d of DELIMITERS) {
    let count = 0, inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

/** RFC 4180 parsing: quoted fields, "" escapes, delimiters and line breaks inside quotes. */
function tokenize(text: string, delimiter: string): { rows: string[][]; lines: number[] } {
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;

  const endRow = () => {
    row.push(field);
    rows.push(row);
    lines.push(rowStart);
    row = [];
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === '') { field = ''; inQuotes = true; }
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\r') { /* handled with \n */ }
    else if (ch === '\n') { endRow(); line++; rowStart = line; }
    else field += ch;
  }
  if (field !== '' || row.length) endRow();
  return { rows, lines };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-().]{6,}$/;

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const { rows: raw, lines } = tokenize(text, delimiter);

  const cleaned: string[][] = [];
  const lineNumbers: number[] = [];
  raw.forEach((r, i) => {
    const cells = r.map((c) => c.replace(/[\u200B-\u200D\uFEFF]/g, '').trim());
    if (cells.some((c) => c !== '')) { cleaned.push(cells); lineNumbers.push(lines[i]); }
  });
  if (cleaned.length === 0) return { headers: [], rows: [], lineNumbers: [], delimiter, hadHeader: false };

  const width = Math.max(...cleaned.map((r) => r.length));
  const first = cleaned[0];
  // No header row if the first row already contains an email or phone number
  const hadHeader = !first.some((c) => EMAIL_RE.test(c) || PHONE_RE.test(c));
  const headerCells = hadHeader ? first : [];
  const headers = Array.from({ length: width }, (_, i) => headerCells[i] || `Column ${i + 1}`);
  const body = hadHeader ? cleaned.slice(1) : cleaned;
  const bodyLines = hadHeader ? lineNumbers.slice(1) : lineNumbers;

  // Drop columns that are completely empty (common with trailing delimiters from Excel)
  const keep = headers.map((_h, i) => headerCells[i] || body.some((r) => (r[i] ?? '') !== ''));
  return {
    headers: headers.filter((_, i) => keep[i]),
    rows: body.map((r) => headers.map((_, i) => r[i] ?? '').filter((_, i) => keep[i])),
    lineNumbers: bodyLines,
    delimiter,
    hadHeader,
  };
}

export type ImportField = '' | 'email' | 'phone' | 'first_name' | 'last_name' | 'full_name' | 'company_name' | 'country_code';

/** Guess which contact field each column holds, from the header and (for unnamed columns) the values. */
export function guessMapping(headers: string[], rows: string[][]): Record<string, ImportField> {
  const used = new Set<ImportField>();
  const map: Record<string, ImportField> = {};
  const byHeader = (h: string): ImportField => {
    const k = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/e?mail/.test(k)) return 'email';
    if (/(phone|mobile|whatsapp|cell|contactno|contactnumber|^tel|^mob|^ph$|^phno|^number$|^wa$)/.test(k)) return 'phone';
    if (/(first|fname|given|^forename)/.test(k)) return 'first_name';
    if (/(last|lname|surname|family)/.test(k)) return 'last_name';
    if (/^(name|fullname|customername|contactname|clientname|leadname|customer|contact)$/.test(k)) return 'full_name';
    if (/(company|organi[sz]ation|^org|business|firm|employer)/.test(k)) return 'company_name';
    if (/country/.test(k)) return 'country_code';
    return '';
  };
  const byValues = (i: number): ImportField => {
    const sample = rows.slice(0, 20).map((r) => r[i]).filter(Boolean);
    if (!sample.length) return '';
    if (sample.filter((v) => EMAIL_RE.test(v.replace(/\s/g, ''))).length >= sample.length / 2) return 'email';
    if (sample.filter((v) => PHONE_RE.test(v)).length >= sample.length / 2) return 'phone';
    return '';
  };
  headers.forEach((h, i) => {
    let f = byHeader(h);
    if (!f) f = byValues(i);
    if (f && !used.has(f)) { map[String(i)] = f; used.add(f); }
  });
  return map;
}
