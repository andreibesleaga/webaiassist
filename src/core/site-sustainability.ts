// SPDX-License-Identifier: Apache-2.0
// Reads the sustainability well-known file (/.well-known/sustainability-data, the owner's
// Internet-Draft draft-besleaga-sustainability-wellknown): a JSON object, or a list of such
// objects. Only a few text members are kept, as text. A `signed` member is reported only as
// present: the extension does not check the signature and says nothing about trust.
export interface Sustainability {
  readonly provider?: string;
  readonly method?: string;
  readonly target?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly energy?: string;
  readonly carbon?: string;
  /** The `updated` member. */
  readonly updated?: string;
  /** A signature member is there; it is not checked. */
  readonly signed: boolean;
  /** How many records the file holds; the first is shown. */
  readonly records: number;
}

type Entry = Record<string, unknown>;
const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const MAX_RECORDS = 100;

const text = (value: unknown, limit = 120): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, limit) : undefined;

function amount(record: Entry, valueKey: string, unitKey: string): string | undefined {
  const value = record[valueKey];
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const unit = text(record[unitKey], 20);
  return unit === undefined ? String(value) : `${value} ${unit}`;
}

function recordOf(raw: string): { first: Entry; count: number } | undefined {
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const list = Array.isArray(root) ? root.slice(0, MAX_RECORDS) : [root];
  const first: unknown = list[0];
  return isEntry(first) ? { first, count: list.length } : undefined;
}

/** The main values of the file; undefined when it is not a record or a list of records. */
export function parseSustainability(raw: string): Sustainability | undefined {
  const found = recordOf(raw);
  if (!found) return undefined;
  const { first: record } = found;
  const period = isEntry(record.period) ? record.period : {};
  const fields = {
    provider: text(record.provider),
    method: text(record['measurement-method'], 60),
    target: text(record.target),
    periodStart: text(period.start, 40),
    periodEnd: text(period.end, 40),
    energy: amount(record, 'energy-consumption', 'energy-unit'),
    carbon: amount(record, 'carbon-footprint', 'carbon-unit'),
    updated: text(record.updated, 40),
  };
  const defined = Object.entries(fields).filter(([, value]) => value !== undefined);
  return {
    ...Object.fromEntries(defined),
    signed: record.signed !== undefined,
    records: found.count,
  };
}
