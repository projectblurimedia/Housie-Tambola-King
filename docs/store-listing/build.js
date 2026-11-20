// Play Store graphics: 512×512 icon and 1024×500 feature graphic, drawn as HTML and captured
// with the installed Chrome (same approach as NearbyU).   node docs/store-listing/build.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = __dirname;
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Chrome or Edge is needed');

const img = (file) => `data:image/png;base64,${fs.readFileSync(path.join(dir, file)).toString('base64')}`;
const FONT = `<link href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Poppins:wght@500;600;700&family=Noto+Sans+Telugu:wght@600&display=block" rel="stylesheet">`;

// Full square (Play rounds the corners itself): the art's transparent corners filled with its edge purple.
function icon(src) {
  return `<!doctype html><html><head><style>html,body{margin:0;width:512px;height:512px;overflow:hidden;background:#3a0f6b}img{width:512px;height:512px;display:block}</style></head><body><img src="${img(src)}"></body></html>`;
}

function feature({ src }) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
  html,body{margin:0;width:1024px;height:500px;overflow:hidden}
  body{font-family:Poppins,sans-serif;color:#fff;position:relative;
       background:radial-gradient(circle at 30% 50%,#c026d3 0%,#7e22ce 38%,#3b0a6b 75%,#24073f 100%)}
  .rays{position:absolute;left:-262px;top:-462px;width:1100px;height:1100px;opacity:.13;
        background:repeating-conic-gradient(from 0deg at 50% 50%,#fff 0deg 10deg,transparent 10deg 20deg)}
  .icon{position:absolute;left:70px;top:95px;width:310px;height:310px;border-radius:70px;box-shadow:0 0 0 5px #fde68a,0 24px 70px rgba(255,190,0,.45)}
  .text{position:absolute;left:430px;top:92px;right:40px}
  h1{font-family:"Luckiest Guy",sans-serif;font-weight:400;font-size:62px;line-height:1.02;margin:0;letter-spacing:1px;text-shadow:0 4px 0 rgba(59,7,100,.9)}
  h1 span{color:#ffd43b;text-shadow:0 0 22px rgba(255,196,0,.7),0 4px 0 rgba(59,7,100,.9)}
  p{font-size:27px;font-weight:600;line-height:1.3;margin:16px 0 22px;opacity:.96}
  .chips{display:flex;flex-wrap:wrap;gap:10px}
  .chip{font-family:Poppins,"Noto Sans Telugu",sans-serif;font-size:18px;font-weight:600;padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(253,230,138,.55)}
  </style></head><body>
  <div class="rays"></div>
  <img class="icon" src="${img(src)}">
  <div class="text"><h1>Housie Tambola<br><span>King</span></h1>
  <p>Play Housie live with family &amp; friends.</p>
  <div class="chips"><span class="chip">Private rooms</span><span class="chip">Series games</span><span class="chip">Live caller</span><span class="chip">తెలుగు</span></div></div>
  </body></html>`;
}

const jobs = [
  { out: 'housie-icon-512.png', w: 512, h: 512, html: icon('src-icon.png') },
  { out: 'housie-feature-1024x500.png', w: 1024, h: 500, html: feature({ src: 'src-icon.png' }) },
];

for (const job of jobs) {
  const htmlFile = path.join(dir, `_${job.out}.html`);
  fs.writeFileSync(htmlFile, job.html);
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${job.w},${job.h}`, '--virtual-time-budget=8000', '--default-background-color=00000000',
    `--screenshot=${path.join(dir, job.out)}`, `file:///${htmlFile.split(path.sep).join('/')}`,
  ], { stdio: 'ignore' });
  fs.unlinkSync(htmlFile);
  const b = fs.readFileSync(path.join(dir, job.out));
  console.log(job.out, `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`, `${Math.round(b.length / 1024)} KB`);
}
