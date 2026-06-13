import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync } from 'node:fs';
const PORT = 7790, base = `http://127.0.0.1:${PORT}`;
const DIR = process.env.SHOT_DIR || '.shots-mobile';
const studios = (process.env.STUDIOS || 'home,object-detection,image-classification,caption,sentiment,summarize,speech-to-text,text-to-speech,semantic-search,translate,mini-chat').split(',');
async function up(u, ms=30000){const d=Date.now()+ms;while(Date.now()<d){try{const r=await fetch(u);if(r.ok)return;}catch{}await sleep(300);}throw new Error('down');}
mkdirSync(DIR,{recursive:true});
const server = spawn('npx',['vite','preview','--port',String(PORT),'--strictPort'],{cwd:process.cwd(),shell:true,stdio:'ignore'});
let b;
try{
  await up(base); b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  // Block model CDN so warm loaders don't dominate; we want layout, not downloads.
  await ctx.route(/huggingface\.co|hf\.co|cdn-lfs/i, r => r.abort());
  const p = await ctx.newPage();
  for(const s of studios){
    const url = s==='home' ? `${base}/` : `${base}/#/${s}`;
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await sleep(900);
    await p.screenshot({ path:`${DIR}/${s}.png`, fullPage:true });
    console.log('shot', s);
  }
  await b.close();
}finally{ if(b){try{await b.close();}catch{}} try{server.kill();}catch{} if(process.platform==='win32'&&server.pid){try{spawn('taskkill',['/pid',String(server.pid),'/T','/F'],{shell:true,stdio:'ignore'});}catch{}} }
