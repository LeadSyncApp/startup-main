(function() {
  'use strict';

  // 1. Locate current script & Extract company ID
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var companyId = currentScript.getAttribute('data-company-id');
  if (!companyId) {
    console.warn('[LeadSync Widget] Missing data-company-id attribute on script tag.');
    return;
  }

  // Derive API host from script source
  var scriptUrl = new URL(currentScript.src, window.location.href);
  var apiHost = scriptUrl.origin;

  // Generate or retrieve persistent visitor token
  var visitorToken = localStorage.getItem('leadsync_visitor_token');
  if (!visitorToken) {
    visitorToken = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('leadsync_visitor_token', visitorToken);
  }

  // Retrieve stored phone / name
  var storedName = localStorage.getItem('leadsync_visitor_name') || '';
  var storedPhone = localStorage.getItem('leadsync_visitor_phone') || '';

  // 2. Create Host Container with Shadow DOM to isolate styles
  var hostEl = document.createElement('div');
  hostEl.id = 'leadsync-widget-root';
  document.body.appendChild(hostEl);

  var shadowRoot = hostEl.attachShadow({ mode: 'open' });

  // 3. Inject CSS Styles into Shadow DOM
  var style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    
    .ls-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 30px;
      background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
      color: #D4A843;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1.5px solid rgba(212, 168, 67, 0.3);
    }
    .ls-launcher:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 15px 30px -5px rgba(0,0,0,0.5); }
    .ls-launcher svg { width: 28px; height: 28px; fill: currentColor; }

    .ls-card {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 370px;
      max-width: calc(100vw - 32px);
      height: 540px;
      max-height: calc(100vh - 120px);
      background: #0F172A;
      color: #F8FAFC;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ls-card.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .ls-header {
      background: linear-gradient(135deg, #1A2B42 0%, #0F172A 100%);
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ls-header-title { font-weight: 800; font-size: 15px; color: #FFFFFF; display: flex; align-items: center; gap: 8px; }
    .ls-status-dot { width: 8px; height: 8px; border-radius: 4px; background: #22C55E; box-shadow: 0 0 8px #22C55E; }
    .ls-close-btn { background: transparent; border: none; color: #94A3B8; cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 8px; transition: color 0.2s; }
    .ls-close-btn:hover { color: #FFFFFF; }

    .ls-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    .ls-msg { max-width: 82%; padding: 10px 14px; border-radius: 16px; font-size: 13px; leading-height: 1.4; word-break: break-word; }
    .ls-msg-inbound { align-self: flex-end; background: #D4A843; color: #0F172A; font-weight: 600; border-bottom-right-radius: 4px; }
    .ls-msg-outbound { align-self: flex-start; background: #1E293B; color: #F1F5F9; border-bottom-left-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.05); }

    .ls-form { padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #1E293B; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); }
    .ls-input { width: 100%; background: #0F172A; border: 1px solid rgba(255,255,255,0.15); color: #F8FAFC; padding: 10px 14px; border-radius: 10px; font-size: 13px; outline: none; transition: border 0.2s; }
    .ls-input:focus { border-color: #D4A843; }

    .ls-footer { padding: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; gap: 8px; background: #0F172A; }
    .ls-send-btn { background: #D4A843; color: #0F172A; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: opacity 0.2s; }
    .ls-send-btn:hover { opacity: 0.9; }
    .ls-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .ls-alert { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #FCA5A5; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; text-align: center; }
  `;
  shadowRoot.appendChild(style);

  // 4. Build Widget HTML Shell inside Shadow DOM
  var widgetHTML = document.createElement('div');
  widgetHTML.innerHTML = `
    <div class="ls-launcher" id="ls-launcher" title="Chat with us">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
    </div>

    <div class="ls-card" id="ls-card">
      <div class="ls-header">
        <div class="ls-header-title">
          <span class="ls-status-dot"></span>
          <span>Live Store Chat</span>
        </div>
        <button class="ls-close-btn" id="ls-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="ls-body" id="ls-body">
        <div id="ls-alert-container"></div>
        
        <div class="ls-form" id="ls-intake-form">
          <div style="font-size:12px; font-weight:700; color:#D4A843; margin-bottom:4px;">Start a conversation</div>
          <input type="text" id="ls-name" class="ls-input" placeholder="Your Name" value="${storedName}">
          <input type="tel" id="ls-phone" class="ls-input" placeholder="Phone Number (Required)" value="${storedPhone}">
        </div>

        <div id="ls-messages-list" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>

      <div class="ls-footer">
        <input type="text" id="ls-msg-input" class="ls-input" style="flex:1;" placeholder="Type a message...">
        <button id="ls-send-btn" class="ls-send-btn">Send</button>
      </div>
    </div>
  `;
  shadowRoot.appendChild(widgetHTML);

  // 5. DOM References inside Shadow DOM
  var launcher = shadowRoot.getElementById('ls-launcher');
  var card = shadowRoot.getElementById('ls-card');
  var closeBtn = shadowRoot.getElementById('ls-close');
  var body = shadowRoot.getElementById('ls-body');
  var messagesList = shadowRoot.getElementById('ls-messages-list');
  var intakeForm = shadowRoot.getElementById('ls-intake-form');
  var nameInput = shadowRoot.getElementById('ls-name');
  var phoneInput = shadowRoot.getElementById('ls-phone');
  var msgInput = shadowRoot.getElementById('ls-msg-input');
  var sendBtn = shadowRoot.getElementById('ls-send-btn');
  var alertContainer = shadowRoot.getElementById('ls-alert-container');

  var isOpen = false;

  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      card.classList.add('open');
      fetchMessageHistory();
    } else {
      card.classList.remove('open');
    }
  }

  launcher.addEventListener('click', toggleWidget);
  closeBtn.addEventListener('click', toggleWidget);

  var renderedMsgIds = {};
  var pendingLocalMsgs = [];

  // 6. Fetch Existing Message History
  function fetchMessageHistory() {
    var phone = phoneInput.value.trim() || storedPhone;
    var url = apiHost + '/api/widget/messages?companyId=' + encodeURIComponent(companyId) + '&visitorToken=' + encodeURIComponent(visitorToken);
    if (phone) url += '&phone=' + encodeURIComponent(phone);

    fetch(url)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.conversationId && activeSocket) {
          activeSocket.emit('join_conversation', data.conversationId);
        }
        if (data.messages && data.messages.length > 0) {
          intakeForm.style.display = 'none'; // Hide intake form if history exists
          data.messages.forEach(function(m) {
            if (m.id && renderedMsgIds[m.id]) return;

            var type = m.direction === 'INBOUND' ? 'inbound' : 'outbound';
            var normText = (m.text || '').trim();

            // Match pending local message typed by user to link its DB id
            var pendingIdx = -1;
            for (var i = 0; i < pendingLocalMsgs.length; i++) {
              if (pendingLocalMsgs[i].type === type && pendingLocalMsgs[i].text === normText) {
                pendingIdx = i;
                break;
              }
            }

            if (pendingIdx !== -1) {
              if (m.id) renderedMsgIds[m.id] = true;
              pendingLocalMsgs.splice(pendingIdx, 1);
            } else {
              appendMessage(m.text, type, m.id);
            }
          });
          body.scrollTop = body.scrollHeight;
        }
      })
      .catch(function(err) { console.error('[LeadSync Widget] History fetch error:', err); });
  }

  function appendMessage(text, type, msgId) {
    if (!text || !text.trim()) return;
    var normText = text.trim();

    if (msgId) {
      if (renderedMsgIds[msgId]) return;
      renderedMsgIds[msgId] = true;
    }

    var div = document.createElement('div');
    div.className = 'ls-msg ' + (type === 'inbound' ? 'ls-msg-inbound' : 'ls-msg-outbound');
    div.textContent = normText;
    messagesList.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function showAlert(msg) {
    alertContainer.innerHTML = '<div class="ls-alert">' + msg + '</div>';
    setTimeout(function() { alertContainer.innerHTML = ''; }, 6000);
  }

  // 7. Handle Send Message
  function handleSendMessage() {
    var text = msgInput.value.trim();
    var name = nameInput.value.trim();
    var phone = phoneInput.value.trim();

    if (!text) return;

    if (intakeForm.style.display !== 'none' && !phone) {
      showAlert('Please enter your phone number so we can link your chat.');
      phoneInput.focus();
      return;
    }

    // Save contact info locally
    if (name) localStorage.setItem('leadsync_visitor_name', name);
    if (phone) localStorage.setItem('leadsync_visitor_phone', phone);

    sendBtn.disabled = true;

    fetch(apiHost + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: companyId,
        visitorToken: visitorToken,
        name: name || storedName,
        phone: phone || storedPhone,
        message: text
      })
    })
    .then(function(res) {
      if (res.status === 429) {
        return res.json().then(function(data) {
          showAlert(data.message || 'Sending too fast. Please wait 15s.');
          startCountdown(data.retryAfter || 15);
        });
      }
      return res.json().then(function(data) {
        var localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        pendingLocalMsgs.push({ id: localId, type: 'inbound', text: text.trim() });
        appendMessage(text, 'inbound', localId);
        msgInput.value = '';
        intakeForm.style.display = 'none';
        sendBtn.disabled = false;
        if (data && data.conversationId && activeSocket) {
          activeSocket.emit('join_conversation', data.conversationId);
        }
      });
    })
    .catch(function(err) {
      showAlert('Failed to send message. Please try again.');
      sendBtn.disabled = false;
    });
  }

  function startCountdown(seconds) {
    var remaining = seconds;
    sendBtn.disabled = true;
    var timer = setInterval(function() {
      remaining--;
      sendBtn.textContent = 'Wait (' + remaining + 's)';
      if (remaining <= 0) {
        clearInterval(timer);
        sendBtn.textContent = 'Send';
        sendBtn.disabled = false;
      }
    }, 1000);
  }

  sendBtn.addEventListener('click', handleSendMessage);
  msgInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleSendMessage();
  });

  // 8. Connect to Socket.IO for Real-Time Outbound AI/Agent Replies
  var activeSocket = null;

  function initSocketConnection() {
    if (typeof io !== 'undefined') {
      connectSocket();
    } else {
      var socketScript = document.createElement('script');
      socketScript.src = apiHost + '/socket.io/socket.io.js';
      socketScript.onload = connectSocket;
      document.head.appendChild(socketScript);
    }
  }

  function connectSocket() {
    try {
      if (activeSocket) return;
      activeSocket = io(apiHost, { transports: ['websocket', 'polling'] });
      activeSocket.on('connect', function() {
        var phone = phoneInput.value.trim() || storedPhone;
        activeSocket.emit('join_visitor', { visitorToken: visitorToken, phone: phone, companyId: companyId });
      });
      activeSocket.on('new_message', function(msg) {
        if (!msg) return;
        var text = msg.content || msg.text;
        var sender = msg.sender || msg.direction;
        if (text && sender !== 'CLIENT' && sender !== 'INBOUND') {
          appendMessage(text, 'outbound', msg.id);
        }
      });
    } catch(e) {
      console.warn('[LeadSync Widget] Socket connection fallback to polling.', e);
    }
  }

  // Periodic polling safety fallback when widget is open (every 3 seconds)
  setInterval(function() {
    if (isOpen) {
      fetchMessageHistory();
    }
  }, 3000);

  // Initialize socket connection after page load
  if (document.readyState === 'complete') {
    initSocketConnection();
  } else {
    window.addEventListener('load', initSocketConnection);
  }

})();
