import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef, type ReactElement } from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  label: string;
}

/**
 * A CodeMirror 6 JSON editor. The text is plain text: it is parsed with `JSON.parse` and validated,
 * never executed. Tab leaves the editor (no indent-with-tab) so keyboard users are not trapped.
 */
export function Editor({ value, onChange, label }: Props): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (host.current === null) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle),
          json(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The view is created once; later `value` changes are applied below.
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v !== null && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div className="editor" ref={host} />;
}
