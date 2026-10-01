import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  RECHARTS_METADATA_ATTRIBUTES,
  RECHARTS_PRESENTATION_ATTRIBUTES,
  classifyAttribute,
  isRechartsMetadata,
} from '../../src/render/svg/recharts-metadata';

type Inventory = Record<string, Record<string, Record<string, string>>>;
const inventory = JSON.parse(
  readFileSync('spikes/recharts-3.10/attribute-inventory.json', 'utf8'),
) as Inventory;

const pairs: [string, string, string][] = [];
for (const tags of Object.values(inventory)) {
  for (const [tag, attrs] of Object.entries(tags)) {
    for (const [name, recorded] of Object.entries(attrs)) pairs.push([tag, name, recorded]);
  }
}

test('the inventory is not empty', () => {
  expect(pairs.length).toBeGreaterThan(60);
});

test('every inventory attribute is classified, and as the spike recorded it', () => {
  for (const [tag, name, recorded] of pairs) {
    const got = classifyAttribute(tag, name);
    expect(got, `${tag}@${name}`).not.toBe('unclassified');
    expect(got, `${tag}@${name}`).toBe(recorded);
  }
});

test('the exported sets contain every recorded presentation and metadata attribute', () => {
  for (const [tag, name, recorded] of pairs) {
    if (recorded === 'presentation') {
      expect(RECHARTS_PRESENTATION_ATTRIBUTES.has(name), `${tag}@${name}`).toBe(true);
    }
    if (recorded === 'metadata') {
      expect(RECHARTS_METADATA_ATTRIBUTES.has(name) || name.startsWith('data-'), name).toBe(true);
      expect(isRechartsMetadata(tag, name), `${tag}@${name}`).toBe(true);
    }
  }
});

test('letter-spacing and font-style are materialized presentation attributes', () => {
  expect(RECHARTS_PRESENTATION_ATTRIBUTES.has('letter-spacing')).toBe(true);
  expect(RECHARTS_PRESENTATION_ATTRIBUTES.has('font-style')).toBe(true);
});

test('an unknown attribute is unclassified, never silently metadata', () => {
  expect(classifyAttribute('path', 'foo')).toBe('unclassified');
  expect(classifyAttribute('g', 'width')).toBe('unclassified');
  expect(classifyAttribute('rect', 'width')).toBe('geometry');
});
