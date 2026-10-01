// Registers the load-tracing hooks below; used with `node --import` by the import tests.
import { register } from 'node:module';

register('./trace-hooks.mjs', import.meta.url);
