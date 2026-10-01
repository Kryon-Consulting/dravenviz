import { useEffect, useState, type ReactElement } from 'react';
import { Playground } from './routes/Playground';
import { Start } from './routes/Start';

type Route = 'start' | 'playground';

const routeOf = (hash: string): Route => (hash.startsWith('#/playground') ? 'playground' : 'start');

export function App(): ReactElement {
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.hash));
  useEffect(() => {
    const onHash = (): void => setRoute(routeOf(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <>
      <header className="site-header">
        <strong className="brand">DravenViz</strong>
        <nav aria-label="Documentation">
          <a href="#/" aria-current={route === 'start' ? 'page' : undefined}>
            Start here
          </a>
          <a href="#/playground" aria-current={route === 'playground' ? 'page' : undefined}>
            Playground
          </a>
        </nav>
      </header>
      <main>{route === 'playground' ? <Playground /> : <Start />}</main>
    </>
  );
}
