import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleCase } from './names.ts';

test('contractor names: title case, acronyms and initials kept', () => {
  const cases: [string, string][] = [
    ['H2 LANDMARK BUILDERS, INC.', 'H2 Landmark Builders, Inc.'],
    ['L.S.D. CONSTRUCTION & SUPPLIES', 'L.S.D. Construction & Supplies'],
    ['RELY CONSTRUCTION & SUPPLY INC.(FORMERLY: RELY CONSTRUCTION AND SUPPLY)', 'Rely Construction & Supply Inc.(Formerly: Rely Construction and Supply)'],
    ['AKN CONSTRUCTION CORPORATION', 'AKN Construction Corporation'],
    ['HGG BUILDERS & SUPPLY', 'HGG Builders & Supply'],
    ["C'ZARLES CONSTRUCTION & SUPPLY", "C'Zarles Construction & Supply"],
    ['RC TROCIO BUILDERS AND REALTY DEVELOPMENT, OPC (FOR:RC TROCIO BUILDERS)', 'RC Trocio Builders and Realty Development, OPC (for:RC Trocio Builders)'],
    ['MAER SUMMIT KONSTRUKT CO.', 'Maer Summit Konstrukt Co.'],
    ['D.L CERVANTES CONSTRUCTION CORPORATION', 'D.L Cervantes Construction Corporation'],
    ['SUN BUILDERS', 'Sun Builders'],
    ['J & S ESCUADRA CONSTRUCTION & SUPPLY', 'J & S Escuadra Construction & Supply'],
    ['PEÑA CONSTRUCTION', 'Peña Construction'],
    ['Already Mixed Case', 'Already Mixed Case'],
  ];
  for (const [raw, want] of cases) assert.equal(titleCase(raw), want);
});
