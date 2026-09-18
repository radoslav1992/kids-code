const KEY = 'kids-code-progress-v1';
export function readProgress(): string[] {try {const data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(x=>typeof x==='string').slice(0,100):[];}catch{return [];}}
export function complete(id:string) {const ids=readProgress();if(!ids.includes(id))ids.push(id);try{localStorage.setItem(KEY,JSON.stringify(ids));}catch{}window.dispatchEvent(new Event('kids-progress'));}
export function clearProgress(){try{localStorage.removeItem(KEY);}catch{}window.dispatchEvent(new Event('kids-progress'));}
export function save(key:string,value:string){try{localStorage.setItem('kids-code-'+key,value);}catch{}}
export function read(key:string){try{return localStorage.getItem('kids-code-'+key);}catch{return null;}}
