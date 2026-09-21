import * as XLSX from "xlsx";
import Papa from "papaparse";
export const digits=(v:any)=>String(v??"").replace(/\\D/g,"");
export const phone=(v:any)=>{let d=digits(v);if(d.length===10||d.length===11)d="55"+d;return d};
export const cpf=(v:any)=>digits(v);
const norm=(v:any)=>String(v??"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().trim();
const aliases:any={nome:["nome","cliente","beneficiario","beneficiário","name"],cpf:["cpf","documento"],telefone:["telefone","celular","fone","fone1","telefone1","phone"],telefone2:["telefone2","celular2","fone2"],cidade:["cidade","municipio","município"],uf:["uf","estado"],produto:["produto","modalidade"],observacao:["observacao","observação","obs"]};
export async function parseFile(file:File){
 const ext=file.name.split(".").pop()?.toLowerCase()||"";
 let rows:any[]=[];
 if(ext==="csv"||ext==="txt"){const text=await file.text(); const r=Papa.parse(text,{header:true,skipEmptyLines:true}); rows=(r.data||[]) as any[]}
 else {const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const ws=wb.Sheets[wb.SheetNames[0]]; rows=XLSX.utils.sheet_to_json(ws,{defval:""})}
 const cols=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
 const find=(names:string[])=>{const c=cols.find(x=>names.includes(norm(x)));return c};
 const map:any={};for(const k of Object.keys(aliases))map[k]=find(aliases[k]);
 const parsed=rows.map(r=>({nome:map.nome?r[map.nome]:"",cpf:cpf(map.cpf?r[map.cpf]:""),telefone:phone(map.telefone?r[map.telefone]:""),telefone2:phone(map.telefone2?r[map.telefone2]:""),cidade:map.cidade?r[map.cidade]:"",uf:map.uf?r[map.uf]:"",produto:map.produto?r[map.produto]:"",observacao:map.observacao?r[map.observacao]:"",extras:Object.fromEntries(Object.entries(r).filter(([k])=>!Object.values(map).includes(k))) }));
 return {ext,cols,map,rows:parsed,total:parsed.length,validos:parsed.filter(x=>x.nome&&x.telefone).length};
}