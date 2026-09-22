/* BMN Connect — embeddable web-chat widget.
   Usage:
     <script>window.BMNChat = { key: 'YOUR_WIDGET_KEY', api: 'https://your-omni-host/omni', title: 'Chat with us' };</script>
     <script src="https://your-web-host/widget.js" defer></script>
*/
(function () {
  var cfg = window.BMNChat || {};
  var API = (cfg.api || '/omni').replace(/\/$/, '');
  var KEY = cfg.key;
  var TITLE = cfg.title || 'Chat with us';
  if (!KEY) { console.warn('[BMNChat] missing window.BMNChat.key'); return; }

  var NAVY = '#132376', GOLD = '#e6a23c';
  var conversationId = null;
  var open = false;

  var style = document.createElement('style');
  style.textContent =
    '.bmnc-btn{position:fixed;bottom:20px;right:20px;width:58px;height:58px;border-radius:50%;background:' + NAVY + ';color:#fff;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(19,35,118,.35);font-size:24px;z-index:2147483000;display:flex;align-items:center;justify-content:center}' +
    '.bmnc-panel{position:fixed;bottom:88px;right:20px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.22);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '.bmnc-panel.open{display:flex}' +
    '.bmnc-head{background:' + NAVY + ';color:#fff;padding:16px;font-weight:700}' +
    '.bmnc-head small{display:block;font-weight:400;opacity:.7;font-size:12px;margin-top:2px}' +
    '.bmnc-body{flex:1;overflow-y:auto;padding:14px;background:#faf8f6;display:flex;flex-direction:column;gap:8px}' +
    '.bmnc-msg{max-width:78%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45}' +
    '.bmnc-in{align-self:flex-start;background:#fff;border:1px solid #eee;color:#3a2f2a}' +
    '.bmnc-out{align-self:flex-end;background:' + NAVY + ';color:#fff}' +
    '.bmnc-ai{align-self:flex-start;background:#fef9f1;border:1px solid ' + GOLD + ';color:#3a2f2a}' +
    '.bmnc-foot{display:flex;gap:8px;padding:10px;border-top:1px solid #eee}' +
    '.bmnc-foot input{flex:1;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}' +
    '.bmnc-foot button{border:none;background:' + NAVY + ';color:#fff;border-radius:10px;padding:0 14px;cursor:pointer;font-weight:600}';
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.className = 'bmnc-btn';
  btn.innerHTML = '💬';

  var panel = document.createElement('div');
  panel.className = 'bmnc-panel';
  panel.innerHTML =
    '<div class="bmnc-head">' + TITLE + '<small>Typically replies in a few minutes</small></div>' +
    '<div class="bmnc-body" id="bmnc-body"></div>' +
    '<div class="bmnc-foot"><input id="bmnc-input" placeholder="Type a message…" autocomplete="off"/><button id="bmnc-send">Send</button></div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);
  var body = panel.querySelector('#bmnc-body');
  var input = panel.querySelector('#bmnc-input');

  function add(cls, text) {
    var d = document.createElement('div');
    d.className = 'bmnc-msg ' + cls;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  btn.onclick = function () {
    open = !open;
    panel.classList.toggle('open', open);
    if (open && !body.children.length) add('bmnc-ai', 'Hi! 👋 How can we help with your enquiry today?');
    if (open) input.focus();
  };

  function send() {
    var text = input.value.trim();
    if (!text) return;
    add('bmnc-out', text);
    input.value = '';
    fetch(API + '/webchat/' + KEY + '/message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: text, name: cfg.name, conversationId: conversationId }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        conversationId = d.conversationId || conversationId;
        if (d.aiReply) add('bmnc-ai', d.aiReply);
      })
      .catch(function () { add('bmnc-in', 'Sorry, something went wrong. Please try again.'); });
  }

  panel.querySelector('#bmnc-send').onclick = send;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
})();
