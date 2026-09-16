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
