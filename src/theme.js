export const THEME_KEY='extreme-kids:theme';
export const palette={
  '#0e1013':['bg','#f3f5f9'],'#0a0b0d':['deep','#e8edf5'],'#16181c':['surface','#ffffff'],
  '#1c1f25':['raised','#edf1f7'],'#2a2e36':['line','#c4cddb'],'#3a3f4a':['line-strong','#a0aec0'],
  '#454b56':['line-extra','#8492a6'],'#edeff2':['text','#172033'],'#f4f5f7':['strong','#0f172a'],
  '#8a8f99':['muted','#4c5b70'],'#565b66':['subtle','#596980'],'#a7abb5':['secondary','#4c5b70'],
  '#c5c8cd':['soft-text','#344054'],'#888':['grey','#536278'],'#9fa6b2':['grey-extra','#4c5b70'],
  '#ff3d8a':['rollers','#b31559'],'#3da5ff':['blue','#1764ad'],'#3ddc97':['green','#157347'],
  '#ffc24b':['amber','#855700'],'#ffc83d':['skate','#805900'],'#ff5454':['danger','#b42318'],
  '#ff5c5c':['danger-alt','#b42318'],'#ff8a3d':['orange','#a94708'],'#b14dff':['purple','#7731b1'],
  '#3dcfff':['cyan','#006b86'],'#6b2020':['error-bg','#7f1d1d'],
  '#2a6fb3':['chart-blue','#155da0'],'#279a67':['chart-green','#147046'],'#b23a3a':['chart-red','#a92323'],
};
export function themedCss(css) {
  return css.replace(/#[\da-f]{3,8}\b/gi,hex=>palette[hex.toLowerCase()]?`var(--crm-${palette[hex.toLowerCase()][0]})`:hex)
    .replace(/rgba\(255,\s*255,\s*255,/g,'rgba(var(--crm-overlay-rgb),');
}
export function readTheme(storage) {
  try{return (storage ?? globalThis.localStorage)?.getItem(THEME_KEY)==='light'?'light':'dark';}catch{return 'dark';}
}
export function storeTheme(theme,storage) {
  try{(storage ?? globalThis.localStorage)?.setItem(THEME_KEY,theme);return true;}catch{return false;}
}
const darkText={'#565b66':'#97a1b3'};
const vars=light=>Object.entries(palette).map(([dark,[key,value]])=>`--crm-${key}:${light?value:darkText[dark]||dark};`).join('');
export const THEME_CSS=`
:root{${vars(false)} --crm-overlay-rgb:255,255,255;color-scheme:dark;background:var(--crm-bg);}
:root[data-crm-theme="light"]{${vars(true)} --crm-overlay-rgb:15,23,42;color-scheme:light;}
body{background:var(--crm-bg);color:var(--crm-text);}
.theme-toggle{position:fixed;right:10px;top:8px;z-index:2500;border:1px solid var(--crm-line-strong);border-radius:9px;padding:7px 10px;background:var(--crm-surface);color:var(--crm-text);font:600 12px system-ui;cursor:pointer;display:flex;align-items:center;gap:6px;}
.theme-toggle:focus-visible{outline:3px solid var(--crm-blue);outline-offset:2px;}
.root input::placeholder,.root textarea::placeholder{color:var(--crm-subtle);opacity:1;}
.root .date-calendar-cell.is-today{box-shadow:inset 0 0 0 2px var(--crm-blue);font-weight:800;}
.root .date-calendar-cell.selected{background:var(--crm-blue);color:var(--crm-surface);}
.series-delete-options{display:grid;gap:8px;margin:16px 0;text-align:left;color:var(--crm-text);font-size:13px;}
.series-delete-options label{display:flex;gap:8px;align-items:center;}
.theme-notice{position:fixed;right:10px;top:50px;z-index:2500;padding:8px;background:var(--crm-surface);color:var(--crm-text);}
@media(max-width:600px){.theme-toggle{top:8px;bottom:auto;width:34px;height:34px;justify-content:center;padding:6px;}.theme-toggle span{display:none;}}
`;
