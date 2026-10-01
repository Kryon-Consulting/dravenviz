import { useState, type ReactElement } from 'react';

interface Props {
  id: string;
  label: string;
  text: string;
}

/** A snippet as plain text inside `<pre>`; never markup. */
export function CodeBlock({ id, label, text }: Props): ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  };
  return (
    <figure className="code">
      <figcaption>
        <span>{label}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre data-snippet={id} tabIndex={0}>
        {text}
      </pre>
    </figure>
  );
}
