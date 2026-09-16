// Helpers that compose pages from the collections. Everything resolves at build time.
import { getCollection } from 'astro:content';

export async function loadAll() {
  const [dimensions, places, populations, sources, developments, questions, corrections, records, investigations, measures, findings, charts, datasets] = await Promise.all([
    getCollection('dimensions'), getCollection('places'), getCollection('populations'), getCollection('sources'),
    getCollection('developments'), getCollection('questions'), getCollection('corrections'), getCollection('records'),
    getCollection('investigations'), getCollection('measures'), getCollection('findings'), getCollection('charts'), getCollection('datasets'),
  ]);
  return { dimensions, places, populations, sources, developments, questions, corrections, records, investigations, measures, findings, charts, datasets };
}

export type All = Awaited<ReturnType<typeof loadAll>>;

export const nameMap = (entries: Array<{ id: string; data: { name: string } }>) => new Map(entries.map((e) => [e.id, e.data.name]));
export const citationMap = (entries: Array<{ id: string; data: { citation: string } }>) => new Map(entries.map((e) => [e.id, e.data.citation]));

export function recordPath(dimension: string, place: string) { return `/records/${dimension}/${place}/`; }

export function findingByRef(findings: All['findings'], ref: string) {
  const [inv, fid] = ref.split(':');
  const set = findings.find((f) => f.data.investigation === inv);
  return { investigation: inv, item: set?.data.items.find((i) => i.id === fid) };
}

export const STATUS_LABEL: Record<string, string> = {
  open: 'open', 'in-investigation': 'in investigation', answered: 'answered', 'insufficient-evidence': 'insufficient evidence',
};

export const GRADE_LABEL: Record<string, string> = {
  measured: 'Measured', documented: 'Documented', inferred: 'Inferred', contested: 'Contested', insufficient: 'Insufficient evidence',
};

export const GRADE_MEANING: Record<string, string> = {
  measured: 'a number from a documented dataset', documented: 'an event or rule attested by sources', inferred: 'an interpretation, labeled as one',
  contested: 'credible sources disagree; both shown', insufficient: 'the record does not answer it',
};

/** Public labels for the eleven freedoms and their Record counts, for cards. */
export const FREEDOM_ORDER = ['owning-a-home', 'moving', 'working', 'earning-income', 'owning-property', 'borrowing', 'starting-a-business', 'learning', 'knowing', 'participating', 'choosing'];
export function freedomCards(all: All) {
  const rank = (id: string) => { const i = FREEDOM_ORDER.indexOf(id); return i < 0 ? FREEDOM_ORDER.length : i; };
  return all.dimensions.map((d) => {
    const records = all.records.filter((r) => r.data.dimension === d.id && r.data.status !== 'draft');
    return { id: d.id, name: d.data.name, definition: d.data.definition, records: records.length };
  }).sort((a, b) => (b.records > 0 ? 1 : 0) - (a.records > 0 ? 1 : 0) || rank(a.id) - rank(b.id));
}

export const GRADES_IN_ORDER = ['measured', 'documented', 'inferred', 'contested', 'insufficient'] as const;
