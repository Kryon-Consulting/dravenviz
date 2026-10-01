import { cloneStyles, FONT, STRINGS, THEME_VERSION, type Theme } from './tokens';

/** Same hues as light and print with luminance raised for a dark background. */
export const dark: Theme = {
  name: 'dark',
  version: THEME_VERSION,
  font: { family: FONT.family, weights: { ...FONT.weights } },
  text: { title: 16, label: 12, caption: 11, lineHeight: 1.25 },
  color: {
    background: '#14171c',
    text: '#e8eaed',
    mutedText: '#a9b0b8',
    axis: '#8b939c',
    grid: '#2c3139',
    focus: '#e8eaed',
    missing: '#7a828b',
    threshold: '#ff8a80',
    annotation: '#cfd4da',
  },
  palette: ['#6fa3f0', '#f08a4b', '#4fc4b4', '#ffd966', '#e08ab4', '#a98be0', '#c79672', '#a0a8b0'],
  roles: {},
  seriesStyles: cloneStyles(),
  sequential: ['#1c2635', '#2b4468', '#3f6aa3', '#6fa3f0', '#cfe0fb'],
  diverging: ['#f08a4b', '#a8683c', '#2c3139', '#4a6fa3', '#6fa3f0'],
  spacing: { padding: 16, legendGap: 12, titleGap: 10, barGap: 0.2, groupGap: 0.1 },
  stroke: { line: 2, axis: 1, grid: 1, reference: 1.5, sliceBorder: 1.5 },
  marker: { size: 7, hollowStroke: 1.5 },
  strings: { ...STRINGS },
};
