export interface AdminEra {
  party: 'R' | 'D';
  president: string;
  start: Date;
  end: Date;
}

export const ADMIN_ERAS: AdminEra[] = [
  { party: 'R', president: 'Trump I', start: new Date('2017-01-20'), end: new Date('2021-01-20') },
  { party: 'D', president: 'Biden',   start: new Date('2021-01-20'), end: new Date('2025-01-20') },
  { party: 'R', president: 'Trump II', start: new Date('2025-01-20'), end: new Date('2029-01-20') },
];

export const ADMIN_TRANSITIONS = ADMIN_ERAS.map(e => e.start);

export const partyColor = (p: 'R' | 'D') =>
  p === 'R' ? 'rgba(220, 38, 38, 0.07)' : 'rgba(37, 99, 235, 0.07)';
