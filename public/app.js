/* JARVIS interface. No API key is ever stored or accepted by this browser app. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE = 'jarvis.v1';
  const defaults = () => ({ conversations: [], activeId: null, notes: [], tasks: [], memories: [], autoSpeak: false, autoSend: false });
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE));
      if (!value || typeof value !== 'object') return defaults();
      const state = { ...defaults(), ...value };
      for (const field of ['conversations','notes','tasks','memories']) if (!Array.isArray(state[field])) state[field] = [];
      return state;
    } catch { return defaults(); }
  }
  const state = load();
  let aiStatus = { mode: 'demo', model: 'Demo (offline)' };
  let view = 'dashboard';
  let busy = false;
  let toastTimer;
  let recognizer = null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechAvailable = !!SpeechRecognition;
  const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dateLabel = stamp => new Date(stamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch { notice('Local storage is unavailable or full.', true); } };
  function notice(message, error=false) {
    const toast = $('toast'); toast.textContent = message; toast.className = error ? 'toast show error' : 'toast show';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3400);
  }
  function node(tag, className='', content='') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined && content !== null) element.textContent = String(content);
    return element;
  }
  function setView(next) {
    if (!document.getElementById(`view-${next}`)) return;
    view = next;
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${next}`));
    document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === next));
    $('sidebar').classList.remove('open');
    $('page-title').textContent = ({ dashboard:'Command center',chat:'AI conversation',conversations:'Conversation history',notes:'Notes',tasks:'Tasks',memory:'AI memory',settings:'Settings' })[next];
    if (next === 'chat') { renderMessages(); renderSessions(); }
    if (next === 'conversations') renderHistory();
    if (next === 'notes') renderNotes();
    if (next === 'tasks') renderTasks();
    if (next === 'memory') renderMemories();
    window.location.hash = next;
  }
  function greeting() {
    const hour = new Date().getHours();
    $('dashboard-title').textContent = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
    const dot = $('dashboard-title').lastChild;
    if (dot.nodeType === Node.TEXT_NODE) {
      $('dashboard-title').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      $('dashboard-title').append(node('span', 'accent', '.'));
    }
    $('top-date').textContent = new Date().toLocaleDateString(undefined,{ weekday:'short',month:'short',day:'numeric' }).toUpperCase();
  }
  function getActive() { return state.conversations.find(x => x.id === state.activeId) || null; }
  function createConversation(activate = true) {
    const conv = { id:newId(), title:'New conversation', created:Date.now(), messages:[] };
    state.conversations.unshift(conv);
    if (activate) state.activeId = conv.id;
    save(); renderCounters(); renderSessions();
    if (activate) { setView('chat'); $('chat-input').focus(); }
    return conv;
  }
  function ensureConversation() { return getActive() || createConversation(false); }
  function goConversation(id) { state.activeId=id; save(); setView('chat'); }
  function renderCounters() {
    const active = state.tasks.filter(task => !task.done).length;
    for (const [id,value] of [['history-count',state.conversations.length],['notes-count',state.notes.length],['tasks-count',active],['memory-count',state.memories.length]]) $(id).textContent=value;
    for (const [id,value] of [['summary-convs',state.conversations.length],['summary-tasks',active],['summary-notes',state.notes.length],['summary-memories',state.memories.length]]) $(id).textContent=String(value).padStart(2,'0');
  }
  function renderSessions() {
    const list = $('chat-session-list'); list.replaceChildren();
    if (!state.conversations.length) { list.append(node('p', 'settings-copy', 'No conversations yet.')); return; }
    for (const conv of state.conversations) {
      const btn=node('button','session-item' + (conv.id===state.activeId?' selected':'')); btn.type='button';
      btn.append(node('strong','',conv.title),node('small','',dateLabel(conv.created)));
      btn.addEventListener('click',()=>goConversation(conv.id)); list.append(btn);
    }
  }
  function renderMessages() {
    const wrap = $('messages'); wrap.replaceChildren();
    const conv = getActive();
    if (!conv || !conv.messages.length) {
      const empty = node('div','empty-chat');
      empty.append(node('div','empty-chat-symbol','J'),node('h3','','Your mind. Supercharged.'),node('p','', aiStatus.mode === 'live' ? 'Ask a question, capture a thought, or start a conversation. JARVIS is ready.' : 'Welcome to JARVIS. The interface is ready in demo mode. Connect an AI key on the server for real intelligent answers.'));
      wrap.append(empty);
    } else for (const msg of conv.messages) appendMessageElement(msg);
    wrap.scrollTop = wrap.scrollHeight;
  }
  function appendMessageElement(message) {
    const el = node('div',`message ${message.role}`);
    const avatar = node('div','message-avatar',message.role === 'user'?'U':'J');
    const body = node('div','message-body');
    body.append(node('div','message-meta',message.role === 'user'?'YOU':'JARVIS'));
    const bubble = node('div','bubble' + (message.error?' error':''),message.content);
    body.append(bubble); el.append(avatar,body); $('messages').append(el);
    return bubble;
  }
  function renderHistory() {
    const list=$('history-list'); list.replaceChildren();
    if (!state.conversations.length) return list.append(emptyState('No conversation history','Your conversations will appear here after you start chatting.'));
    for (const conv of state.conversations) {
      const card=node('div','record-card open-record');card.tabIndex=0;card.setAttribute('role','button');
      card.append(node('div','card-kicker','CONVERSATION'),node('h3','',conv.title),node('p','',`${conv.messages.length} messages`));
      const footer=node('footer'); const del=deleteButton(()=>{
        if (!confirm('Delete this conversation?')) return;
        state.conversations=state.conversations.filter(x=>x.id!==conv.id);
        if(state.activeId===conv.id) state.activeId=state.conversations[0]?.id||null;
        save();renderCounters();renderHistory();renderSessions();notice('Conversation deleted.');
      });
      footer.append(node('time','',dateLabel(conv.created)),del);card.append(footer);
      card.addEventListener('click',e=>{if(!e.target.closest('.icon-delete'))goConversation(conv.id);});
      card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.icon-delete')){e.preventDefault();goConversation(conv.id);}});
      list.append(card);
    }
  }
  function emptyState(title,description) { const el=node('div','empty-state');el.append(node('strong','',title),node('p','',description));return el; }
  function deleteButton(fn) { const b=node('button','icon-delete','Delete'); b.type='button'; b.setAttribute('aria-label','Delete'); b.addEventListener('click',e=>{e.stopPropagation();fn();}); return b; }
  function editButton(fn) { const b=node('button','small-button','Edit'); b.type='button'; b.addEventListener('click',e=>{e.stopPropagation();fn();});return b; }
  function renderNotes() {
    const list=$('notes-list'); list.replaceChildren();
    if (!state.notes.length) return list.append(emptyState('No notes yet','Use the form above to save your first note.'));
    for (const note of state.notes) {
      const card=node('article','record-card');
      card.append(node('div','card-kicker','PERSONAL NOTE'),node('h3','',note.title),node('p','',note.body));
      const footer=node('footer');const buttons=node('div','card-actions');
      buttons.style.display='flex';buttons.style.gap='8px';
      buttons.append(editButton(()=>{const title=prompt('Edit note title:',note.title);if(title===null)return;const body=prompt('Edit note content:',note.body);if(body===null)return; if (!title.trim()||!body.trim()) return notice('Title and content cannot be empty.',true);note.title=title.slice(0,80);note.body=body.slice(0,5000);save();renderNotes();notice('Note updated.');}),deleteButton(()=>{if(!confirm('Delete this note?'))return;state.notes=state.notes.filter(x=>x.id!==note.id);save();renderNotes();renderCounters();}));
      footer.append(node('time','',dateLabel(note.created)),buttons);card.append(footer);list.append(card);
    }
  }
  function renderTasks() {
    const list=$('tasks-list'); list.replaceChildren();
    const completed=state.tasks.filter(t=>t.done).length;
    $('task-progress-label').textContent=`${completed} / ${state.tasks.length} completed`;
    $('task-progress-bar').style.width=state.tasks.length ? `${Math.round(completed / state.tasks.length*100)}%`:'0%';
    if (!state.tasks.length) list.append(emptyState('No tasks yet','Add your first mission above.'));
    for (const task of [...state.tasks].sort((a,b)=>Number(a.done)-Number(b.done))) {
      const card=node('div','task-item');
      const check=node('button','task-check'+(task.done?' done':''),task.done?'✓':'');check.type='button';check.setAttribute('aria-label',task.done?'Mark task incomplete':'Complete task');
      check.addEventListener('click',()=>{task.done=!task.done;save();renderTasks();renderCounters();});
      const label=node('div','task-text'+(task.done?' done':''),task.title);
      const edit=editButton(()=>{const next=prompt('Edit task:',task.title);if(next===null||!next.trim())return;task.title=next.trim().slice(0,220);save();renderTasks();});
      const del=deleteButton(()=>{if(!confirm('Delete this task?'))return;state.tasks=state.tasks.filter(x=>x.id!==task.id);save();renderTasks();renderCounters();});
      card.append(check,label,node('small','',dateLabel(task.created)),edit,del);list.append(card);
    }
  }
  function renderMemories() {
    const list=$('memory-list');list.replaceChildren();
    if (!state.memories.length)return list.append(emptyState('Your memory is empty','Add preferences and useful facts above, and JARVIS will use them for AI chat context.'));
    for(const memory of state.memories) {
      const card=node('article','record-card');
      card.append(node('div','card-kicker','SAVED MEMORY'),node('h3','',memory.text));
      const footer=node('footer'),btns=node('div','card-actions');btns.style.display='flex';btns.style.gap='8px';
      btns.append(editButton(()=>{const next=prompt('Edit memory:',memory.text);if(next===null||!next.trim())return;memory.text=next.trim().slice(0,250);save();renderMemories();notice('Memory updated.');}),deleteButton(()=>{if(!confirm('Forget this memory?'))return;state.memories=state.memories.filter(x=>x.id!==memory.id);save();renderMemories();renderCounters();}));
      footer.append(node('time','',dateLabel(memory.created)),btns);card.append(footer);list.append(card);
    }
  }
  function addTask(title) { const text=title.trim().slice(0,220);if(!text)return;state.tasks.unshift({id:newId(),title:text,done:false,created:Date.now()});save();renderTasks();renderCounters();notice('Task added.'); }
  function addMemory(text) {const value=text.trim().slice(0,250);if(!value)return;state.memories.unshift({id:newId(),text:value,created:Date.now()});save();renderMemories();renderCounters();notice('Memory saved.');}
  function interpretLocalCommand(text) {
    const command=text.trim().replace(/^jarvis[,\s:]+/i,'').trim();
    let match;
    if (/^(open|show|go to) (tasks|notes|memory|settings|dashboard|chat|history)$/i.test(command)) {
      const section=command.split(' ').at(-1).toLowerCase();setView(section==='history'?'conversations':section);
      return `Opening ${section}.`;
    }
    if ((match=command.match(/^(create|add) task[: ]+(.+)$/i))) {addTask(match[2]);return `Task saved: ${match[2].trim()}`;}
    if ((match=command.match(/^remember(?: that)?[: ]+(.+)$/i))) {addMemory(match[1]);return `I'll remember: ${match[1].trim()}`;}
    if (/^new chat$/i.test(command)) {createConversation(true);return 'New conversation created.';}
    return null;
  }
  async function handleChat(text) {
    if (busy || !text.trim())return;
    const conv=ensureConversation();state.activeId=conv.id;
    if(conv.title==='New conversation')conv.title=text.trim().slice(0,54);
    conv.messages.push({role:'user',content:text.trim(),created:Date.now()});
    save();renderCounters();setView('chat');
    $('suggestions').style.display='none';
    const commandResult=interpretLocalCommand(text);
    if(commandResult!==null) {
      conv.messages.push({role:'assistant',content:commandResult,created:Date.now()});save();renderMessages();renderSessions();return;
    }
    busy=true;$('typing-status').textContent='JARVIS IS THINKING';$('send-button').disabled=true;
    const assistant={role:'assistant',content:'',created:Date.now()};conv.messages.push(assistant);
    renderMessages();const bubble=$('messages').querySelector('.message:last-child .bubble');bubble.textContent='● ● ●';
    let gotContent=false;
    try {
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:conv.messages.filter(x=>x!==assistant).map(x=>({role:x.role,content:x.content})),memories:state.memories.map(x=>x.text)})});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||`Server error ${response.status}`);}
      if(!response.body)throw new Error('Streaming is unavailable in this browser.');
      const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';
      while(true){
        const {done,value}=await reader.read();pending+=decoder.decode(value||new Uint8Array(),{stream:!done});
        let newline;while((newline=pending.indexOf('\n'))!==-1){
          const line=pending.slice(0,newline).trim();pending=pending.slice(newline+1);
          if(!line)continue;
          let event;try{event=JSON.parse(line);}catch{continue;}
          if(event.type==='delta') {if(!gotContent){assistant.content='';gotContent=true;}assistant.content+=event.content||'';bubble.textContent=assistant.content;$('messages').scrollTop=$('messages').scrollHeight;}
          if(event.type==='error')throw new Error(event.content||'An AI error occurred.');
        }
        if(done)break;
      }
      if(!gotContent){assistant.content='No response was returned by the model.';bubble.textContent=assistant.content;}
      if(state.autoSpeak&&gotContent) speak(assistant.content);
    }catch(error){assistant.error=true;assistant.content=`Connection problem: ${error.message}`;bubble.textContent=assistant.content;bubble.classList.add('error');notice('Could not complete the AI request.',true);}
    finally{busy=false;$('typing-status').textContent='SYSTEM READY';$('send-button').disabled=false;save();renderSessions();}
  }
  function speak(text) {
    if(!('speechSynthesis' in window))return notice('Speech output is unsupported here.',true);
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text.slice(0,2500));utterance.rate=1;utterance.pitch=.95;
    window.speechSynthesis.speak(utterance);
  }
  function microphone() {
    if(!speechAvailable)return notice('Speech recognition is unavailable. Try Chrome or Edge and allow microphone access.',true);
    if(recognizer){recognizer.stop();return;}
    const instance=new SpeechRecognition();recognizer=instance;
    instance.lang=navigator.language||'en-US';instance.interimResults=false;instance.continuous=false;
    for(const id of ['chat-mic','core-mic'])$(id).classList.add('recording');
    instance.onresult=event=>{
      const text=Array.from(event.results).map(x=>x[0]?.transcript||'').join(' ').trim();
      if(!text)return;
      setView('chat');$('chat-input').value=text;
      if(state.autoSend) { $('chat-input').value='';handleChat(text); }
      else { $('chat-input').focus();notice('Dictation ready. Press send when you like.'); }
    };
    instance.onerror=event=>notice(`Microphone error: ${event.error}. Check browser permission.`,true);
    instance.onend=()=>{recognizer=null;for(const id of ['chat-mic','core-mic'])$(id).classList.remove('recording');};
    try{instance.start();notice('Listening...');}catch{recognizer=null;notice('Could not start speech recognition.',true);}
  }
  async function refreshStatus() {
    try {const response=await fetch('/api/status');if(!response.ok)throw new Error('status');aiStatus=await response.json();}
    catch {aiStatus={mode:'demo',model:'Server unavailable'};notice('Could not read server status.',true);}
    const live=aiStatus.mode==='live';
    $('header-status').classList.toggle('demo',!live);
    $('header-mode').textContent=live?'AI LIVE':'DEMO MODE';
    $('core-mode').textContent=live?'● AI CONNECTED':'● DEMO MODE';
    $('metric-model').textContent=aiStatus.model;
    $('metric-ai').textContent=live?'ONLINE':'DEMO';
    $('metric-ai').style.color=live?'#7ed2b1':'#54e1e9';
    $('chat-mode-label').textContent=`Personal AI assistant · ${live?'AI live':'demo mode'}`;
    $('settings-mode').textContent=live?'LIVE':'DEMO';
    $('settings-ai-pill').textContent=live?'CONNECTED':'DEMO';
    $('settings-ai-description').textContent=live?`AI enabled · model: ${aiStatus.model}`:'Offline demo; no model is connected. The other tools work locally.';
    if(view==='chat')renderMessages();
  }
  function bind() {
    document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();setView(button.dataset.view);}));
    $('open-sidebar').addEventListener('click',()=>{$('sidebar').classList.add('open');});
    $('close-sidebar').addEventListener('click',()=>{$('sidebar').classList.remove('open');});
    for(const id of ['dashboard-new-chat','new-chat','chat-side-new','history-new']) $(id).addEventListener('click',()=>createConversation(true));
    $('core-chat').addEventListener('click',()=>{if(!getActive())createConversation(true);else setView('chat');});
    $('clear-chat').addEventListener('click',()=>{const conv=getActive();if(!conv||!conv.messages.length)return;if(!confirm('Clear all messages from this conversation?'))return;conv.messages=[];conv.title='New conversation';save();renderMessages();renderSessions();notice('Conversation cleared.');});
    $('chat-form').addEventListener('submit',e=>{e.preventDefault();const value=$('chat-input').value.trim();if(!value)return;$('chat-input').value='';handleChat(value);});
    $('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chat-form').requestSubmit();}});
    document.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>handleChat(button.dataset.prompt)));
    $('note-form').addEventListener('submit',e=>{e.preventDefault();const title=$('note-title').value.trim(),body=$('note-body').value.trim();if(!title||!body)return;state.notes.unshift({id:newId(),title,body,created:Date.now()});save();renderNotes();renderCounters();$('note-form').reset();notice('Note saved locally.');});
    $('task-form').addEventListener('submit',e=>{e.preventDefault();addTask($('task-input').value);$('task-form').reset();});
    $('memory-form').addEventListener('submit',e=>{e.preventDefault();addMemory($('memory-input').value);$('memory-form').reset();});
    $('chat-mic').addEventListener('click',microphone);$('core-mic').addEventListener('click',microphone);
    $('auto-speak').checked=Boolean(state.autoSpeak);$('auto-send').checked=Boolean(state.autoSend);$('toggle-speech').classList.toggle('on',state.autoSpeak);
    $('auto-speak').addEventListener('change',()=>{state.autoSpeak=$('auto-speak').checked;save();$('toggle-speech').classList.toggle('on',state.autoSpeak);});
    $('auto-send').addEventListener('change',()=>{state.autoSend=$('auto-send').checked;save();});
    $('toggle-speech').addEventListener('click',()=>{state.autoSpeak=!state.autoSpeak;$('auto-speak').checked=state.autoSpeak;$('toggle-speech').classList.toggle('on',state.autoSpeak);save();notice(state.autoSpeak?'Spoken replies enabled.':'Spoken replies disabled.');});
    $('reset-data').addEventListener('click',()=>{if(!confirm('Permanently delete all locally saved conversations, notes, tasks and memory from this browser?'))return;Object.assign(state,defaults());save();renderCounters();renderHistory();renderNotes();renderTasks();renderMemories();renderSessions();renderMessages();$('auto-speak').checked=false;$('auto-send').checked=false;notice('Local JARVIS data deleted.');});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='1'){e.preventDefault();setView('chat');}});
    window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(target&&target!==view)setView(target);});
  }
  function init() {
    bind();greeting();
    $('metric-voice').textContent=speechAvailable?'Speech recognition supported':'Speech input unsupported here';
    renderCounters();renderHistory();renderNotes();renderTasks();renderMemories();renderSessions();
    if(state.conversations.length&&!getActive())state.activeId=state.conversations[0].id;
    renderMessages();
    const initial=location.hash.slice(1);setView(document.getElementById('view-'+initial)?initial:'dashboard');
    refreshStatus();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
