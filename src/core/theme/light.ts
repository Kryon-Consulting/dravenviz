import { cloneStyles, FONT, STRINGS, THEME_VERSION, type Theme } from './tokens';

export const light: Theme = {
  name: 'light',
  version: THEME_VERSION,
  font: { family: FONT.family, weights: { ...FONT.weights } },
  text: { title: 16, label: 12, caption: 11, lineHeight: 1.25 },
  color: {
    background: '#ffffff',
    text: '#1a1a1a',
    mutedText: '#4d4d4d',
    axis: '#595959',
    grid: '#e3e5e8',
    focus: '#1a1a1a',
    missing: '#8c8c8c',
    threshold: '#a61b1b',
    annotation: '#333333',
  },
  palette: ['#1f4e99', '#c4510a', '#2a9d8f', '#b1902c', '#b5527f', '#6b4fa0', '#8c5a3c', '#6f7780'],
  roles: {},
  seriesStyles: cloneStyles(),
  sequential: ['#f1f5fb', '#c6d6ec', '#8fadd6', '#4f7cb8', '#1f4e99'],
  diverging: ['#8c3a05', '#d98c4f', '#f5f5f5', '#7fa6d4', '#1f4e99'],
  spacing: { padding: 16, legendGap: 12, titleGap: 10, barGap: 0.2, groupGap: 0.1 },
  stroke: { line: 2, axis: 1, grid: 1, reference: 1.5, sliceBorder: 1.5 },
  marker: { size: 7, hollowStroke: 1.5 },
  strings: { ...STRINGS },
};
