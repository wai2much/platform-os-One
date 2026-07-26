/**
 * Dashboard — faithful port of the Front-of-House prototype design.
 * Static sample content for now (resolved from the prototype's seeded data);
 * next step swaps this for real data from the engine. Rendered as the prototype's
 * own inline-styled markup so the look matches 1:1; will be componentised as we wire data.
 */
const HTML = `
<div style="padding:6px 30px 26px;display:flex;flex-direction:column;gap:15px;flex:1;min-height:0">
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    ${['New job', 'New booking', 'New invoice', 'New customer'].map((l) => `
      <span class="fg" style="font-size:12px;font-weight:700;color:var(--text);background:var(--card-bg);box-shadow:0 1px 3px rgba(32,30,29,.06);border-radius:999px;padding:9px 16px;cursor:pointer;display:flex;align-items:center;gap:7px"><span style="color:#c67139">+</span>${l}</span>`).join('')}
  </div>

  <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">
    <div style="background:var(--card-bg);border-radius:16px;padding:15px;box-shadow:0 1px 3px rgba(32,30,29,.06)"><div class="cap" style="color:#c67139;font-size:28px;line-height:1">4</div><div class="fg" style="font-size:10px;color:var(--text-mute);margin-top:8px;font-weight:600">In progress</div></div>
    <div style="background:var(--card-bg);border-radius:16px;padding:15px;box-shadow:0 1px 3px rgba(32,30,29,.06)"><div class="cap" style="color:var(--text);font-size:28px;line-height:1">3</div><div class="fg" style="font-size:10px;color:var(--text-mute);margin-top:8px;font-weight:600">Booked</div></div>
    <div style="background:var(--card-bg);border-radius:16px;padding:15px;box-shadow:0 1px 3px rgba(32,30,29,.06)"><div class="cap" style="color:var(--text);font-size:28px;line-height:1">1</div><div class="fg" style="font-size:10px;color:var(--text-mute);margin-top:8px;font-weight:600">Awaiting approval</div></div>
    <div style="background:var(--card-bg);border-radius:16px;padding:15px;box-shadow:0 1px 3px rgba(32,30,29,.06)"><div class="cap" style="color:#7a8a5e;font-size:28px;line-height:1">2</div><div class="fg" style="font-size:10px;color:var(--text-mute);margin-top:8px;font-weight:600">Ready</div></div>
    <div style="background:var(--card-bg);border-radius:16px;padding:15px;box-shadow:0 1px 3px rgba(32,30,29,.06)"><div class="cap" style="color:#c67139;font-size:28px;line-height:1">2</div><div class="fg" style="font-size:10px;color:var(--text-mute);margin-top:8px;font-weight:600">Parts low</div></div>
    <div style="background:var(--card-bg);border-radius:16px;padding:15px;box-shadow:0 1px 3px rgba(32,30,29,.06)"><div class="cap" style="color:var(--text);font-size:28px;line-height:1">$0</div><div class="fg" style="font-size:10px;color:var(--text-mute);margin-top:8px;font-weight:600">Invoiced today</div></div>
  </div>

  <div style="background:#201e1d;border-radius:24px;padding:20px 24px;display:flex;align-items:center;gap:22px">
    <div style="width:78px;height:78px;border-radius:50%;background:#c67139;display:flex;align-items:center;justify-content:center;flex:none"><div style="width:34px;height:34px;border-radius:50%;background:#f5ead8"></div></div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span class="fg" style="font-size:11px;letter-spacing:.14em;color:#e2b48a;font-weight:700">MERCEDES LEE · HYPER AGENT</span><span class="fg" style="font-size:10px;color:#a8b48e;font-weight:600">● On the floor</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="width:7px;height:7px;border-radius:50%;background:#c67139;flex-shrink:0"></span><span class="fg" style="font-size:12px;color:#f0c9a8;font-weight:600">1 account on credit hold — T. Nguyen, invoice #1042 past Net 14</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="width:7px;height:7px;border-radius:50%;background:#c67139;flex-shrink:0"></span><span class="fg" style="font-size:12px;color:#f0c9a8;font-weight:600">1 NPS detractor — T. Nguyen scored 6/10, needs a follow-up call</span></div>
      <div class="cap" style="color:#f5ead8;font-size:20px;line-height:1.3">Three cars in, one waiting on a Burson part. Shall I chase it?</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <span class="fg" style="font-size:11.5px;font-weight:600;background:#c67139;color:#fff;border-radius:999px;padding:6px 14px">Chase part</span>
        <span class="fg" style="font-size:11.5px;font-weight:600;border:1px solid rgba(245,234,216,.3);color:#f5ead8;border-radius:999px;padding:5px 13px">Today's diary</span>
        <span class="fg" style="font-size:11.5px;font-weight:600;border:1px solid rgba(245,234,216,.3);color:#f5ead8;border-radius:999px;padding:5px 13px">Call customer</span>
      </div>
    </div>
  </div>

  <div class="stack-cols" style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px">
    <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:13px"><span class="cap" style="font-size:15px;color:var(--text)">Today's diary</span><span class="fg" style="font-size:10.5px;color:var(--text-mute2);font-weight:600">3 booked</span></div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:11px;align-items:center"><span class="fg" style="font-size:11.5px;color:#fff;background:#7a8a5e;border-radius:999px;padding:3px 9px;font-weight:700">08:30</span><span class="fg" style="font-size:13px;color:var(--text);font-weight:600;flex:1">BMW 320i · WLR 442</span><span class="fg" style="font-size:10.5px;color:var(--text-mute2);font-weight:600">Bay 1</span></div>
        <div style="display:flex;gap:11px;align-items:center"><span class="fg" style="font-size:11.5px;color:var(--text-soft);background:var(--panel-bg);border-radius:999px;padding:3px 9px;font-weight:700">10:00</span><span class="fg" style="font-size:13px;color:var(--text);font-weight:600;flex:1">Golf GTI · 1TY 9KH</span><span class="fg" style="font-size:10.5px;color:var(--text-mute2);font-weight:600">Bay 2</span></div>
        <div style="display:flex;gap:11px;align-items:center"><span class="fg" style="font-size:11.5px;color:var(--text-soft);background:var(--panel-bg);border-radius:999px;padding:3px 9px;font-weight:700">13:15</span><span class="fg" style="font-size:13px;color:var(--text);font-weight:600;flex:1">Hilux SR5 · 8QT 3ZL</span><span class="fg" style="font-size:10.5px;color:var(--text-mute2);font-weight:600">Bay 3</span></div>
      </div>
    </div>
    <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:13px"><span class="cap" style="font-size:15px;color:var(--text)">In the bays</span><span class="fg" style="font-size:10.5px;color:var(--text-mute2);font-weight:600">4 active</span></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><div class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">Audi A4 · Service B</div><div style="height:6px;background:var(--panel-bg);border-radius:999px;margin-top:7px"><div style="width:72%;height:6px;background:#c67139;border-radius:999px"></div></div></div>
        <div><div class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">Ranger · diagnostic</div><div style="height:6px;background:var(--panel-bg);border-radius:999px;margin-top:7px"><div style="width:38%;height:6px;background:#7a8a5e;border-radius:999px"></div></div></div>
        <div><div class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">Mini S · brakes</div><div style="height:6px;background:var(--panel-bg);border-radius:999px;margin-top:7px"><div style="width:14%;height:6px;background:#dcc9a8;border-radius:999px"></div></div></div>
      </div>
    </div>
    <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:13px"><span class="cap" style="font-size:15px;color:var(--text)">Parts stock</span><span class="fg" style="font-size:10.5px;color:#c67139;font-weight:700">2 low</span></div>
      <div style="display:flex;flex-direction:column;gap:11px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">Penrite 5W-30</span><span class="fg" style="font-size:10px;color:#fff;background:#c67139;border-radius:999px;padding:2px 8px;font-weight:700">2 L</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">Ryco Z516</span><span class="fg" style="font-size:10px;color:#fff;background:#c67139;border-radius:999px;padding:2px 8px;font-weight:700">1 ea</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text-mute);font-weight:600">NGK BKR6E</span><span class="fg" style="font-size:10px;color:var(--text-soft);border:1px solid var(--border-c);border-radius:999px;padding:2px 8px;font-weight:700">Ordered</span></div>
      </div>
    </div>
  </div>

  <div class="stack-cols" style="display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:12px">
    <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:14px">
      <span class="cap" style="font-size:15px;color:var(--text)">Revenue by service</span>
      <div style="display:flex;align-items:center;gap:18px">
        <div style="width:100px;height:100px;border-radius:50%;flex:none;background:conic-gradient(#c67139 0 42%, #7a8a5e 42% 68%, #dcc9a8 68% 86%, #efe0c8 86% 100%)">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--card-bg);margin:22px 0 0 22px;display:flex;align-items:center;justify-content:center"><span class="cap" style="font-size:13px;color:var(--text)">$8.4k</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:#c67139;flex:none"></span><span class="fg" style="font-size:11.5px;color:var(--text-soft);font-weight:600">Servicing · 42%</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:#7a8a5e;flex:none"></span><span class="fg" style="font-size:11.5px;color:var(--text-soft);font-weight:600">Brakes &amp; suspension · 26%</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:#dcc9a8;flex:none"></span><span class="fg" style="font-size:11.5px;color:var(--text-soft);font-weight:600">Diagnostics · 18%</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="width:9px;height:9px;border-radius:50%;background:var(--panel-bg);flex:none"></span><span class="fg" style="font-size:11.5px;color:var(--text-soft);font-weight:600">Other · 14%</span></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid var(--border-c);padding-top:12px">
        <div><div class="fg" style="font-size:9.5px;letter-spacing:.08em;color:var(--text-mute2);font-weight:700">7 DAYS</div><div class="cap" style="font-size:19px;color:var(--text);margin-top:4px">$8,420</div></div>
        <div><div class="fg" style="font-size:9.5px;letter-spacing:.08em;color:var(--text-mute2);font-weight:700">MONTH TO DATE</div><div class="cap" style="font-size:19px;color:var(--text);margin-top:4px">$31,860</div></div>
        <div><div class="fg" style="font-size:9.5px;letter-spacing:.08em;color:var(--text-mute2);font-weight:700">YEAR TO DATE</div><div class="cap" style="font-size:19px;color:var(--text);margin-top:4px">$286,400</div></div>
      </div>
    </div>
    <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="cap" style="font-size:15px;color:var(--text)">Cars through door</span>
        <div style="display:flex;gap:4px;background:var(--panel-bg);border-radius:999px;padding:3px">
          <span class="fg" style="font-size:10px;font-weight:700;color:#fff;background:#c67139;border-radius:999px;padding:4px 10px">7D</span>
          <span class="fg" style="font-size:10px;font-weight:600;color:var(--text-mute);padding:4px 10px">14D</span>
          <span class="fg" style="font-size:10px;font-weight:600;color:var(--text-mute);padding:4px 10px">30D</span>
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:6px;min-height:70px">
        ${[52, 68, 44, 76, 60, 82].map((h) => `<div style="flex:1;height:${h}%;background:var(--panel-bg);border-radius:5px 5px 0 0"></div>`).join('')}
        <div style="flex:1;height:90%;background:#c67139;border-radius:5px 5px 0 0"></div>
      </div>
      <div style="display:flex;justify-content:space-between"><span class="fg" style="font-size:10px;color:var(--text-mute2);font-weight:600">Mon</span><span class="fg" style="font-size:10px;color:var(--text-mute2);font-weight:600">Tue</span><span class="fg" style="font-size:10px;color:var(--text-mute2);font-weight:600">Wed</span><span class="fg" style="font-size:10px;color:var(--text-mute2);font-weight:600">Thu</span><span class="fg" style="font-size:10px;color:var(--text-mute2);font-weight:600">Fri</span><span class="fg" style="font-size:10px;color:var(--text-mute2);font-weight:600">Sat</span><span class="fg" style="font-size:10px;color:#c67139;font-weight:700">Today</span></div>
    </div>
    <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="cap" style="font-size:15px;color:var(--text)">Profit margin</span><span class="fg" style="font-size:10.5px;color:#7a8a5e;font-weight:700">▲ 3pts</span></div>
      <div style="display:flex;align-items:baseline;gap:10px"><span class="cap" style="font-size:34px;color:var(--text)">41%</span><span class="fg" style="font-size:10.5px;color:var(--text-mute2);font-weight:600">last 8 weeks</span></div>
      <div style="display:flex;align-items:flex-end;gap:5px;height:34px">
        ${[58, 64, 52, 70, 66, 78, 74].map((h) => `<div style="flex:1;height:${h}%;background:var(--panel-bg);border-radius:3px 3px 0 0"></div>`).join('')}
        <div style="flex:1;height:100%;background:#c67139;border-radius:3px 3px 0 0"></div>
      </div>
    </div>
  </div>

  <div class="stack-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:9px">
        <span class="cap" style="font-size:15px;color:var(--text)">Credits &amp; follow-ups</span>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">T. Nguyen · invoice #1042</span><span style="display:flex;gap:6px;align-items:center"><span class="fg" style="font-size:10.5px;color:#fff;background:#201e1d;border:1px solid #c67139;border-radius:999px;padding:3px 9px;font-weight:700">Credit hold</span><span class="fg" style="font-size:10.5px;color:#fff;background:#c67139;border-radius:999px;padding:3px 10px;font-weight:700">Overdue 12d</span><span class="fg" style="font-size:10.5px;font-weight:700;color:#201e1d;background:var(--panel-bg);border-radius:999px;padding:3px 10px;cursor:pointer">Notify</span></span></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">L. Farrow · store credit</span><span class="fg" style="font-size:10.5px;color:var(--text-soft);border:1.4px solid var(--border-c);border-radius:999px;padding:2px 9px;font-weight:700">Needs follow-up</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">M. Petrakis · invoice #1039</span><span class="fg" style="font-size:10.5px;color:#fff;background:#c67139;border-radius:999px;padding:3px 10px;font-weight:700">Overdue 4d</span></div>
      </div>
      <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:9px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="cap" style="font-size:15px;color:var(--text)">Customer NPS</span><span class="fg" style="font-size:10.5px;color:#7a8a5e;font-weight:700">72 · Promoter zone</span></div>
        ${[['T. Nguyen', 6, '#c67139', 'Follow up'], ['S. Okafor', 9, '#7a8a5e', 'Thank'], ['J. Bianchi', 8, '#7a8a5e', 'Thank']].map(([n, s, bg, label]) => `
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">${n} · scored ${s}/10</span><span class="fg" style="font-size:10.5px;color:#fff;background:${bg};border-radius:999px;padding:3px 10px;font-weight:700;cursor:pointer">${label}</span></div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:9px">
        <span class="cap" style="font-size:15px;color:var(--text)">Upcoming</span>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">A. Costa · service recheck</span><span class="fg" style="font-size:10.5px;color:var(--text-soft);font-weight:600">Tomorrow 9:00</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">Fleet quote · Baxter Logistics</span><span class="fg" style="font-size:10.5px;color:var(--text-soft);font-weight:600">Due Mon</span></div>
      </div>
      <div style="background:var(--card-bg);border-radius:20px;padding:17px;box-shadow:0 1px 3px rgba(32,30,29,.06);display:flex;flex-direction:column;gap:9px">
        <span class="cap" style="font-size:15px;color:var(--text)">Staff attendance</span>
        ${[['Sam Okafor', 'On shift', '#fff', '#7a8a5e'], ['Dean Whitlock', 'On shift', '#fff', '#7a8a5e'], ['Anthony Ruiz', 'Break', 'var(--text-soft)', 'var(--panel-bg)']].map(([n, st, color, bg]) => `
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="fg" style="font-size:12.5px;color:var(--text);font-weight:600">${n}</span><span class="fg" style="font-size:10.5px;font-weight:700;color:${color};background:${bg};border-radius:999px;padding:3px 10px">${st}</span></div>`).join('')}
      </div>
    </div>
  </div>
</div>`;

export function Dashboard() {
  return <div dangerouslySetInnerHTML={{ __html: HTML }} />;
}
