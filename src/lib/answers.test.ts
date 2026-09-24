import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryComparison, companiesLine, completionAnswer, completionComparison, groupWords, inTen, povertyAnswer, povertyCell, povertyComparison, povertyTrend,
  shortName, sinceWords, spendChange, spendComparison, top3Answer, top3Comparison, unfinishedLine,
} from './answers.ts';
import { periodById } from './metrics.ts';

test('shortName', () => {
  assert.equal(shortName('City of Mati'), 'Mati');
  assert.equal(shortName('Island Garden City of Samal'), 'Samal');
  assert.equal(shortName('Quezon City'), 'Quezon City');
  assert.equal(shortName('Lupon'), 'Lupon');
});

test('spendComparison: thresholds at 1.15, 0.85 and 0.5', () => {
  const g = 'similar cities';
  assert.equal(spendComparison(1.94, g), 'About 1.9× what similar cities got.');
  assert.equal(spendComparison(1.2, g), 'About 1.2× what similar cities got.');
  assert.equal(spendComparison(1.149, g), 'About the same as similar cities.');
  assert.equal(spendComparison(0.85, g), 'About the same as similar cities.');
  assert.equal(spendComparison(0.8, g), 'About 1.3× less than similar cities.');
  assert.equal(spendComparison(0.5, g), 'About 2.0× less than similar cities.');
  assert.equal(spendComparison(0.49, g), 'Less than half of what similar cities got.');
  assert.equal(spendComparison(14.2, g), 'About 14× what similar cities got.');
  assert.equal(spendComparison(null, g), '');
});

test('spendChange and sinceWords', () => {
  assert.equal(spendChange(42622, 25998, 'the previous 3 years'), 'Up ₱16,624 per person from the previous 3 years.');
  assert.equal(spendChange(100, 250, 'the year before'), 'Down ₱150 per person from the year before.');
  assert.equal(spendChange(100.2, 100, 'x'), 'The same per person as x.');
  assert.equal(spendChange(null, 1, 'x'), '');
  assert.equal(sinceWords(periodById('prev-latest')!, periodById('latest')!), 'the year before');
  assert.equal(sinceWords(periodById('prev-last3')!, periodById('last3')!), 'the previous 3 years');
  assert.equal(sinceWords(null, periodById('duterte')!), '');
});

test('poverty: N in 10, under 5% and the table cell', () => {
  assert.equal(povertyAnswer(38.9), 'About 4 in 10 people are poor.');
  assert.equal(povertyAnswer(14.9), 'About 1 in 10 people are poor.');
  assert.equal(povertyAnswer(5), 'About 1 in 10 people are poor.');
  assert.equal(povertyAnswer(4.9), 'Fewer than 1 in 20 people are poor.');
  assert.equal(povertyAnswer(null), 'We don’t have a poverty figure for this place.');
  assert.equal(inTen(25), 'about 3 in 10');
  assert.equal(povertyCell(38.9), '4 in 10 (38.9%)');
  assert.equal(povertyCell(2.1), 'fewer than 1 in 20 (2.1%)');
});

test('poverty comparison and trend', () => {
  const g = 'similar cities';
  assert.equal(povertyComparison(38.9, 26.5, g), 'More than most similar cities.');
  assert.equal(povertyComparison(20, 26.5, g), 'Fewer than most similar cities.');
  assert.equal(povertyComparison(27, 26.5, g), 'About the same as similar cities.');
  assert.deepEqual(povertyTrend(38.9, 30.4, 2021), { text: 'Got worse since 2021.', status: 'worse' });
  assert.deepEqual(povertyTrend(20, 24, 2021), { text: 'Got better since 2021.', status: 'better' });
  assert.deepEqual(povertyTrend(20.2, 20, 2021), { text: 'About the same as in 2021.', status: 'same' });
  assert.equal(povertyTrend(20, null, null), null);
});

test('top3: Yes ≥75%, Mostly 50–75%, No <50%', () => {
  assert.equal(top3Answer(0.376), 'No. The 3 biggest got 38%.');
  assert.equal(top3Answer(0.5), 'Mostly. The 3 biggest got 50%.');
  assert.equal(top3Answer(0.749), 'Mostly. The 3 biggest got 75%.');
  assert.equal(top3Answer(0.75), 'Yes. The 3 biggest got 75%.');
  assert.equal(top3Comparison(0.376, 0.5, 'similar cities'), 'More spread out than most similar cities.');
  assert.equal(top3Comparison(0.7, 0.5, 'similar cities'), 'More concentrated than most similar cities.');
  assert.equal(top3Comparison(0.51, 0.5, 'similar cities'), 'About the same as similar cities.');
  assert.equal(companiesLine(44), '44 companies got work in total.');
  assert.equal(companiesLine(1), 'Only 1 company got work.');
});

test('completion answer, unfinished line and the "new" clause', () => {
  assert.equal(completionAnswer(67, 150), '67 of 150 projects are done.');
  assert.equal(completionAnswer(1, 43), '1 of 43 projects is done.');
  assert.equal(completionAnswer(563, 1138), '563 of 1,138 projects are done.');
  assert.equal(unfinishedLine({ year: 2025, ongoing: 41, notStarted: 1 }), '41 of the rest were approved in 2025 and are still being built. 1 hasn’t started yet.');
  assert.equal(unfinishedLine({ year: 2025, ongoing: 0, notStarted: 3 }), '3 haven’t started yet.');
  const o = { name: 'Mati', unfinished: 83, newUnfinished: 42 };
  assert.equal(completionComparison(0.45, 0.6, 'similar cities', o), 'Fewer finished than most similar cities, but most of Mati’s unfinished projects are new.');
  assert.equal(completionComparison(0.45, 0.6, 'similar cities', { ...o, newUnfinished: 41 }), 'Fewer finished than most similar cities.');
  assert.equal(completionComparison(0.8, 0.6, 'similar cities', o), 'More finished than most similar cities.');
  assert.equal(completionComparison(0.61, 0.6, 'similar cities', o), 'About as many finished as similar cities.');
});

test('groupWords', () => {
  assert.equal(groupWords('class', { kind: 'City', reg: 'Region XI' }), 'similar cities');
  assert.equal(groupWords('class', { kind: 'Mun', reg: 'Region XI' }), 'similar towns');
  assert.equal(groupWords('region', { kind: 'City', reg: 'Region XI' }), 'other places in Region XI');
});

test('categoryComparison', () => {
  assert.equal(categoryComparison(27639, 12000, 'similar cities'), 'More than similar cities.');
  assert.equal(categoryComparison(1000, 1100, 'similar cities'), 'About the same as similar cities.');
  assert.equal(categoryComparison(500, 1100, 'similar cities'), 'Less than similar cities.');
  assert.equal(categoryComparison(0, 0, 'similar cities'), 'None, like most similar cities.');
  assert.equal(categoryComparison(10, 0, 'similar cities'), 'More than similar cities (most got none).');
});
