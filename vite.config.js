import {defineConfig} from 'vite';
import {publicSettings} from './scripts/public-settings.mjs';
const values=publicSettings(new URL('./',import.meta.url));
// This delivery always uses the existing server. No implicit local/demo fallback.
export default defineConfig({base:'./',define:Object.fromEntries(Object.entries(values).map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)]))});
