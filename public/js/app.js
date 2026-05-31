/* ==========================================================================
   GHOSTWIRE CLIENT-SIDE APPLICATION ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. PARTICLES BACKDROP CANVAS ENGINE
  const initParticles = () => {
    const container = document.getElementById('particles');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const particles = [];
    const maxParticles = 60;

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.r = Math.random() * 2 + 0.5;
        this.vx = Math.random() * 0.4 - 0.2;
        this.vy = Math.random() * 0.4 - 0.2;
        this.alpha = Math.random() * 0.5 + 0.2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
          this.reset();
        }
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 183, ${this.alpha})`; // Mint cyber particles
        ctx.shadowBlur = this.r * 2;
        ctx.shadowColor = '#00ffb7';
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow for efficiency
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    };

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    animate();
  };
  initParticles();

  // ==========================================================================
  // 2. SYNTHETIC AUDIO ENGINE (Web Audio API - Zero External Resources)
  // ==========================================================================
  
  class AudioSynthesizer {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }
    
    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    }

    playTone(freq, type, duration, gainStart) {
      if (this.muted) return;
      this.init();
      
      // Resume audio context if suspended by browser security policy
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      // Apply clean envelope
      gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    }

    playMsg() {
      // Elegant crystal bell sound
      this.playTone(880, 'triangle', 0.25, 0.15);
    }

    playJoin() {
      // Dynamic welcome chime
      this.playTone(523.25, 'sine', 0.15, 0.12);
      setTimeout(() => this.playTone(659.25, 'sine', 0.25, 0.12), 80);
    }

    playMatch() {
      // Upbeat digital chirps (found partner)
      this.playTone(587.33, 'sine', 0.1, 0.15);
      setTimeout(() => this.playTone(880, 'sine', 0.12, 0.15), 60);
      setTimeout(() => this.playTone(1174.66, 'sine', 0.25, 0.15), 120);
    }

    playLeave() {
      // Calming disconnect sound
      this.playTone(440, 'triangle', 0.15, 0.12);
      setTimeout(() => this.playTone(293.66, 'triangle', 0.3, 0.12), 100);
    }
  }

  const sfx = new AudioSynthesizer();

  // Audio mute button controller
  const muteAudioBtn = document.getElementById('muteAudioBtn');
  const volumeSvg = document.getElementById('volumeSvg');

  muteAudioBtn.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    if (sfx.muted) {
      volumeSvg.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      `;
      muteAudioBtn.setAttribute('title', 'Unmute Sounds');
    } else {
      volumeSvg.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path class="wave" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      `;
      muteAudioBtn.setAttribute('title', 'Mute Sounds');
    }
  });

  // ==========================================================================
  // 3. UI STATE & FORM CONTROLLERS
  // ==========================================================================

  // Onboarding On-screen Age Slider updater
  const ageRange = document.getElementById('ageRange');
  const ageValue = document.getElementById('ageValue');
  ageRange.addEventListener('input', () => {
    ageValue.textContent = ageRange.value;
  });

  // Onboarding Segmented Gender Card picker
  let selectedGender = 'Male';
  const genderCards = document.querySelectorAll('.gender-card');
  genderCards.forEach((card) => {
    
    const selectCard = () => {
      genderCards.forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-checked', 'true');
      selectedGender = card.getAttribute('data-gender');
    };

    card.addEventListener('click', selectCard);
    
    // Accessibility bindings (Enter / Space clicks)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard();
      }
    });
  });

  // ==========================================================================
  // 4. REAL-TIME OPERATIONS & SOCKET LIFECYCLE
  // ==========================================================================

  const socket = io();
  let myProfile = null;
  let activeTab = 'loungeView'; // loungeView or matchView
  let whisperMatchState = 'idle'; // idle, searching, chatting
  let activePartner = null; // metadata of matched peer
  let privateRoomId = null;

  // ==========================================================================
  // LOCATION SUGGESTIONS AUTOCOMPLETE ENGINE
  // ==========================================================================
  const CITIES_DB = [
    'London, UK', 'New York, USA', 'Tokyo, Japan', 'Paris, France', 'Berlin, Germany',
    'Sydney, Australia', 'Mumbai, India', 'Toronto, Canada', 'Singapore', 'Dubai, UAE',
    'Munich, Germany', 'Amsterdam, Netherlands', 'Rome, Italy', 'Los Angeles, USA',
    'San Francisco, USA', 'Seoul, South Korea', 'Neo Tokyo (Virtual)', 'Cyber City (Virtual)',
    'Mars Colony Alpha (Virtual)', 'The Matrix (Virtual)', 'OffGrid Sanctuary', 'Hong Kong',
    'Cape Town, South Africa', 'Rio de Janeiro, Brazil', 'Bangkok, Thailand', 'Cairo, Egypt'
  ];

  const locationInput = document.getElementById('locationInput');
  const locationSuggestions = document.getElementById('locationSuggestions');
  let highlightedIndex = -1;

  const closeSuggestions = () => {
    if (locationSuggestions) {
      locationSuggestions.classList.add('hidden');
      locationSuggestions.innerHTML = '';
    }
    highlightedIndex = -1;
  };

  if (locationInput && locationSuggestions) {
    locationInput.addEventListener('input', () => {
      const query = locationInput.value.trim().toLowerCase();
      if (!query) {
        closeSuggestions();
        return;
      }

      // Filter matched items
      const matches = CITIES_DB.filter(city => city.toLowerCase().includes(query));
      locationSuggestions.innerHTML = '';
      
      if (matches.length > 0) {
        matches.forEach(city => {
          const item = document.createElement('div');
          item.className = 'suggestion-item';
          
          // Highlight matching characters dynamically
          const startIdx = city.toLowerCase().indexOf(query);
          const endIdx = startIdx + query.length;
          const highlighted = city.substring(0, startIdx) + '<strong>' + city.substring(startIdx, endIdx) + '</strong>' + city.substring(endIdx);
          
          item.innerHTML = `
            <span>${highlighted}</span>
            <span class="suggestion-type">Place</span>
          `;
          item.addEventListener('click', () => {
            locationInput.value = city;
            closeSuggestions();
          });
          locationSuggestions.appendChild(item);
        });
      }

      // Add specialized Custom Fallback item
      const customItem = document.createElement('div');
      customItem.className = 'suggestion-item';
      customItem.innerHTML = `
        <span>➕ Use Custom: "<strong>${locationInput.value}</strong>"</span>
        <span class="suggestion-type" style="background: var(--accent-pink); color: #fff;">Custom</span>
      `;
      customItem.addEventListener('click', () => {
        closeSuggestions();
      });
      locationSuggestions.appendChild(customItem);

      locationSuggestions.classList.remove('hidden');
    });

    // Close on clicking outside dropdown bounds
    document.addEventListener('click', (e) => {
      if (!locationInput.contains(e.target) && !locationSuggestions.contains(e.target)) {
        closeSuggestions();
      }
    });

    // Arrow navigation support
    locationInput.addEventListener('keydown', (e) => {
      const items = locationSuggestions.querySelectorAll('.suggestion-item');
      if (locationSuggestions.classList.contains('hidden') || items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % items.length;
        updateHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
        updateHighlight(items);
      } else if (e.key === 'Enter') {
        if (highlightedIndex > -1 && highlightedIndex < items.length) {
          e.preventDefault();
          items[highlightedIndex].click();
        }
      } else if (e.key === 'Escape') {
        closeSuggestions();
      }
    });
  }

  const updateHighlight = (items) => {
    items.forEach((item, idx) => {
      if (idx === highlightedIndex) {
        item.classList.add('highlighted');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('highlighted');
      }
    });
  };

  // Onboarding Submission Event
  const onboardingForm = document.getElementById('onboardingForm');
  const onboardingScreen = document.getElementById('onboardingScreen');
  const appPortal = document.getElementById('appPortal');
  const myAliasSpan = document.getElementById('myAlias');
  const chatInputDock = document.getElementById('chatInputDock');

  onboardingForm.addEventListener('submit', () => {
    const age = parseInt(ageRange.value, 10);
    const location = locationInput.value.trim();
    const customAlias = document.getElementById('aliasInput').value.trim();

    if (!age || !selectedGender || !location) {
      alert('Please fill out all information completely.');
      return;
    }

    const enterPortalBtn = document.getElementById('enterPortalBtn');
    enterPortalBtn.disabled = true;
    enterPortalBtn.querySelector('span').textContent = 'Connecting...';

    // Socket login register payload with optional custom Display Name
    socket.emit('join-portal', { age, gender: selectedGender, location, customAlias }, (response) => {
      if (response.success) {
        myProfile = response.profile;
        
        // Populate view profile
        myAliasSpan.textContent = myProfile.alias;
        myAliasSpan.setAttribute('title', `${myProfile.age} • ${myProfile.gender} • ${myProfile.location}`);

        // Transition layouts
        onboardingScreen.classList.add('hidden');
        appPortal.classList.remove('hidden');
        chatInputDock.classList.remove('hidden');
        
        // Initial synthetic audio chime
        sfx.playJoin();
      } else {
        alert(response.error || 'Connection refused by server.');
        enterPortalBtn.disabled = false;
        enterPortalBtn.querySelector('span').textContent = 'Enter the Sphere';
      }
    });
  // Change Profile / Reset Details Event Trigger
  const selfProfilePill = document.getElementById('selfProfilePill');
  if (selfProfilePill) {
    selfProfilePill.addEventListener('click', () => {
      if (confirm('Would you like to change your display profile? This will disconnect you from all active chats.')) {
        // Disconnect immediately
        socket.disconnect();

        // Pre-fill fields with current active profile
        if (myProfile) {
          // If the alias contains '#' it was randomly generated, so leave it blank.
          // Otherwise, pre-fill what they typed.
          document.getElementById('aliasInput').value = myProfile.alias.includes('#') ? '' : myProfile.alias;
          ageRange.value = myProfile.age;
          ageValue.textContent = myProfile.age;
          locationInput.value = myProfile.location;
        }

        // Transition back to onboarding overlay
        appPortal.classList.add('hidden');
        chatInputDock.classList.add('hidden');
        onboardingScreen.classList.remove('hidden');

        // Re-enable submission button
        const enterPortalBtn = document.getElementById('enterPortalBtn');
        enterPortalBtn.disabled = false;
        enterPortalBtn.querySelector('span').textContent = 'Enter the Sphere';

        // Reconnect socket so it is fully ready for next submit
        socket.connect();
      }
    });
  }



  // Header Mode Navigation Tabs switcher
  const navTabs = document.querySelectorAll('.nav-tab');
  const chatViews = document.querySelectorAll('.chat-view');

  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');
      
      navTabs.forEach((t) => t.classList.remove('active'));
      chatViews.forEach((v) => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(targetId);
      targetView.classList.remove('hidden');
      targetView.classList.add('active');

      activeTab = targetId;

      // Handle custom inputs placeholder modifications
      const inputField = document.getElementById('chatInputField');
      if (activeTab === 'loungeView') {
        inputField.placeholder = 'Broadcast to global lounge...';
        inputField.focus();
      } else {
        if (whisperMatchState === 'chatting') {
          inputField.placeholder = `Whisper privately to ${activePartner.alias}...`;
          inputField.focus();
        } else {
          inputField.placeholder = 'You must connect with a partner first...';
        }
      }

      // Hide match active indicator on view select
      if (activeTab === 'matchView') {
        document.getElementById('matchActiveDot').classList.add('hidden');
      }

      scrollChatToBottom(activeTab === 'loungeView' ? 'loungeMessages' : 'privateMessages');
    });
  });

  // Mobile drawer sidebar toggle
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  const sidebarDrawer = document.getElementById('sidebarDrawer');

  toggleSidebarBtn.addEventListener('click', () => {
    sidebarDrawer.classList.toggle('open');
  });

  // Close sidebar drawer if clicked outside on tablet/mobile views
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
      if (!sidebarDrawer.contains(e.target) && !toggleSidebarBtn.contains(e.target) && sidebarDrawer.classList.contains('open')) {
        sidebarDrawer.classList.remove('open');
      }
    }
  });

  // ==========================================================================
  // 5. CHAT TEXT INPUTS & COPY-PASTE SANITIZER
  // ==========================================================================

  const chatInputForm = document.getElementById('chatInputForm');
  const chatInputField = document.getElementById('chatInputField');

  // Intercept Copy-Paste to block rich text media files
  chatInputField.addEventListener('paste', (e) => {
    e.preventDefault();
    const cleanText = (e.clipboardData || window.clipboardData)
      .getData('text/plain')
      .slice(0, 1000); // Strict length limit
    
    // Inject cleaned plain text into input field
    const start = chatInputField.selectionStart;
    const end = chatInputField.selectionEnd;
    const currentVal = chatInputField.value;
    chatInputField.value = currentVal.substring(0, start) + cleanText + currentVal.substring(end);
    chatInputField.selectionStart = chatInputField.selectionEnd = start + cleanText.length;
  });

  // ==========================================================================
  // 6. DEBOUNCED TYPING SENTINEL Broadcast
  // ==========================================================================

  let typingTimeout = null;
  let isCurrentlyTyping = false;

  chatInputField.addEventListener('input', () => {
    if (whisperMatchState !== 'chatting' && activeTab === 'matchView') return;

    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true;
      socket.emit('typing-state', {
        mode: activeTab === 'loungeView' ? 'global' : 'private',
        isTyping: true
      });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isCurrentlyTyping = false;
      socket.emit('typing-state', {
        mode: activeTab === 'loungeView' ? 'global' : 'private',
        isTyping: false
      });
    }, 2000); // 2 second debounce decay threshold
  });

  // Send message event handler
  chatInputForm.addEventListener('submit', () => {
    const text = chatInputField.value.trim();
    if (!text) return;

    // Reset typing trigger immediately
    clearTimeout(typingTimeout);
    isCurrentlyTyping = false;
    socket.emit('typing-state', {
      mode: activeTab === 'loungeView' ? 'global' : 'private',
      isTyping: false
    });

    if (activeTab === 'loungeView') {
      socket.emit('send-global-msg', { text });
    } else {
      if (whisperMatchState === 'chatting') {
        socket.emit('send-private-msg', { text });
      }
    }

    chatInputField.value = '';
    chatInputField.focus();
  });

  // ==========================================================================
  // 7. EMOJI DRAWER PANEL BINDINGS
  // ==========================================================================

  const emojiPanelBtn = document.getElementById('emojiPanelBtn');
  const emojiSelectorPopup = document.getElementById('emojiSelectorPopup');

  emojiPanelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiSelectorPopup.classList.toggle('hidden');
  });

  // Insert emoji at cursor position
  document.querySelectorAll('.emoji-list span').forEach((emojiSpan) => {
    emojiSpan.addEventListener('click', (e) => {
      const emoji = emojiSpan.textContent;
      const start = chatInputField.selectionStart;
      const end = chatInputField.selectionEnd;
      const currentVal = chatInputField.value;
      
      chatInputField.value = currentVal.substring(0, start) + emoji + currentVal.substring(end);
      chatInputField.focus();
      chatInputField.selectionStart = chatInputField.selectionEnd = start + emoji.length;
      
      emojiSelectorPopup.classList.add('hidden');
    });
  });

  // Auto-hide emoji list popover when clicking anywhere else
  document.addEventListener('click', () => {
    emojiSelectorPopup.classList.add('hidden');
  });

  // ==========================================================================
  // 8. DYNAMIC WHISPER MATCH DECK STATE MACHINE
  // ==========================================================================

  const stateMatchIdle = document.getElementById('stateMatchIdle');
  const stateMatchSearching = document.getElementById('stateMatchSearching');
  const stateMatchChat = document.getElementById('stateMatchChat');
  
  const startMatchmakingBtn = document.getElementById('startMatchmakingBtn');
  const cancelMatchmakingBtn = document.getElementById('cancelMatchmakingBtn');
  const matchHeaderDetails = document.getElementById('matchHeaderDetails');
  const matchToolbarActions = document.getElementById('matchToolbarActions');

  const updateMatchDeckState = (newState) => {
    whisperMatchState = newState;

    // Remove hidden properties conditionally
    stateMatchIdle.classList.add('hidden');
    stateMatchSearching.classList.add('hidden');
    stateMatchChat.classList.add('hidden');

    if (newState === 'idle') {
      stateMatchIdle.classList.remove('hidden');
      matchHeaderDetails.innerHTML = `
        <h2>🤫 Whisper Match</h2>
        <p>Match with a random stranger, chat intimately in text, and skip next.</p>
      `;
      matchToolbarActions.innerHTML = '';
      
      // Update inputs availability
      if (activeTab === 'matchView') {
        chatInputField.placeholder = 'You must connect with a partner first...';
      }
    } 
    else if (newState === 'searching') {
      stateMatchSearching.classList.remove('hidden');
      matchHeaderDetails.innerHTML = `
        <h2>🛰️ Matchmaker Scanner</h2>
        <p>Scanning the network database. Searching for matching profiles...</p>
      `;
      matchToolbarActions.innerHTML = '';
      if (activeTab === 'matchView') {
        chatInputField.placeholder = 'Waiting to connect...';
      }
    } 
    else if (newState === 'chatting') {
      stateMatchChat.classList.remove('hidden');
      
      matchHeaderDetails.innerHTML = `
        <h2>⚡ Connection Active</h2>
        <p>You matched with <span class="bubble-tag" style="padding: 1px 6px;">${activePartner.age} • ${activePartner.gender}</span> from <strong>${activePartner.location}</strong></p>
      `;

      // Header tools (Disconnect and Match Next Action keys)
      matchToolbarActions.innerHTML = `
        <button class="outline-btn danger-btn" id="disconnectMatchBtn" title="Exit chat immediately">Disconnect</button>
        <button class="glow-btn" id="nextMatchBtn" style="padding: 8px 16px; font-size: 0.8rem; box-shadow: none;">Next Partner</button>
      `;

      // Bind dynamic toolbar buttons
      document.getElementById('disconnectMatchBtn').addEventListener('click', leavePrivateChat);
      document.getElementById('nextMatchBtn').addEventListener('click', skipToNextPartner);

      if (activeTab === 'matchView') {
        chatInputField.placeholder = `Whisper privately to ${activePartner.alias}...`;
        chatInputField.focus();
      }
    }
  };

  // Matchmaker control flow functions
  startMatchmakingBtn.addEventListener('click', () => {
    socket.emit('start-match');
  });

  cancelMatchmakingBtn.addEventListener('click', () => {
    socket.emit('cancel-match');
  });

  function leavePrivateChat() {
    socket.emit('leave-match');
    updateMatchDeckState('idle');
    sfx.playLeave();
  }

  function skipToNextPartner() {
    socket.emit('leave-match');
    sfx.playLeave();
    setTimeout(() => {
      socket.emit('start-match');
    }, 400); // Tiny smooth visual window gap
  }

  // ==========================================================================
  // 9. MESSAGES APPENDING & CHAT BOARD SCROLL LAYOUTS
  // ==========================================================================

  const loungeMessages = document.getElementById('loungeMessages');
  const privateMessages = document.getElementById('privateMessages');

  // Format UNIX timestamp into client hours:minutes
  const formatTime = (unixMs) => {
    const d = new Date(unixMs);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  // Append new global lobby messages
  const appendGlobalMsg = (data) => {
    const isSystem = !!data.system;
    
    if (isSystem) {
      loungeMessages.insertAdjacentHTML('beforeend', `
        <div class="msg-card system-announcement">
          <div class="announce-body">
            ${data.text}
          </div>
        </div>
      `);
    } else {
      const isSelf = data.from === myProfile.alias;
      const selfClass = isSelf ? 'msg-self' : 'msg-peer';
      const formatted = formatTime(data.timestamp);

      loungeMessages.insertAdjacentHTML('beforeend', `
        <div class="msg-card ${selfClass}">
          <div class="msg-meta">
            <span class="tag-demographic">${data.age} • ${data.gender} • ${data.location}</span>
            <span>${data.from}</span>
          </div>
          <div class="msg-body">${data.text}</div>
          <span class="msg-timestamp">${formatted}</span>
        </div>
      `);

      if (!isSelf) sfx.playMsg();
    }

    scrollChatToBottom('loungeMessages');
  };

  // Append new private room messages
  const appendPrivateMsg = (data) => {
    const isSelf = data.senderId === socket.id;
    const selfClass = isSelf ? 'msg-self' : 'msg-peer';
    const formatted = formatTime(data.timestamp);
    const senderAlias = isSelf ? myProfile.alias : activePartner.alias;

    privateMessages.insertAdjacentHTML('beforeend', `
      <div class="msg-card ${selfClass}">
        <div class="msg-meta">
          <span>${senderAlias}</span>
        </div>
        <div class="msg-body">${data.text}</div>
        <span class="msg-timestamp">${formatted}</span>
      </div>
    `);

    if (!isSelf) sfx.playMsg();
    scrollChatToBottom('privateMessages');
  };

  // Append system announcement cards in private chats
  const appendPrivateSystemMsg = (text) => {
    privateMessages.insertAdjacentHTML('beforeend', `
      <div class="msg-card system-announcement">
        <div class="announce-body">
          <span class="system-tag">SYSTEM</span> ${text}
        </div>
      </div>
    `);
    scrollChatToBottom('privateMessages');
  };

  // Elegant scroll helper: only lock down if user was already at the bottom
  const scrollChatToBottom = (elementId) => {
    const board = document.getElementById(elementId);
    if (!board) return;
    
    const threshold = 150; // pixels from bottom boundary
    const isNearBottom = board.scrollHeight - board.scrollTop - board.clientHeight < threshold;
    
    if (isNearBottom || board.children.length <= 2) {
      board.scrollTop = board.scrollHeight;
    }
  };

  // ==========================================================================
  // 10. REAL-TIME EVENT STREAM RESPONSES
  // ==========================================================================

  // Network State syncs
  socket.on('presence-update', (data) => {
    document.getElementById('activeCount').textContent = data.onlineCount;
    document.getElementById('sidebarUsersCount').textContent = data.onlineCount;
    
    const usersListScroller = document.getElementById('sidebarUsersList');
    usersListScroller.innerHTML = '';

    if (data.users.length === 0) {
      usersListScroller.innerHTML = `<div class="sidebar-placeholder">Quiet in the sphere...</div>`;
      return;
    }

    data.users.forEach((usr) => {
      const isSelf = usr.alias === (myProfile ? myProfile.alias : '');
      const selfIndicator = isSelf ? ' <span style="color: var(--accent-pink); font-size: 0.7rem;">(You)</span>' : '';
      const stateClass = usr.isMatched ? 'busy' : 'online';
      const stateTitle = usr.isMatched ? 'Busy in matching' : 'Available';

      // Draw custom Chat invitation button for eligible peers
      const inviteBtn = (!isSelf && !usr.isMatched) ? `<button class="sidebar-dm-btn" data-alias="${usr.alias}">Chat</button>` : '';

      usersListScroller.insertAdjacentHTML('beforeend', `
        <div class="user-sidebar-card">
          <div class="user-card-top">
            <span class="user-card-alias">${usr.alias}${selfIndicator}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${inviteBtn}
              <span class="user-state-dot ${stateClass}" title="${stateTitle}"></span>
            </div>
          </div>
          <div class="user-card-meta">
            <span>${usr.age} • ${usr.gender}</span>
            <span>•</span>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${usr.location}</span>
          </div>
        </div>
      `);
    });

    // Bind click handlers to sidebar direct invite buttons
    document.querySelectorAll('.sidebar-dm-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetAlias = btn.getAttribute('data-alias');
        if (!targetAlias) return;

        btn.disabled = true;
        btn.textContent = 'Inviting...';

        socket.emit('send-chat-invite', { targetAlias }, (res) => {
          if (res.success) {
            alert(`Sent private chat invitation to ${targetAlias}. Please wait for their response!`);
          } else {
            alert(res.error || 'Failed to send invitation.');
            btn.disabled = false;
            btn.textContent = 'Chat';
          }
        });
      });
    });
  });

  // Direct Private 1-to-1 Chat Invite Overlay Event Listeners
  let currentIncomingInvite = null;
  const inviteModal = document.getElementById('inviteModal');
  const inviteModalBody = document.getElementById('inviteModalBody');
  const acceptInviteBtn = document.getElementById('acceptInviteBtn');
  const declineInviteBtn = document.getElementById('declineInviteBtn');

  socket.on('recv-chat-invite', (data) => {
    currentIncomingInvite = data.from;
    
    // Play alert chime
    sfx.playMatch();
    
    inviteModalBody.innerHTML = `
      <strong>${data.from.alias}</strong> (${data.from.age} • ${data.from.gender}) from <strong>${data.from.location}</strong> wants to connect for a 1-on-1 private chat.
    `;
    inviteModal.classList.remove('hidden');
  });

  acceptInviteBtn.addEventListener('click', () => {
    if (!currentIncomingInvite) return;
    
    socket.emit('accept-chat-invite', { senderId: currentIncomingInvite.id }, (res) => {
      if (res.success) {
        inviteModal.classList.add('hidden');
        currentIncomingInvite = null;
        
        // Transition panel tabs to Whisper Match private chat screen
        document.getElementById('tabMatch').click();
      } else {
        alert(res.error || 'Could not establish connection.');
        inviteModal.classList.add('hidden');
        currentIncomingInvite = null;
      }
    });
  });

  declineInviteBtn.addEventListener('click', () => {
    if (!currentIncomingInvite) return;
    
    socket.emit('decline-chat-invite', { senderId: currentIncomingInvite.id });
    inviteModal.classList.add('hidden');
    currentIncomingInvite = null;
  });

  socket.on('invite-declined', (data) => {
    alert(`${data.by} declined your chat invitation.`);
    
    // Restore all invite buttons
    document.querySelectorAll('.sidebar-dm-btn').forEach((btn) => {
      btn.disabled = false;
      btn.textContent = 'Chat';
    });
  });


  socket.on('recv-global-msg', (data) => {
    appendGlobalMsg(data);
  });

  // Matchmaking State events
  socket.on('match-searching', () => {
    updateMatchDeckState('searching');
  });

  socket.on('match-idle', () => {
    updateMatchDeckState('idle');
  });

  socket.on('match-found', (data) => {
    activePartner = data.peer;
    privateRoomId = data.roomId;
    
    // Clear old match messages board
    privateMessages.innerHTML = '';
    
    updateMatchDeckState('chatting');
    appendPrivateSystemMsg(`Linked with stranger. Speak freely.`);
    
    // Trigger success audio chime
    sfx.playMatch();

    // If current user is on global lobby view, light up the matched indicator tab dot
    if (activeTab === 'loungeView') {
      document.getElementById('matchActiveDot').classList.remove('hidden');
    }
  });

  socket.on('recv-private-msg', (data) => {
    appendPrivateMsg(data);
  });

  socket.on('match-ended', (data) => {
    let alertMsg = 'Match session terminated.';
    if (data.reason === 'partner_left') {
      alertMsg = 'Your partner has disconnected to look for another match.';
    } else if (data.reason === 'partner_disconnected') {
      alertMsg = 'Your partner lost connection or departed.';
    }

    appendPrivateSystemMsg(alertMsg);
    sfx.playLeave();

    // Disable input options and update header info
    activePartner = null;
    privateRoomId = null;
    updateMatchDeckState('idle');
  });

  // Typing Update event responses
  const typingIndicatorDock = document.getElementById('typingIndicatorDock');
  
  socket.on('typing-update', (data) => {
    // Render only if typing mode matches user's current viewing panel
    const currentMode = activeTab === 'loungeView' ? 'global' : 'private';
    
    if (data.mode === currentMode && data.isTyping && data.alias !== (myProfile ? myProfile.alias : '')) {
      typingIndicatorDock.innerHTML = `
        <div class="typing-wave">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
        <span><strong>${data.alias}</strong> is typing...</span>
      `;
    } else {
      typingIndicatorDock.innerHTML = '';
    }
  });
  
});
