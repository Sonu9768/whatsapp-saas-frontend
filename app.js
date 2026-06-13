/**
 * ============================================================================
 * SAAS MULTI-TENANT CONSOLE - CLIENT-SIDE CONTROLLER
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- OWNER SAAS CONFIGURATIONS (FILL THESE BEFORE DEPLOYING GLOBAL SAAS) ---
  const SUPABASE_URL = "https://fcifcoruvmlanqcdkcse.supabase.co"; // Your Supabase Project URL
  const SUPABASE_ANON_KEY = "sb_publishable_zhXgkPlQPCinPeUu-DylOg_4CT3_amz"; // Your Supabase Anon Key
  const BACKEND_BASE_URL = "https://whatsapp-saas-webhook-g7bi.onrender.com"; // Your Render backend URL

  // --- STATE SYSTEM ---
  let supabaseClient = null;
  let currentUser = null;
  let activeFlowSteps = []; // local array of { step_number, trigger_keyword, response_template }
  let currentSimStep = 1;
  let simSessionHistory = []; // simulator conversation logs
  let isSoundEnabled = true;
  
  // Live CRM State
  let simulatorMode = 'sandbox'; // 'sandbox' or 'live'
  let activeLeadPhone = null;
  let activeLeadName = null;
  let livePollingInterval = null;

  // --- HTML SELECTORS ---
  // Auth Portal
  const authPortal = document.getElementById('auth-portal');
  const formOtpRequest = document.getElementById('form-otp-request');
  const otpEmailInput = document.getElementById('otp-email');
  const btnRequestOtp = document.getElementById('btn-request-otp');
  const formOtpVerify = document.getElementById('form-otp-verify');
  const otpCodeInput = document.getElementById('otp-code');
  const btnConfirmOtp = document.getElementById('btn-confirm-otp');
  const btnBackToOtpRequest = document.getElementById('btn-back-to-otp-request');
  let otpTargetEmail = "";

  // Workspace Main
  const appWorkspace = document.getElementById('app-workspace');
  const userEmailLabel = document.getElementById('user-email-label');
  const stepsCountLabel = document.getElementById('custom-steps-count');
  const btnLogout = document.getElementById('btn-logout');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Config fields
  const confPhoneId = document.getElementById('conf-phone-id');
  const confAccessToken = document.getElementById('conf-access-token');
  const confVerifyToken = document.getElementById('conf-verify-token');
  const confUseGemini = document.getElementById('conf-use-gemini');
  const geminiFields = document.getElementById('gemini-fields');
  const confGeminiKey = document.getElementById('conf-gemini-key');
  const confSystemPrompt = document.getElementById('conf-system-prompt');
  
  // Metadata Details
  const confMetaLocation = document.getElementById('conf-meta-location');
  const confMetaDate = document.getElementById('conf-meta-date');
  const confMetaTime = document.getElementById('conf-meta-time');
  const confMetaVenue = document.getElementById('conf-meta-venue');

  // Steps Builder Container
  const stepsBuilderContainer = document.getElementById('steps-builder-container');
  const btnAddCustomStep = document.getElementById('btn-add-custom-step');

  // Simulator Components
  const chatMessages = document.getElementById('chat-messages');
  const typingIndicator = document.getElementById('typing-indicator');
  const keyboardSuggestions = document.getElementById('keyboard-suggestions');
  const waTextInput = document.getElementById('wa-text-input');
  const chatInputForm = document.getElementById('chat-input-form');
  const btnRestartSimulator = document.getElementById('btn-restart-simulator');
  const simContactDisplay = document.getElementById('sim-contact-display');

  // Live CRM Mode Selectors
  const btnModeSandbox = document.getElementById('btn-mode-sandbox');
  const btnModeLive = document.getElementById('btn-mode-live');
  const btnRefreshLiveChat = document.getElementById('btn-refresh-live-chat');

  // Right Hub Panels
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const liveWebhookUrlDisplay = document.getElementById('live-webhook-url-display');
  const btnCopyWebhookUrl = document.getElementById('btn-copy-webhook-url');
  const btnCopyServerCode = document.getElementById('btn-copy-server-code');
  const codeServerView = document.getElementById('code-server-view');

  // Admin selectors
  const linkAdminConsole = document.getElementById('link-admin-console');
  const adminPortal = document.getElementById('admin-portal');
  const formAdminLogin = document.getElementById('form-admin-login');
  const adminPasswordInput = document.getElementById('admin-password');
  const btnCloseAdmin = document.getElementById('btn-close-admin');
  const adminPanelContent = document.getElementById('admin-panel-content');
  const btnRefreshAdminUsers = document.getElementById('btn-refresh-admin-users');
  const adminUsersTableBody = document.getElementById('admin-users-table-body');
  const btnExitAdmin = document.getElementById('btn-exit-admin');
  let currentAdminPassword = "";

  // AI Flow Generator selectors
  const inputAdDetails = document.getElementById('ai-ad-details');
  const btnGenerateAiFlow = document.getElementById('btn-generate-ai-flow');

  // Leads selectors
  const btnDownloadLeadsCsv = document.getElementById('btn-download-leads-csv');
  const leadsTableBody = document.getElementById('leads-table-body');

  // Audio files
  const sounds = {
    incoming: document.getElementById('sound-incoming'),
    outgoing: document.getElementById('sound-outgoing'),
    typing: document.getElementById('sound-typing')
  };

  // --- AUDIO LOGIC ---
  function playSound(type) {
    if (!isSoundEnabled) return;
    const sound = sounds[type];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  }

  // --- CUSTOM DIALOG & TOAST NOTIFICATION SYSTEM ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Remove duplicates or old toasts to avoid stack overflow visual clutter
    const oldToasts = container.querySelectorAll('.toast-msg');
    if (oldToasts.length >= 3) {
      oldToasts[0].remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon ${type}">${iconSvg}</div>
      <div class="toast-text">${message}</div>
    `;

    container.appendChild(toast);
    
    // Auto remove from DOM after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'fade-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2700);
  }

  function showConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('custom-confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const btnProceed = document.getElementById('btn-confirm-proceed');
      const btnCancel = document.getElementById('btn-confirm-cancel');

      if (!modal || !titleEl || !msgEl || !btnProceed || !btnCancel) {
        resolve(confirm(message));
        return;
      }

      titleEl.textContent = title;
      msgEl.textContent = message;
      modal.style.display = 'flex';

      function cleanUp() {
        modal.style.display = 'none';
        btnProceed.removeEventListener('click', onProceed);
        btnCancel.removeEventListener('click', onCancel);
      }

      function onProceed() {
        cleanUp();
        resolve(true);
      }

      function onCancel() {
        cleanUp();
        resolve(false);
      }

      btnProceed.addEventListener('click', onProceed);
      btnCancel.addEventListener('click', onCancel);
    });
  }

  // Bind custom alert system globally
  window.alert = (msg) => {
    const isError = /fail|error|denied|please|warning|invalid/i.test(msg);
    showToast(msg, isError ? 'error' : 'success');
  };

  // --- DATABASE INITIALIZATION ---
  function initSupabase() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("your-supabase-project")) {
      try {
        // Initialize client using global Supabase library
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        setupAuthListener();
      } catch (err) {
        console.error("Failed to initialize Supabase:", err);
      }
    } else {
      console.warn("Owner Setup Required: Please open app.js and input your SUPABASE_URL and SUPABASE_ANON_KEY credentials.");
    }
  }

  // --- AUTH LISTENERS & HANDLERS ---
  function setupAuthListener() {
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session) {
        currentUser = session.user;
        showWorkspace();
        loadUserData();
      } else {
        currentUser = null;
        showAuthPortal();
      }
    });
  }

  // OTP Request Submit
  if (formOtpRequest) {
    formOtpRequest.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabaseClient) {
        alert("Please configure your Supabase URL & Anon Key first!");
        return;
      }

      const email = otpEmailInput.value.trim();
      if (!email) return;

      try {
        btnRequestOtp.textContent = 'Sending code...';
        btnRequestOtp.disabled = true;

        const { error } = await supabaseClient.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: true
          }
        });

        if (error) throw error;

        otpTargetEmail = email;
        formOtpRequest.style.display = 'none';
        formOtpVerify.style.display = 'flex';
        alert(`A 6-digit verification code has been sent to: ${email}`);
      } catch (err) {
        console.error("OTP request error:", err);
        alert(`Failed to send code: ${err.message}`);
      } finally {
        btnRequestOtp.textContent = 'Send Verification Code (OTP)';
        btnRequestOtp.disabled = false;
      }
    });
  }

  // OTP Verification Submit
  if (formOtpVerify) {
    formOtpVerify.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabaseClient) {
        alert("Please configure your Supabase URL & Anon Key first!");
        return;
      }

      const code = otpCodeInput.value.trim();
      if (!code || !otpTargetEmail) return;

      try {
        btnConfirmOtp.textContent = 'Verifying...';
        btnConfirmOtp.disabled = true;

        const { error } = await supabaseClient.auth.verifyOtp({
          email: otpTargetEmail,
          token: code,
          type: 'email'
        });

        if (error) throw error;
        
        // Success: onAuthStateChange listener handles the transition
        otpCodeInput.value = '';
      } catch (err) {
        console.error("OTP verification error:", err);
        alert(`Verification failed: ${err.message}`);
      } finally {
        btnConfirmOtp.textContent = 'Verify & Sign In';
        btnConfirmOtp.disabled = false;
      }
    });
  }

  // Back to OTP Request
  if (btnBackToOtpRequest) {
    btnBackToOtpRequest.addEventListener('click', () => {
      formOtpVerify.style.display = 'none';
      formOtpRequest.style.display = 'flex';
      otpCodeInput.value = '';
    });
  }

  // Google OAuth Sign-in handlers
  const btnGoogleLogins = document.querySelectorAll('.btn-google-login');
  btnGoogleLogins.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!supabaseClient) {
        alert("Please configure your Supabase URL & Anon Key first!");
        return;
      }
      try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + window.location.pathname
          }
        });
        if (error) throw error;
      } catch (err) {
        console.error("Google Auth failed:", err);
        alert(`Google Sign-In failed: ${err.message}`);
      }
    });
  });

  // Logout
  btnLogout.addEventListener('click', async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
  });

  function showWorkspace() {
    authPortal.style.display = 'none';
    appWorkspace.style.display = 'flex';
    if (currentUser) {
      userEmailLabel.textContent = `Account: ${currentUser.email}`;
      // Set the dynamic webhook URL based on the userId
      liveWebhookUrlDisplay.value = `${BACKEND_BASE_URL}/webhook/${currentUser.id}`;

      // Admin console access rule: Only allow sonuzaiswal@gmail.com
      const btnAdminConsole = document.getElementById('btn-admin-console');
      if (btnAdminConsole) {
        if (currentUser.email === 'sonuzaiswal@gmail.com') {
          btnAdminConsole.style.display = 'inline-flex';
        } else {
          btnAdminConsole.style.display = 'none';
        }
      }
    }
  }

  function showAuthPortal() {
    authPortal.style.display = 'flex';
    appWorkspace.style.display = 'none';
    
    // Reset forms and hide admin console button
    if (formOtpRequest) formOtpRequest.style.display = 'flex';
    if (formOtpVerify) formOtpVerify.style.display = 'none';
    
    const btnAdminConsole = document.getElementById('btn-admin-console');
    if (btnAdminConsole) btnAdminConsole.style.display = 'none';
    
    const adminPortal = document.getElementById('admin-portal');
    if (adminPortal) adminPortal.style.display = 'none';
  }

  // --- DATABASE DATA LOADER ---
  async function loadUserData() {
    if (!supabaseClient || !currentUser) return;

    try {
      // 1. Load Profile configs
      let { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!profile) {
        // Create initial empty profile
        const { data: newProfile, error: insErr } = await supabaseClient
          .from('profiles')
          .insert({
            id: currentUser.id,
            whatsapp_verify_token: 'verify_token_' + Math.random().toString(36).substring(7)
          })
          .select()
          .single();
        
        if (insErr) throw insErr;
        profile = newProfile;
      }

      // Populate input settings
      confPhoneId.value = profile.whatsapp_phone_number_id || '';
      confAccessToken.value = profile.whatsapp_access_token || '';
      confVerifyToken.value = profile.whatsapp_verify_token || '';
      confUseGemini.checked = profile.use_gemini || false;
      confGeminiKey.value = profile.gemini_api_key || '';
      confSystemPrompt.value = profile.custom_system_prompt || '';

      confMetaLocation.value = profile.meta_location || 'Dubai';
      confMetaDate.value = profile.meta_date || 'June 28';
      confMetaTime.value = profile.meta_time || '1 PM – 7 PM';
      confMetaVenue.value = profile.meta_venue || 'Grand Hyatt Hotel, Dubai';

      toggleGeminiFields(profile.use_gemini);

      // 2. Load custom step Q&As
      let { data: steps, error: stepsErr } = await supabaseClient
        .from('flow_steps')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('step_number', { ascending: true });

      if (stepsErr) throw stepsErr;

      if (!steps || steps.length === 0) {
        // Load default MBBS templates
        activeFlowSteps = [
          {
            step_number: 1,
            trigger_keyword: '*',
            response_template: "Hi 👋 Thank you for registering for the MBBS Abroad Seminar in {location} 🎓\n\n✅ Your seat request has been received\n📍 Location: {location}\n📅 Date: {date}\n⏰ Time: {time}\n\nOne of our counselors will contact you shortly with full details.\n\n⚠️ Limited seats – please keep your phone available.\n\nReply YES to confirm your interest 👍"
          },
          {
            step_number: 2,
            trigger_keyword: 'YES',
            response_template: "Great! 😊\n\nYou’ll get a chance to:\n🎓 Meet Official Chinese University Representative\n📚 Get Direct MBBS Admission Guidance\n💰 Learn about Scholarships\n\nBefore we proceed, may I know:\n👉 Are you planning for MBBS or another course?\n\n(Reply: MBBS / Other)"
          },
          {
            step_number: 3,
            trigger_keyword: 'MBBS, OTHER',
            response_template: "Thanks 👍\n\n👉 When are you planning to study abroad?\n\n1️⃣ 2026\n2️⃣ 2027\n3️⃣ Just exploring\n\nPlease reply with 1, 2, or 3."
          },
          {
            step_number: 4,
            trigger_keyword: '1, 2, 3',
            response_template: "Perfect! 🎯\n\nThis seminar is very important for you because:\n\n✔ Direct interaction with university representative\n✔ Step-by-step admission guidance\n✔ Spot consultation\n\n⚠️ Seats are limited and filling fast\n\n👉 Can I reserve your seat now?"
          },
          {
            step_number: 5,
            trigger_keyword: 'YES, OK, CONFIRM, NOW, RESERVE',
            response_template: "✅ Your seat has been reserved!\n\n📍 Venue: {venue}\n📅 Date: {date}\n⏰ Time: {time}\n\n👉 Please arrive 10 minutes early\n\nIf you have any questions, feel free to ask 😊"
          }
        ];
      } else {
        activeFlowSteps = steps.map(s => ({
          step_number: s.step_number,
          trigger_keyword: s.trigger_keyword,
          response_template: s.response_template
        }));
      }

      renderStepsBuilder();
      initializeSimulator();
    } catch (err) {
      console.error("Error loading user configurations:", err);
    }
  }

  // --- SAVE SETTINGS ACTIONS ---
  btnSaveSettings.addEventListener('click', async () => {
    if (!supabaseClient || !currentUser) return;

    try {
      btnSaveSettings.textContent = 'Saving...';
      btnSaveSettings.style.opacity = '0.7';

      // 1. Save Profile info
      const { error: profileErr } = await supabaseClient
        .from('profiles')
        .upsert({
          id: currentUser.id,
          whatsapp_phone_number_id: confPhoneId.value.trim(),
          whatsapp_access_token: confAccessToken.value.trim(),
          whatsapp_verify_token: currentUser.id, // Auto-populate with Supabase User ID for Meta webhook link
          use_gemini: confUseGemini.checked,
          gemini_api_key: confGeminiKey.value.trim(),
          custom_system_prompt: confSystemPrompt.value.trim(),
          meta_location: confMetaLocation.value.trim(),
          meta_date: confMetaDate.value.trim(),
          meta_time: confMetaTime.value.trim(),
          meta_venue: confMetaVenue.value.trim(),
          updated_at: new Date().toISOString()
        });

      if (profileErr) throw profileErr;

      // 2. Save Custom Steps Flow (Clear all old steps, insert new set)
      const { error: delErr } = await supabaseClient
        .from('flow_steps')
        .delete()
        .eq('user_id', currentUser.id);

      if (delErr) throw delErr;

      // Build steps row items to insert
      const insertRows = activeFlowSteps.map(step => ({
        user_id: currentUser.id,
        step_number: step.step_number,
        trigger_keyword: step.trigger_keyword,
        response_template: step.response_template
      }));

      if (insertRows.length > 0) {
        const { error: insErr } = await supabaseClient
          .from('flow_steps')
          .insert(insertRows);
        if (insErr) throw insErr;
      }

      alert("Settings and Q&A Flow rules saved successfully! Webhook is updated.");
      playSound('incoming');
    } catch (err) {
      console.error("Save error:", err);
      alert(`Failed to save details: ${err.message}`);
    } finally {
      btnSaveSettings.querySelector('span') && (btnSaveSettings.querySelector('span').textContent = 'Save Settings & Flow to Database');
      btnSaveSettings.style.opacity = '';
    }
  });

  // Gemini visibility fields toggle
  confUseGemini.addEventListener('change', () => {
    toggleGeminiFields(confUseGemini.checked);
  });

  function toggleGeminiFields(show) {
    geminiFields.style.display = show ? 'grid' : 'none';
  }

  // --- DYNAMIC STEPS BUILDER INTERACTION ---
  function renderStepsBuilder() {
    stepsBuilderContainer.innerHTML = '';
    stepsCountLabel.textContent = activeFlowSteps.length;

    activeFlowSteps.forEach((step, idx) => {
      const card = document.createElement('div');
      card.className = 'step-builder-card';
      
      card.innerHTML = `
        <div class="step-builder-header">
          <span class="step-builder-title">Step #${step.step_number}</span>
          ${step.step_number > 1 ? `<button class="btn-delete-step" data-index="${idx}">Delete</button>` : ''}
        </div>
        <div class="form-group">
          <label style="font-size: 0.7rem;">Trigger Key (e.g. YES or MBBS, other)</label>
          <input type="text" class="step-trigger-input" data-index="${idx}" value="${step.trigger_keyword}" placeholder="${step.step_number === 1 ? 'Any keyword triggers (*)' : 'Keyword triggers, comma separated'}">
        </div>
        <div class="form-group">
          <label style="font-size: 0.7rem;">Response Message Template</label>
          <textarea class="step-template-input" data-index="${idx}" rows="4">${step.response_template}</textarea>
        </div>
      `;

      // Event listeners for change
      card.querySelector('.step-trigger-input').addEventListener('input', (e) => {
        activeFlowSteps[idx].trigger_keyword = e.target.value;
      });

      card.querySelector('.step-template-input').addEventListener('input', (e) => {
        activeFlowSteps[idx].response_template = e.target.value;
      });

      stepsBuilderContainer.appendChild(card);
    });

    // Add delete listeners
    document.querySelectorAll('.btn-delete-step').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const proceed = await showConfirm(
          "Delete Flow Step",
          "Are you sure you want to delete this step? This cannot be undone."
        );
        if (!proceed) return;

        const idx = parseInt(btn.getAttribute('data-index'));
        activeFlowSteps.splice(idx, 1);
        
        // Re-number steps
        activeFlowSteps.forEach((step, index) => {
          step.step_number = index + 1;
        });

        renderStepsBuilder();
        initializeSimulator();
      });
    });
  }

  btnAddCustomStep.addEventListener('click', () => {
    const nextNum = activeFlowSteps.length + 1;
    activeFlowSteps.push({
      step_number: nextNum,
      trigger_keyword: 'KEYWORD',
      response_template: 'Enter your custom response text here.'
    });
    renderStepsBuilder();
    initializeSimulator();
  });

  // --- WHATSAPP SIMULATOR logic ---
  function addMessageBubble(sender, text, timestamp = null) {
    if (!timestamp) {
      const now = new Date();
      timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${sender}`;

    // Formatting parsing
    const processedText = formatWhatsAppText(injectLocalVariables(text));
    
    let ticksHtml = '';
    if (sender === 'user') {
      ticksHtml = `
        <span class="blue-ticks">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M0.293 11.293a1 1 0 0 1 1.414 0L7 16.586 18.293 5.293a1 1 0 1 1 1.414 1.414l-12 12a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414z"/>
            <path d="M6.293 11.293a1 1 0 0 1 1.414 0L13 16.586 24.293 5.293a1 1 0 1 1 1.414 1.414l-12 12a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414z"/>
          </svg>
        </span>
      `;
    }

    bubble.innerHTML = `
      <div class="msg-content">${processedText}</div>
      <div class="msg-meta">
        <span class="msg-time">${timestamp}</span>
        ${ticksHtml}
      </div>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    playSound(sender === 'bot' ? 'incoming' : 'outgoing');
  }

  function addSystemMessage(text) {
    const notice = document.createElement('div');
    notice.className = 'system-msg';
    notice.textContent = text;
    chatMessages.appendChild(notice);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function toggleBotTyping(show) {
    const botStatusLabel = document.getElementById('wa-bot-status');
    if (show) {
      botStatusLabel.textContent = 'typing...';
      botStatusLabel.style.color = 'var(--wa-brand-light)';
      typingIndicator.style.display = 'block';
      chatMessages.scrollTop = chatMessages.scrollHeight;
      playSound('typing');
    } else {
      botStatusLabel.textContent = 'Online';
      botStatusLabel.style.color = '';
      typingIndicator.style.display = 'none';
    }
  }

  function formatWhatsAppText(text) {
    let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    escaped = escaped.replace(/\n/g, '<br>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
    return escaped;
  }

  function injectLocalVariables(text) {
    let out = text;
    const vars = {
      location: confMetaLocation.value.trim(),
      date: confMetaDate.value.trim(),
      time: confMetaTime.value.trim(),
      venue: confMetaVenue.value.trim()
    };
    Object.keys(vars).forEach(key => {
      const r = new RegExp(`{${key}}`, 'g');
      out = out.replace(r, vars[key]);
    });
    return out;
  }

  function botResponse(stepNumber) {
    toggleBotTyping(true);
    const step = activeFlowSteps.find(s => s.step_number === stepNumber);

    setTimeout(() => {
      toggleBotTyping(false);
      if (step) {
        addMessageBubble('bot', step.response_template);
        currentSimStep = stepNumber;
        renderKeyboardSuggestions();
      }
    }, 1200);
  }

  function renderKeyboardSuggestions() {
    keyboardSuggestions.innerHTML = '';
    const nextStepNum = currentSimStep + 1;
    const nextStep = activeFlowSteps.find(s => s.step_number === nextStepNum);

    if (!nextStep) return;

    // Convert triggers into quick reply pills
    const triggers = nextStep.trigger_keyword
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '*');

    if (triggers.length === 0) return;

    const titleEl = document.createElement('div');
    titleEl.className = 'wa-suggestions-title';
    titleEl.textContent = 'Reply Suggestion:';
    keyboardSuggestions.appendChild(titleEl);

    const grid = document.createElement('div');
    grid.className = 'suggestions-grid';

    triggers.forEach(trigger => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.textContent = trigger;
      btn.addEventListener('click', () => {
        handleUserMessage(trigger);
      });
      grid.appendChild(btn);
    });

    keyboardSuggestions.appendChild(grid);
  }

  async function handleUserMessage(text) {
    if (!text.trim()) return;

    addMessageBubble('user', text);
    waTextInput.value = '';

    const normal = text.trim().toUpperCase();
    const nextStepNum = currentSimStep + 1;
    const nextStep = activeFlowSteps.find(s => s.step_number === nextStepNum);

    let matched = false;

    if (nextStep) {
      const triggers = nextStep.trigger_keyword.split(',').map(t => t.trim().toUpperCase());
      matched = triggers.some(t => t === '*' || normal === t || normal.includes(t));
    }

    if (matched) {
      botResponse(nextStepNum);
    } else if (confUseGemini.checked && confGeminiKey.value.trim()) {
      // Direct client-side Gemini call for sandbox testing!
      toggleBotTyping(true);
      const apiKey = confGeminiKey.value.trim();
      
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Role context: ${confSystemPrompt.value.trim() || 'You are an assistant.'}. User message: ${text}` }] }]
          })
        });
        
        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Thank you. Let me look that up.";
        
        toggleBotTyping(false);
        addMessageBubble('bot', replyText);
      } catch (err) {
        toggleBotTyping(false);
        console.error("Client Gemini API Call failed:", err);
        addMessageBubble('bot', "🤖 [Gemini Sandbox Error] Please verify your API Key or prompt details.");
      }
    } else {
      toggleBotTyping(true);
      setTimeout(() => {
        toggleBotTyping(false);
        addMessageBubble('bot', "Sorry, I didn't catch that. Please follow the triggers or instructions.");
      }, 1000);
    }
  }

  // --- LIVE CRM INBOX / CONVERSATION TRANSCRIPT logic ---
  async function refreshLiveChatMessages() {
    if (!supabaseClient || !currentUser || !activeLeadPhone) return;

    try {
      const { data: session, error } = await supabaseClient
        .from('lead_sessions')
        .select('conversation_history, current_step')
        .eq('user_id', currentUser.id)
        .eq('lead_phone', activeLeadPhone)
        .maybeSingle();

      if (error) throw error;

      // Prevent rendering if the user has navigated away from Live mode in the meantime
      if (simulatorMode !== 'live') return;

      chatMessages.innerHTML = '';

      // Render Active Lead Notice header
      const noticeBar = document.createElement('div');
      noticeBar.className = 'wa-chat-notice-bar';
      noticeBar.textContent = `Viewing Live Chat: ${activeLeadName} (${activeLeadPhone}) • Current Step: #${session ? session.current_step : 0}`;
      chatMessages.appendChild(noticeBar);

      if (!session || !session.conversation_history || session.conversation_history.length === 0) {
        addSystemMessage('🔒 No message history logged for this lead yet.');
        return;
      }

      session.conversation_history.forEach(msg => {
        const isUser = msg.role === 'user';
        const text = msg.parts?.[0]?.text || '';
        const author = msg.author || (isUser ? 'user' : 'bot');

        const bubble = document.createElement('div');
        bubble.className = `msg-bubble ${isUser ? 'user' : 'bot'}`;

        // Determine author header tag
        let authorHtml = '';
        if (!isUser) {
          if (author === 'agent') {
            authorHtml = `<div class="msg-author-tag agent">👤 Agent override</div>`;
          } else {
            authorHtml = `<div class="msg-author-tag bot">🤖 Automated Bot</div>`;
          }
        }

        const processedText = formatWhatsAppText(text);
        let ticksHtml = '';
        if (isUser) {
          ticksHtml = `
            <span class="blue-ticks">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M0.293 11.293a1 1 0 0 1 1.414 0L7 16.586 18.293 5.293a1 1 0 1 1 1.414 1.414l-12 12a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414z"/>
                <path d="M6.293 11.293a1 1 0 0 1 1.414 0L13 16.586 24.293 5.293a1 1 0 1 1 1.414 1.414l-12 12a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414z"/>
              </svg>
            </span>
          `;
        }

        bubble.innerHTML = `
          ${authorHtml}
          <div class="msg-content">${processedText}</div>
          <div class="msg-meta">
            <span class="msg-time">Live</span>
            ${ticksHtml}
          </div>
        `;

        chatMessages.appendChild(bubble);
      });

      chatMessages.scrollTop = chatMessages.scrollHeight;

    } catch (err) {
      console.error("Failed to load active lead live history:", err);
    }
  }

  async function sendLiveAgentMessage(text) {
    if (!text.trim() || !activeLeadPhone) return;

    const messageText = text.trim();
    waTextInput.value = '';

    // Play snapping sound & add bubble locally
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble bot';
    bubble.innerHTML = `
      <div class="msg-author-tag agent">👤 Agent override</div>
      <div class="msg-content">${formatWhatsAppText(messageText)}</div>
      <div class="msg-meta">
        <span class="msg-time">Sending...</span>
      </div>
    `;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    playSound('outgoing');

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        alert("Session expired. Please log in again.");
        return;
      }

      const response = await fetch(`${BACKEND_BASE_URL}/api/send-manual-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          leadPhone: activeLeadPhone,
          text: messageText
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to send manual message");
      }

      await refreshLiveChatMessages();

    } catch (err) {
      console.error("Manual sending error:", err);
      alert(`Send failed: ${err.message}`);
      await refreshLiveChatMessages();
    }
  }

  function switchSimulatorMode(mode) {
    simulatorMode = mode;

    if (livePollingInterval) {
      clearInterval(livePollingInterval);
      livePollingInterval = null;
    }

    if (mode === 'sandbox') {
      btnModeSandbox.classList.add('active');
      btnModeLive.classList.remove('active');
      btnRefreshLiveChat.style.display = 'none';

      simContactDisplay.textContent = confUseGemini.checked ? 'Gemini AI Bot' : 'Flow Testbot';
      document.getElementById('wa-bot-status').textContent = 'Online';
      document.getElementById('wa-bot-status').style.color = '';

      waTextInput.value = '';
      waTextInput.placeholder = 'Test typing custom replies...';

      initializeSimulator();
    } else {
      btnModeSandbox.classList.remove('active');
      btnModeLive.classList.add('active');
      btnRefreshLiveChat.style.display = 'inline-flex';

      if (activeLeadPhone) {
        simContactDisplay.textContent = activeLeadName;
        document.getElementById('wa-bot-status').textContent = 'Live CRM Session';
        document.getElementById('wa-bot-status').style.color = 'var(--wa-brand-light)';
        waTextInput.placeholder = `Send manual message to ${activeLeadPhone}...`;

        refreshLiveChatMessages();
        // Start 5-second automatic polling
        livePollingInterval = setInterval(refreshLiveChatMessages, 5000);
      } else {
        simContactDisplay.textContent = 'No Lead Selected';
        document.getElementById('wa-bot-status').textContent = 'Select a lead to chat';
        document.getElementById('wa-bot-status').style.color = 'var(--text-muted)';
        waTextInput.placeholder = 'Select a lead from Leads Log to type...';

        chatMessages.innerHTML = '';
        addSystemMessage('👈 Select a lead in the Leads Log (Right panel) to open live chat history and send manual messages.');
        keyboardSuggestions.innerHTML = '';
      }
    }
  }

  // --- CONTROLLER EVENT BINDINGS ---
  if (btnModeSandbox) {
    btnModeSandbox.addEventListener('click', () => {
      switchSimulatorMode('sandbox');
    });
  }

  if (btnModeLive) {
    btnModeLive.addEventListener('click', () => {
      switchSimulatorMode('live');
    });
  }

  if (btnRefreshLiveChat) {
    btnRefreshLiveChat.addEventListener('click', () => {
      refreshLiveChatMessages();
    });
  }

  chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = waTextInput.value.trim();
    if (!text) return;

    if (simulatorMode === 'live') {
      sendLiveAgentMessage(text);
    } else {
      handleUserMessage(text);
    }
  });

  function initializeSimulator() {
    chatMessages.innerHTML = '';
    currentSimStep = 1;
    simContactDisplay.textContent = confUseGemini.checked ? 'Gemini AI Bot' : 'Flow Testbot';
    
    addSystemMessage('🔒 Messages are simulated locally from steps builder panels.');
    
    if (activeFlowSteps.length > 0) {
      botResponse(1);
    }
  }

  btnRestartSimulator.addEventListener('click', initializeSimulator);

  // --- TABS VIEW SWITCHER ---
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tabTarget = link.getAttribute('data-tab');
      tabLinks.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`tab-${tabTarget}`).classList.add('active');
    });
  });

  // --- WEBHOOK COPY URLS BUTTONS ---
  btnCopyWebhookUrl.addEventListener('click', () => {
    navigator.clipboard.writeText(liveWebhookUrlDisplay.value).then(() => {
      const oldText = btnCopyWebhookUrl.textContent;
      btnCopyWebhookUrl.textContent = 'Copied!';
      btnCopyWebhookUrl.style.backgroundColor = 'var(--wa-brand-light)';
      btnCopyWebhookUrl.style.color = '#000000';
      setTimeout(() => {
        btnCopyWebhookUrl.textContent = oldText;
        btnCopyWebhookUrl.style.backgroundColor = '';
        btnCopyWebhookUrl.style.color = '';
      }, 1500);
    });
  });

  // Load backend code server view dynamically from filesystem
  async function fetchServerView() {
    if (!codeServerView) return;
    try {
      const response = await fetch('server.js');
      if (response.ok) {
        const text = await response.text();
        codeServerView.innerHTML = escapeHtml(text)
          .replace(/\b(const|let|var|function|return|if|else|await|async|require)\b/g, '<span class="c-keyword">$1</span>')
          .replace(/(['"`])(.*?)\1/g, '<span class="c-string">$1$2$1</span>')
          .replace(/(\/\/.*)/g, '<span class="c-comment">$1</span>');
      }
    } catch (err) {
      console.log("Unable to load code view:", err);
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (btnCopyServerCode) {
    btnCopyServerCode.addEventListener('click', () => {
      fetch('server.js').then(r => r.text()).then(code => {
        navigator.clipboard.writeText(code).then(() => {
          btnCopyServerCode.textContent = 'Copied!';
          setTimeout(() => btnCopyServerCode.textContent = 'Copy Code', 1500);
        });
      });
    });
  }

  // --- SETUP SYSTEM THEME & SOUND toggles ---
  btnThemeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  btnSoundToggle.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    btnSoundToggle.classList.toggle('active', isSoundEnabled);
  });

  // --- MOBILE BOTTOM TAB BAR EVENT LISTENERS ---
  const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
  const panels = {
    'panel-left': document.querySelector('.panel-left'),
    'panel-center': document.querySelector('.panel-center'),
    'panel-right': document.querySelector('.panel-right')
  };

  mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPanel = btn.getAttribute('data-target');
      
      // Update button active state
      mobileTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update panel visibility
      Object.keys(panels).forEach(key => {
        const panel = panels[key];
        if (panel) {
          if (key === targetPanel) {
            panel.classList.add('mobile-active');
          } else {
            panel.classList.remove('mobile-active');
          }
        }
      });
      
      // If switching to center (Sandbox), scroll the chat simulator to bottom
      if (targetPanel === 'panel-center') {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
          setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }, 100);
        }
      }
      
      // If switching to right panel, refresh leads log list
      if (targetPanel === 'panel-right') {
        refreshLeadsList();
      }
    });
  });


  // --- LEADS MANAGEMENT & REFRESH LOGIC ---
  async function refreshLeadsList() {
    if (!supabaseClient || !currentUser) return;
    try {
      const { data: leads, error } = await supabaseClient
        .from('lead_sessions')
        .select('lead_phone, lead_name, current_step, updated_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      leadsTableBody.innerHTML = '';
      if (!leads || leads.length === 0) {
        leadsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">No registered leads yet. Live webhook incoming messages will log contacts here.</td></tr>`;
        return;
      }

      leads.forEach(lead => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        const name = lead.lead_name || 'Anonymous';
        const time = new Date(lead.updated_at).toLocaleString();
        row.innerHTML = `
          <td style="padding: 12px; font-weight: 600; color: var(--wa-brand-light);">${lead.lead_phone}</td>
          <td style="padding: 12px; color: var(--text-main);">${name}</td>
          <td style="padding: 12px;"><span class="badge" style="background-color: var(--sim-input-bg); color: var(--wa-brand-light); border: 1px solid var(--sim-border);">Step #${lead.current_step}</span></td>
          <td style="padding: 12px; color: var(--text-muted); font-size: 0.72rem;">${time}</td>
        `;

        row.addEventListener('click', () => {
          activeLeadPhone = lead.lead_phone;
          activeLeadName = name;

          // Switch simulator to Live Chat mode and sync history
          switchSimulatorMode('live');

          // Switch active mobile panel to Sandbox (center panel) if on mobile viewport
          const centerBtn = document.querySelector('.mobile-tab-btn[data-target="panel-center"]');
          if (centerBtn && window.innerWidth <= 1150) {
            centerBtn.click();
          }
        });

        leadsTableBody.appendChild(row);
      });
    } catch (err) {
      console.error("Failed to load leads list:", err);
    }
  }

  // Refresh leads on click tab leads
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (link.getAttribute('data-tab') === 'leads-list') {
        refreshLeadsList();
      }
    });
  });

  // Export CSV download for Excel
  btnDownloadLeadsCsv.addEventListener('click', async () => {
    if (!supabaseClient || !currentUser) return;
    try {
      const { data: leads, error } = await supabaseClient
        .from('lead_sessions')
        .select('lead_phone, lead_name, current_step, updated_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (!leads || leads.length === 0) {
        alert("No leads found to download.");
        return;
      }

      // Prepend UTF-8 BOM so Excel opens it with proper Unicode characters
      let csvContent = "\uFEFFPhone Number,Profile Name,Current Step,Last Active Time\n";
      leads.forEach(lead => {
        const name = lead.lead_name || 'Anonymous';
        const time = new Date(lead.updated_at).toLocaleString().replace(/,/g, '');
        csvContent += `"${lead.lead_phone}","${name.replace(/"/g, '""')}","Step #${lead.current_step}","${time}"\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `whatsapp_leads_${currentUser.id.substring(0, 6)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV download error:", err);
    }
  });

  // --- AI FLOW AUTOMATIC GENERATOR (SERVER-SIDE ENDPOINT) ---
  btnGenerateAiFlow.addEventListener('click', async () => {
    const adText = inputAdDetails.value.trim();
    if (!adText) {
      alert("Please describe your ad details first!");
      return;
    }

    btnGenerateAiFlow.textContent = 'Generating Flow... 🪄';
    btnGenerateAiFlow.disabled = true;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/generate-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adText })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Gemini API call failed");
      }

      const data = await response.json();
      const parsed = data.flow;

      if (Array.isArray(parsed)) {
        activeFlowSteps = parsed;
        renderStepsBuilder();
        initializeSimulator();
        alert("AI has generated your Q&A flow! Review the steps on the left, then click 'Save Settings' to activate it.");
      } else {
        throw new Error("Invalid format received");
      }

    } catch (err) {
      console.error("AI Flow Generator error:", err);
      alert(`AI Generation failed: ${err.message}`);
    } finally {
      btnGenerateAiFlow.textContent = '✨ Auto-Generate Q&A Steps (AI)';
      btnGenerateAiFlow.disabled = false;
    }
  });

  // --- OWNER ADMIN PANEL LOGIC ---
  const btnAdminConsole = document.getElementById('btn-admin-console');
  if (btnAdminConsole) {
    btnAdminConsole.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentUser || currentUser.email !== 'sonuzaiswal@gmail.com') {
        alert("Access Denied: Only sonuzaiswal@gmail.com is allowed to access the admin panel.");
        return;
      }
      adminPortal.style.display = 'flex';
      currentAdminPassword = "Sonu123@"; // Auto authenticate under-the-hood since owner is logged in
      loadAdminUsers();
    });
  }

  async function loadAdminUsers() {
    if (!currentAdminPassword) return;
    try {
      adminUsersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);">Loading registered users...</td></tr>';
      
      const response = await fetch(`${BACKEND_BASE_URL}/admin/users`, {
        method: 'GET',
        headers: {
          'x-admin-password': currentAdminPassword,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(response.status === 401 ? "Unauthorized: Invalid admin password" : "Failed to load users from backend");
      }

      const data = await response.json();
      const users = data.users || [];

      adminUsersTableBody.innerHTML = '';
      if (users.length === 0) {
        adminUsersTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted);">No users found.</td></tr>';
        return;
      }

      users.forEach(user => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        const date = new Date(user.created_at).toLocaleString();
        
        tr.innerHTML = `
          <td style="padding: 10px 12px; color: var(--text-main); font-weight: 500;">${user.email}</td>
          <td style="padding: 10px 12px; color: var(--text-muted);">${date}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <button class="control-btn btn-danger btn-delete-user" data-id="${user.id}" data-email="${user.email}" style="font-size: 0.72rem; padding: 4px 8px;">
              Delete
            </button>
          </td>
        `;

        tr.querySelector('.btn-delete-user').addEventListener('click', async (e) => {
          const userId = e.target.getAttribute('data-id');
          const userEmail = e.target.getAttribute('data-email');
          const proceed = await showConfirm(
            "Delete User Account",
            `Are you sure you want to permanently delete user "${userEmail}"? This will erase their profile and flow steps. This action is irreversible.`
          );
          if (proceed) {
            try {
              e.target.textContent = 'Deleting...';
              e.target.disabled = true;

              const delRes = await fetch(`${BACKEND_BASE_URL}/admin/user/${userId}`, {
                method: 'DELETE',
                headers: {
                  'x-admin-password': currentAdminPassword,
                  'Content-Type': 'application/json'
                }
              });

              if (!delRes.ok) {
                const errData = await delRes.json();
                throw new Error(errData.error || `Server responded with ${delRes.status}`);
              }

              alert(`Successfully deleted account for: ${userEmail}`);
              loadAdminUsers();
            } catch (delErr) {
              console.error("Delete user failed:", delErr);
              alert(`Failed to delete user: ${delErr.message}`);
              e.target.textContent = 'Delete';
              e.target.disabled = false;
            }
          }
        });

        adminUsersTableBody.appendChild(tr);
      });

    } catch (err) {
      console.error("Fetch admin users failed:", err);
      alert(`Admin action failed: ${err.message}`);
      currentAdminPassword = "";
      adminPortal.style.display = 'none';
    }
  }

  if (btnRefreshAdminUsers) {
    btnRefreshAdminUsers.addEventListener('click', () => {
      loadAdminUsers();
    });
  }

  if (btnExitAdmin) {
    btnExitAdmin.addEventListener('click', () => {
      currentAdminPassword = "";
      adminPortal.style.display = 'none';
    });
  }

  // Initialize
  initSupabase();
  fetchServerView();
  
  if (supabaseClient) {
    // Automatically check auth state
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentUser = session.user;
        showWorkspace();
        loadUserData();
        setTimeout(refreshLeadsList, 1500); // load initial leads table
      } else {
        showAuthPortal();
      }
    });
  } else {
    showAuthPortal();
  }
});
