import {useEffect,useState} from 'react';
export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function useLocalToday() {
  const [today,setToday]=useState(()=>localIsoDate());
  useEffect(()=>{
    const refresh=()=>setToday(localIsoDate());
    const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);refresh();
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  return today;
}
export function useCalendarSelection() {
  const today=useLocalToday();
  const [selection,setSelection]=useState(null);
  // An untouched calendar follows local midnight; an explicitly selected date never jumps.
  return [selection ?? today,date=>setSelection(date)];
}
