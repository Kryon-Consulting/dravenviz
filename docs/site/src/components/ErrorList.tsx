import type { ReactElement } from 'react';

export interface Problem {
  path: string;
  rule: string;
  message: string;
}

export function ErrorList({ problems }: { problems: Problem[] }): ReactElement | null {
  if (problems.length === 0) return null;
  return (
    <ul className="errors" aria-label="Validation errors">
      {problems.map((p, i) => (
        <li key={`${p.path}|${p.rule}|${i}`}>
          <code className="path">{p.path === '' ? '(document)' : p.path}</code>{' '}
          <span className="rule">{p.rule}</span> {p.message}
        </li>
      ))}
    </ul>
  );
}
