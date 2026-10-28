import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localIsoDate} from '../src/calendar.js';
import {readTheme,storeTheme,THEME_KEY,themedCss,palette} from '../src/theme.js';
import {seriesSelection,hasSessionHistory} from '../src/series.js';
test('Theme preference survives account changes without writing Auth or school storage',()=>{
  const values=new Map([['auth-token','TEST ONLY']]);const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.equal(readTheme(storage),'dark');assert.equal(storeTheme('light',storage),true);assert.equal(readTheme(storage),'light');
  assert.equal(values.get('auth-token'),'TEST ONLY');assert.equal(values.size,2);assert.equal(values.get(THEME_KEY),'light');
  storeTheme('dark',storage);assert.equal(readTheme(storage),'dark');
});
test('Unavailable browser storage does not crash CRM and unknown theme falls back safely',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(readTheme(blocked),'dark');assert.equal(storeTheme('light',blocked),false);
  assert.equal(readTheme({getItem:()=>'<invalid>'}),'dark');
});
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
test('Light theme text, muted text, discipline and status colors have readable contrast on panels',()=>{
  for(const key of ['#edeff2','#8a8f99','#565b66','#3da5ff','#3ddc97','#ffc24b','#ffc83d','#ff5454','#ff8a3d','#ff3d8a','#b14dff','#3dcfff']){
    const color=palette[key][1];assert.ok(1.05/(luminance(color)+.05)>=4.5,key);
  }
  assert.match(themedCss('color:#EDEFF2;background:#16181C;border-color:#2A2E36'),/var\(--crm-text\)/);
});
test('Local calendar dates use the browser timezone, not UTC, including month/year boundaries',()=>{
  assert.equal(localIsoDate(new Date(2026,0,1,0,5)),'2026-01-01');
  for(const [timezone,expected] of [['Asia/Tomsk','2026-10-29'],['America/Los_Angeles','2026-10-28'],['UTC','2026-10-28']]){
    const code="import {localIsoDate} from './src/calendar.js';process.stdout.write(localIsoDate(new Date('2026-10-28T23:30:00Z')));";
    assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ:timezone},encoding:'utf8'}),expected);
  }
});
test('Series scopes rely only on templateId, preserve closed/unknown recorded history and order same-day times',()=>{
  const base={templateId:'A',date:'2026-10-28',time:'16:00',status:'upcoming'};
  const rows=[{...base,id:'before',time:'15:00'},{...base,id:'anchor'},{...base,id:'later',time:'17:00'},
    {...base,id:'done',status:'done'},{...base,id:'missed',status:'missed'},{...base,id:'unknown',attendance:{child:null}},
    {...base,id:'other',templateId:'B',groupName:'same name'}];
  const all=seriesSelection(rows,rows[1],'series');assert.deepEqual(all.deletable.map(s=>s.id),['before','anchor','later']);assert.equal(all.preserved.length,3);
  assert.deepEqual(seriesSelection(rows,rows[1],'following').deletable.map(s=>s.id),['anchor','later']);
  assert.deepEqual(seriesSelection(rows,rows[1],'single').deletable.map(s=>s.id),['anchor']);
  assert.equal(hasSessionHistory({...base,promoResults:{child:'bought'}}),true);
  assert.throws(()=>seriesSelection(rows,rows[1],'all'),/Неизвестный/);
});
