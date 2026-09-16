// One URL per template, from the fixture content. Every suite walks this list.
export const TEMPLATES = [
  { name: 'home', path: '/' },
  { name: 'freedoms index', path: '/freedoms/' },
  { name: 'freedom', path: '/freedoms/owning-a-home/' },
  { name: 'places index', path: '/places/' },
  { name: 'place', path: '/places/fixture-state/' },
  { name: 'record', path: '/records/owning-a-home/fixture-state/' },
  { name: 'investigations index', path: '/investigations/' },
  { name: 'investigation', path: '/investigations/000-fixture/' },
  { name: 'source', path: '/sources/fixture-statute/' },
  { name: 'dataset', path: '/datasets/ds-fixture/' },
  { name: 'questions', path: '/questions/' },
  { name: 'changelog', path: '/changelog/' },
  { name: 'about', path: '/about/' },
  { name: '404', path: '/no-such-page/' },
] as const;

export const RECORD = '/records/owning-a-home/fixture-state/';
