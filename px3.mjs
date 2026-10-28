import WebSocket from "ws";
import { writeFileSync } from "node:fs";
const t = await fetch("http://127.0.0.1:9240/json/new?about:blank", { method: "PUT" }).then(r => r.json());
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.once("open", r));
let id = 0; const pending = new Map();
ws.on("message", m => { const d = JSON.parse(m.toString()); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (r) => r ? res(r) : rej(new Error("fail"))); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(4000);
await send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: 3000 });
await sleep(3000);
const r = await send("Runtime.evaluate", { returnByValue: true, expression: `
(() => { const c = document.querySelector('canvas'); const g = c.getContext('2d'); const w=c.width,h=c.height; let hits=0;
for (let i=1;i<=24;i++) for (let j=1;j<=24;j++){ const d=g.getImageData(Math.floor(w*i/25),Math.floor(h*j/25),1,1).data; if(d[3]>4) hits++; }
return { w,h,hits }; })()` });
console.log(r.result.value);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/tmp/shots2/j7.png", Buffer.from(shot.data, "base64"));
ws.close();
