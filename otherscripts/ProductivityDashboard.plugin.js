/**
 * @name ProductivityDashboard
 * @author GPT-5.3-Codex
 * @version 1.0.0
 * @description Local productivity mini-app with tasks, quick links, notes, and overview inside Discord.
 */

module.exports = class ProductivityDashboard {
  constructor() {
    this.pluginName = "ProductivityDashboard";
    this.styleId = "pd-styles";
    this.modalId = "pd-modal";
    this.btnId = "pd-float-btn";
    this.handlers = [];
    this.defaultData = {tasks: [], links: [], notes: [], activity: []};
    this.defaultSettings = {buttonPosition: "right", compactMode: false, floatingButton: true, confirmDelete: true, defaultTaskPriority: "Medium"};
    this.data = this.loadData();
    this.settings = this.loadSettings();
  }

  start() { this.injectStyles(); this.renderButton(); BdApi.UI.showToast("ProductivityDashboard started", {type: "success"}); }
  stop() { this.cleanup(); BdApi.DOM.removeStyle(this.styleId); document.getElementById(this.modalId)?.remove(); document.getElementById(this.btnId)?.remove(); }

  cleanup() { this.handlers.forEach(({el,t,fn}) => { try { el.removeEventListener(t, fn); } catch (_) {} }); this.handlers = []; }
  loadData() { return Object.assign({}, this.defaultData, BdApi.Data.load(this.pluginName, "data") || {}); }
  saveData() { BdApi.Data.save(this.pluginName, "data", this.data); }
  loadSettings() { return Object.assign({}, this.defaultSettings, BdApi.Data.load(this.pluginName, "settings") || {}); }
  saveSettings() { BdApi.Data.save(this.pluginName, "settings", this.settings); }
  logActivity(text) { this.data.activity.unshift({text, date: new Date().toISOString()}); this.data.activity = this.data.activity.slice(0, 30); this.saveData(); }

  renderButton() {
    document.getElementById(this.btnId)?.remove();
    if (!this.settings.floatingButton) return;
    const b = document.createElement("button");
    b.id = this.btnId; b.textContent = "⚡"; b.title = "Open Productivity Dashboard";
    b.style[this.settings.buttonPosition === "left" ? "left" : "right"] = "20px";
    const fn = () => this.open();
    b.addEventListener("click", fn); this.handlers.push({el:b,t:"click",fn});
    document.body.appendChild(b);
  }

  open() {
    document.getElementById(this.modalId)?.remove();
    const root = document.createElement("div");
    root.id = this.modalId;
    root.innerHTML = `<div class="pd-backdrop"><div class="pd-modal ${this.settings.compactMode ? "compact" : ""}">
      <div class="pd-header"><h2>Productivity Dashboard</h2><button class="pd-close">✕</button></div>
      <div class="pd-tabs"><button data-tab="overview">Overview</button><button data-tab="tasks">Tasks</button><button data-tab="links">Quick Links</button><button data-tab="notes">Notes</button><button data-tab="settings">Settings</button></div>
      <div class="pd-content"></div>
    </div></div>`;
    document.body.appendChild(root);
    this.bind(root);
    this.renderTab(root, "overview");
  }

  bind(root) {
    const on=(sel,t,fn)=>{const el=root.querySelector(sel); if(!el) return; el.addEventListener(t,fn); this.handlers.push({el,t,fn});};
    on(".pd-close","click",()=>root.remove());
    root.querySelectorAll(".pd-tabs button").forEach((btn)=>{
      const fn=()=>this.renderTab(root, btn.dataset.tab);
      btn.addEventListener("click",fn); this.handlers.push({el:btn,t:"click",fn});
    });
  }

  renderTab(root, tab) {
    const c = root.querySelector(".pd-content"); if (!c) return;
    if (tab === "overview") return this.renderOverview(c, root);
    if (tab === "tasks") return this.renderTasks(c, root);
    if (tab === "links") return this.renderLinks(c, root);
    if (tab === "notes") return this.renderNotes(c, root);
    if (tab === "settings") return this.renderSettings(c, root);
  }

  renderOverview(c, root) {
    const completed = this.data.tasks.filter(t=>t.completed).length;
    c.innerHTML = `<div class="pd-grid">
      <div class="pd-card"><h3>Total Tasks</h3><p>${this.data.tasks.length}</p></div>
      <div class="pd-card"><h3>Completed</h3><p>${completed}</p></div>
      <div class="pd-card"><h3>Pending</h3><p>${this.data.tasks.length - completed}</p></div>
      <div class="pd-card"><h3>Quick Links</h3><p>${this.data.links.length}</p></div>
    </div>
    <div class="pd-card"><h3>Recent Activity</h3><ul>${this.data.activity.slice(0,10).map(a=>`<li>${this.esc(a.text)} · ${new Date(a.date).toLocaleString()}</li>`).join("") || "<li>No activity yet.</li>"}</ul></div>
    <div class="pd-actions"><button class="qa-task">Add Task</button><button class="qa-link">Add Link</button><button class="qa-note">Add Note</button></div>`;
    c.querySelector(".qa-task")?.addEventListener("click",()=>{this.quickAddTask(); this.renderOverview(c, root);});
    c.querySelector(".qa-link")?.addEventListener("click",()=>{this.quickAddLink(); this.renderOverview(c, root);});
    c.querySelector(".qa-note")?.addEventListener("click",()=>{this.quickAddNote(); this.renderOverview(c, root);});
  }

  renderTasks(c, root) {
    c.innerHTML = `<div class="pd-toolbar"><input class="t-search" placeholder="Search tasks"/><select class="t-status"><option>All</option><option>Completed</option><option>Pending</option></select><select class="t-priority"><option>All</option><option>High</option><option>Medium</option><option>Low</option></select><select class="t-sort"><option value="date">Sort: Date</option><option value="priority">Sort: Priority</option><option value="completion">Sort: Completion</option></select><button class="t-add">Add Task</button></div><div class="t-list"></div>`;
    const render=()=>{
      const q=c.querySelector(".t-search").value.toLowerCase(), s=c.querySelector(".t-status").value, p=c.querySelector(".t-priority").value, sort=c.querySelector(".t-sort").value;
      const weight={High:3,Medium:2,Low:1};
      let arr=this.data.tasks.filter(t=>(!q||`${t.title} ${t.description||""}`.toLowerCase().includes(q))&&(s==="All"||(s==="Completed"?t.completed:!t.completed))&&(p==="All"||t.priority===p));
      arr=arr.sort((a,b)=>sort==="priority"?weight[b.priority]-weight[a.priority]:sort==="completion"?Number(a.completed)-Number(b.completed):new Date(b.createdAt)-new Date(a.createdAt));
      c.querySelector(".t-list").innerHTML=arr.map(t=>`<div class="pd-card"><b>${this.esc(t.title)}</b><div>${this.esc(t.description||"")}</div><small>Due: ${t.dueDate||"—"} · Priority: ${t.priority} · Created: ${new Date(t.createdAt).toLocaleString()} · ${t.completed?"Completed":"Pending"}</small><div class="pd-actions"><button data-id="${t.id}" class="tg">${t.completed?"Undo":"Complete"}</button><button data-id="${t.id}" class="te">Edit</button><button data-id="${t.id}" class="td danger">Delete</button></div></div>`).join("") || "<div class='pd-card'>No tasks found.</div>";
      c.querySelectorAll(".tg").forEach(b=>b.onclick=()=>{const t=this.data.tasks.find(x=>x.id===b.dataset.id); if(!t) return; t.completed=!t.completed; this.logActivity(`${t.completed?"Completed":"Reopened"} task: ${t.title}`); this.saveData(); render();});
      c.querySelectorAll(".te").forEach(b=>b.onclick=()=>this.editTask(b.dataset.id, render));
      c.querySelectorAll(".td").forEach(b=>b.onclick=()=>this.deleteWithConfirm(()=>{this.data.tasks=this.data.tasks.filter(x=>x.id!==b.dataset.id); this.logActivity("Deleted task"); this.saveData(); render();},"Delete task?"));
    };
    [".t-search",".t-status",".t-priority",".t-sort"].forEach(s=>c.querySelector(s).addEventListener("input",render));
    c.querySelector(".t-add").addEventListener("click",()=>{this.quickAddTask(); render();});
    render();
  }

  renderLinks(c) {
    c.innerHTML=`<div class="pd-toolbar"><input class="l-search" placeholder="Search links"/><input class="l-cat" placeholder="Filter category"/><button class="l-add">Add Link</button></div><div class="l-list"></div>`;
    const render=()=>{
      const q=c.querySelector(".l-search").value.toLowerCase(),cat=c.querySelector(".l-cat").value.toLowerCase();
      const arr=this.data.links.filter(l=>(!q||`${l.label} ${l.url}`.toLowerCase().includes(q))&&(!cat||(l.category||"").toLowerCase().includes(cat)));
      c.querySelector(".l-list").innerHTML=arr.map(l=>`<div class="pd-card"><b>${this.esc(l.label)}</b><div>${this.esc(l.url)}</div><small>Category: ${this.esc(l.category||"—")}</small><div class="pd-actions"><button data-id="${l.id}" class="lo">Open</button><button data-id="${l.id}" class="lc">Copy</button><button data-id="${l.id}" class="le">Edit</button><button data-id="${l.id}" class="ld danger">Delete</button></div></div>`).join("")||"<div class='pd-card'>No links found.</div>";
      c.querySelectorAll(".lo").forEach(b=>b.onclick=()=>window.open((this.data.links.find(x=>x.id===b.dataset.id)||{}).url,"_blank"));
      c.querySelectorAll(".lc").forEach(b=>b.onclick=async()=>{const l=this.data.links.find(x=>x.id===b.dataset.id); if(!l) return; await navigator.clipboard.writeText(l.url); BdApi.UI.showToast("Copied",{type:"success"});});
      c.querySelectorAll(".le").forEach(b=>b.onclick=()=>this.editLink(b.dataset.id, render));
      c.querySelectorAll(".ld").forEach(b=>b.onclick=()=>this.deleteWithConfirm(()=>{this.data.links=this.data.links.filter(x=>x.id!==b.dataset.id); this.logActivity("Deleted link"); this.saveData(); render();},"Delete link?"));
    };
    c.querySelector(".l-search").addEventListener("input",render); c.querySelector(".l-cat").addEventListener("input",render);
    c.querySelector(".l-add").addEventListener("click",()=>{this.quickAddLink(); render();});
    render();
  }

  renderNotes(c){
    c.innerHTML=`<div class="pd-toolbar"><input class="n-search" placeholder="Search notes"/><button class="n-add">Add Note</button></div><div class="n-list"></div>`;
    const render=()=>{
      const q=c.querySelector(".n-search").value.toLowerCase();
      const arr=[...this.data.notes].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt)).filter(n=>!q||`${n.title} ${n.body}`.toLowerCase().includes(q));
      c.querySelector(".n-list").innerHTML=arr.map(n=>`<div class="pd-card"><b>${n.pinned?"📌 ":""}${this.esc(n.title)}</b><div>${this.esc(n.body)}</div><small>Created: ${new Date(n.createdAt).toLocaleString()} · Updated: ${new Date(n.updatedAt).toLocaleString()}</small><div class="pd-actions"><button data-id="${n.id}" class="np">${n.pinned?"Unpin":"Pin"}</button><button data-id="${n.id}" class="ne">Edit</button><button data-id="${n.id}" class="nd danger">Delete</button></div></div>`).join("")||"<div class='pd-card'>No notes found.</div>";
      c.querySelectorAll(".np").forEach(b=>b.onclick=()=>{const n=this.data.notes.find(x=>x.id===b.dataset.id); if(!n) return; n.pinned=!n.pinned; n.updatedAt=new Date().toISOString(); this.saveData(); render();});
      c.querySelectorAll(".ne").forEach(b=>b.onclick=()=>this.editNote(b.dataset.id, render));
      c.querySelectorAll(".nd").forEach(b=>b.onclick=()=>this.deleteWithConfirm(()=>{this.data.notes=this.data.notes.filter(x=>x.id!==b.dataset.id); this.logActivity("Deleted note"); this.saveData(); render();},"Delete note?"));
    };
    c.querySelector(".n-search").addEventListener("input",render); c.querySelector(".n-add").addEventListener("click",()=>{this.quickAddNote(); render();});
    render();
  }

  renderSettings(c, root){
    c.innerHTML=`<div class="pd-card"><label><input type="checkbox" class="s-compact" ${this.settings.compactMode?"checked":""}/> Compact mode</label><br/><label><input type="checkbox" class="s-float" ${this.settings.floatingButton?"checked":""}/> Floating button</label><br/><label><input type="checkbox" class="s-confirm" ${this.settings.confirmDelete?"checked":""}/> Confirm before delete</label><br/><label>Button position <select class="s-pos"><option value="right" ${this.settings.buttonPosition==="right"?"selected":""}>Right</option><option value="left" ${this.settings.buttonPosition==="left"?"selected":""}>Left</option></select></label><br/><label>Default task priority <select class="s-pri"><option ${this.settings.defaultTaskPriority==="Low"?"selected":""}>Low</option><option ${this.settings.defaultTaskPriority==="Medium"?"selected":""}>Medium</option><option ${this.settings.defaultTaskPriority==="High"?"selected":""}>High</option></select></label><div class="pd-actions"><button class="s-export">Export JSON</button><button class="s-import">Import JSON</button><button class="s-clear danger">Clear All Data</button></div></div>`;
    c.querySelector(".s-compact").onchange=e=>{this.settings.compactMode=e.target.checked; this.saveSettings(); this.open();};
    c.querySelector(".s-float").onchange=e=>{this.settings.floatingButton=e.target.checked; this.saveSettings(); this.renderButton();};
    c.querySelector(".s-confirm").onchange=e=>{this.settings.confirmDelete=e.target.checked; this.saveSettings();};
    c.querySelector(".s-pos").onchange=e=>{this.settings.buttonPosition=e.target.value; this.saveSettings(); this.renderButton();};
    c.querySelector(".s-pri").onchange=e=>{this.settings.defaultTaskPriority=e.target.value; this.saveSettings();};
    c.querySelector(".s-export").onclick=()=>{const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify({data:this.data,settings:this.settings},null,2)],{type:"application/json"})); a.download="productivity-dashboard.json"; a.click(); URL.revokeObjectURL(a.href);};
    c.querySelector(".s-import").onclick=()=>{const i=document.createElement("input"); i.type="file"; i.accept="application/json"; i.onchange=async()=>{try{const j=JSON.parse(await i.files[0].text()); this.data=Object.assign({},this.defaultData,j.data||{}); this.settings=Object.assign({},this.defaultSettings,j.settings||{}); this.saveData(); this.saveSettings(); this.renderButton(); this.open(); BdApi.UI.showToast("Imported",{type:"success"});}catch{BdApi.UI.showToast("Import failed",{type:"error"});}}; i.click();};
    c.querySelector(".s-clear").onclick=()=>this.deleteWithConfirm(()=>{this.data={tasks:[],links:[],notes:[],activity:[]}; this.saveData(); this.renderTab(root,"overview");},"Clear all plugin data?");
  }

  quickAddTask(){const title=prompt("Task title:","")?.trim(); if(!title) return; const description=prompt("Description (optional):","")||""; const dueDate=prompt("Due date (optional, YYYY-MM-DD):","")||""; const priority=(prompt("Priority: Low, Medium, High",this.settings.defaultTaskPriority)||this.settings.defaultTaskPriority); this.data.tasks.unshift({id:crypto.randomUUID(),title,description,dueDate,priority:["Low","Medium","High"].includes(priority)?priority:this.settings.defaultTaskPriority,completed:false,createdAt:new Date().toISOString()}); this.logActivity(`Added task: ${title}`); this.saveData();}
  quickAddLink(){const label=prompt("Link label:","")?.trim(); const url=prompt("URL:","https://"); if(!label||!url) return; const category=prompt("Category (optional):","")||""; this.data.links.unshift({id:crypto.randomUUID(),label,url,category,createdAt:new Date().toISOString()}); this.logActivity(`Added link: ${label}`); this.saveData();}
  quickAddNote(){const title=prompt("Note title:","")?.trim(); if(!title) return; const body=prompt("Note body:","")||""; const now=new Date().toISOString(); this.data.notes.unshift({id:crypto.randomUUID(),title,body,pinned:false,createdAt:now,updatedAt:now}); this.logActivity(`Added note: ${title}`); this.saveData();}
  editTask(id,done){const t=this.data.tasks.find(x=>x.id===id); if(!t) return; t.title=prompt("Title:",t.title)||t.title; t.description=prompt("Description:",t.description||"")||""; t.dueDate=prompt("Due date:",t.dueDate||"")||""; const p=prompt("Priority (Low, Medium, High):",t.priority)||t.priority; t.priority=["Low","Medium","High"].includes(p)?p:t.priority; this.logActivity(`Edited task: ${t.title}`); this.saveData(); done();}
  editLink(id,done){const l=this.data.links.find(x=>x.id===id); if(!l) return; l.label=prompt("Label:",l.label)||l.label; l.url=prompt("URL:",l.url)||l.url; l.category=prompt("Category:",l.category||"")||""; this.logActivity(`Edited link: ${l.label}`); this.saveData(); done();}
  editNote(id,done){const n=this.data.notes.find(x=>x.id===id); if(!n) return; n.title=prompt("Title:",n.title)||n.title; n.body=prompt("Body:",n.body)||n.body; n.updatedAt=new Date().toISOString(); this.logActivity(`Edited note: ${n.title}`); this.saveData(); done();}
  deleteWithConfirm(action,text){if(!this.settings.confirmDelete) return action(); BdApi.UI.showConfirmationModal(text,"This action cannot be undone.",{onConfirm:action});}
  esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}

  injectStyles(){BdApi.DOM.addStyle(this.styleId,`
    #${this.btnId}{position:fixed;bottom:64px;z-index:10000;width:46px;height:46px;border-radius:999px;border:none;background:#57f287;color:#102316;font-weight:700;box-shadow:0 10px 26px rgba(0,0,0,.35);cursor:pointer}
    #${this.modalId} .pd-backdrop{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.55);display:flex;justify-content:center;align-items:center;padding:18px}
    #${this.modalId} .pd-modal{width:min(1100px,96vw);max-height:92vh;overflow:auto;background:#1f2329;border:1px solid #323a48;border-radius:14px;color:#e7ebf3;padding:16px}
    #${this.modalId} .pd-modal.compact .pd-card{padding:10px}
    .pd-header{display:flex;justify-content:space-between;align-items:center}.pd-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .pd-tabs button,.pd-close,.pd-toolbar input,.pd-toolbar select,.pd-toolbar button,.pd-actions button{background:#2b313c;color:#e8edf9;border:1px solid #3d4658;border-radius:8px;padding:8px 10px}
    .pd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.pd-card{background:#252c37;border:1px solid #394254;border-radius:12px;padding:14px;margin-bottom:10px}
    .pd-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:8px}.pd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .danger{background:#602834 !important;border-color:#8c3e50 !important}
  `);}
};
