export interface AdminEra {
  party: 'R' | 'D';
  president: string;
  start: Date;
  end: Date;
}

export const ADMIN_ERAS: AdminEra[] = [
  { party: 'D', president: 'Clinton',  start: new Date('1993-01-20'), end: new Date('2001-01-20') },
  { party: 'R', president: 'Bush II',  start: new Date('2001-01-20'), end: new Date('2009-01-20') },
  { party: 'D', president: 'Obama',    start: new Date('2009-01-20'), end: new Date('2017-01-20') },
  { party: 'R', president: 'Trump I',  start: new Date('2017-01-20'), end: new Date('2021-01-20') },
  { party: 'D', president: 'Biden',    start: new Date('2021-01-20'), end: new Date('2025-01-20') },
  { party: 'R', president: 'Trump II', start: new Date('2025-01-20'), end: new Date('2029-01-20') },
];

export const ADMIN_TRANSITIONS = ADMIN_ERAS.map(e => e.start);

export const partyColor = (p: 'R' | 'D') =>
  p === 'R' ? 'rgb(var(--party-gop) / 0.07)' : 'rgb(var(--party-dem) / 0.07)';
