// auth.js
//
// index.html / about.html / restaurants.html이 공유하는 Supabase 이메일/비밀번호
// 로그인 모듈. 로그인 버튼 + 모달 UI를 각 페이지의 <div id="authSlot"></div>에
// 주입하고, 다른 기능(예: 담기)이 로그인 여부를 확인/요구할 수 있도록
// window.icaneatAuth 인터페이스를 노출한다.
//
// 비밀번호 해싱, 세션 토큰 저장 등 보안 관련 로직은 전혀 다루지 않는다 —
// 전부 Supabase(@supabase/supabase-js)에 맡긴다. Publishable key는 브라우저에
// 노출되는 것이 정상인 공개 키(Stripe publishable key와 같은 성격)라 여기 직접
// 넣는다.

(function () {
  'use strict';

  var SUPABASE_URL = 'https://msmwnaksuegjgeutepcc.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eLAsPUCLK9eGm3w8mA5oNA_V38VOKx3';

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  var currentUser = null;
  var listeners = [];

  var ERROR_MESSAGES = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않아요.',
    'User already registered': '이미 가입된 이메일이에요.',
    'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 해요.',
    'Unable to validate email address: invalid format': '이메일 형식이 올바르지 않아요.',
    'Email not confirmed': '이메일 인증이 필요해요.',
    'email rate limit exceeded': '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
  };

  function translateError(message) {
    return ERROR_MESSAGES[message] || '문제가 발생했어요. 잠시 후 다시 시도해주세요.';
  }

  function displayName(user) {
    if (!user || !user.email) return '';
    return user.email.split('@')[0];
  }

  function notify(user) {
    currentUser = user;
    listeners.forEach(function (cb) {
      cb(user);
    });
    renderAuthSlots(user);
  }

  client.auth.getSession().then(function (res) {
    notify(res.data.session ? res.data.session.user : null);
  });

  client.auth.onAuthStateChange(function (_event, session) {
    notify(session ? session.user : null);
  });

  // ---------- 로그인 버튼 / 사용자 상태 (각 페이지의 #authSlot에 주입) ----------

  function renderAuthSlots(user) {
    var slots = document.querySelectorAll('#authSlot');
    slots.forEach(function (slot) {
      slot.innerHTML = '';
      if (user) {
        var status = document.createElement('div');
        status.className = 'auth-user-status';

        var name = document.createElement('span');
        name.className = 'auth-user-name';
        name.textContent = displayName(user) + '님';
        status.appendChild(name);

        var logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'auth-logout-btn';
        logoutBtn.textContent = '로그아웃';
        logoutBtn.addEventListener('click', function () {
          if (window.gtag) window.gtag('event', 'logout_click');
          client.auth.signOut();
        });
        status.appendChild(logoutBtn);

        slot.appendChild(status);
      } else {
        var loginBtn = document.createElement('button');
        loginBtn.type = 'button';
        loginBtn.className = 'auth-login-btn';
        loginBtn.textContent = '로그인';
        loginBtn.addEventListener('click', function () {
          if (window.gtag) window.gtag('event', 'login_click');
          openModal();
        });
        slot.appendChild(loginBtn);
      }
    });
  }

  // ---------- 로그인/회원가입 모달 ----------

  var overlay = document.createElement('div');
  overlay.className = 'auth-modal-overlay';
  overlay.id = 'authModalOverlay';

  var modal = document.createElement('div');
  modal.className = 'auth-modal';

  var header = document.createElement('div');
  header.className = 'auth-modal-header';
  var title = document.createElement('h2');
  title.className = 'auth-modal-title';
  title.textContent = '로그인';
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'auth-modal-close';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.textContent = '×';
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  var errorEl = document.createElement('p');
  errorEl.className = 'auth-error';
  errorEl.hidden = true;
  errorEl.tabIndex = -1;
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'assertive');
  modal.appendChild(errorEl);

  var form = document.createElement('form');
  form.noValidate = true;

  var emailField = document.createElement('div');
  emailField.className = 'auth-field';
  var emailLabel = document.createElement('label');
  emailLabel.textContent = '이메일';
  emailLabel.setAttribute('for', 'authEmailInput');
  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'authEmailInput';
  emailInput.autocomplete = 'email';
  emailInput.required = true;
  emailField.appendChild(emailLabel);
  emailField.appendChild(emailInput);

  var passwordField = document.createElement('div');
  passwordField.className = 'auth-field';
  var passwordLabel = document.createElement('label');
  passwordLabel.textContent = '비밀번호';
  passwordLabel.setAttribute('for', 'authPasswordInput');
  var passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'authPasswordInput';
  passwordInput.autocomplete = 'current-password';
  passwordInput.required = true;
  passwordField.appendChild(passwordLabel);
  passwordField.appendChild(passwordInput);

  form.appendChild(emailField);
  form.appendChild(passwordField);

  var actions = document.createElement('div');
  actions.className = 'auth-actions';
  var loginSubmitBtn = document.createElement('button');
  loginSubmitBtn.type = 'submit';
  loginSubmitBtn.className = 'auth-submit-btn is-primary';
  loginSubmitBtn.textContent = '로그인';
  var signupBtn = document.createElement('button');
  signupBtn.type = 'button';
  signupBtn.className = 'auth-submit-btn is-secondary';
  signupBtn.textContent = '회원가입';
  actions.appendChild(loginSubmitBtn);
  actions.appendChild(signupBtn);
  form.appendChild(actions);

  modal.appendChild(form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    errorEl.focus();
  }

  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function setBusy(isBusy) {
    loginSubmitBtn.disabled = isBusy;
    signupBtn.disabled = isBusy;
    loginSubmitBtn.textContent = isBusy ? '처리 중…' : '로그인';
    signupBtn.textContent = isBusy ? '처리 중…' : '회원가입';
  }

  function openModal() {
    hideError();
    emailInput.value = '';
    passwordInput.value = '';
    overlay.classList.add('open');
    emailInput.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();
    var email = emailInput.value.trim();
    var password = passwordInput.value;
    if (!email || !password) return;

    setBusy(true);
    client.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (res) {
        setBusy(false);
        if (res.error) {
          console.error('[auth] signIn 실패:', res.error.message);
          showError(translateError(res.error.message));
          return;
        }
        if (window.gtag) window.gtag('event', 'login', { method: 'email' });
        closeModal();
      });
  });

  signupBtn.addEventListener('click', function () {
    if (window.gtag) window.gtag('event', 'signup_click');
    hideError();
    var email = emailInput.value.trim();
    var password = passwordInput.value;
    if (!email || !password) return;

    setBusy(true);
    client.auth.signUp({ email: email, password: password }).then(function (res) {
      setBusy(false);
      if (res.error) {
        console.error('[auth] signUp 실패:', res.error.message);
        showError(translateError(res.error.message));
        return;
      }
      if (res.data.session) {
        if (window.gtag) window.gtag('event', 'sign_up', { method: 'email' });
        closeModal();
      } else {
        showError('이메일 인증이 필요해요. 관리자에게 문의해주세요.');
      }
    });
  });

  // ---------- 다른 기능이 가져다 쓰는 공개 인터페이스 ----------

  window.icaneatAuth = {
    getUser: function () {
      return currentUser;
    },
    getClient: function () {
      return client;
    },
    onChange: function (cb) {
      listeners.push(cb);
      cb(currentUser);
    },
    requireLogin: function () {
      if (currentUser) return true;
      openModal();
      return false;
    },
    signOut: function () {
      return client.auth.signOut();
    },
  };

  renderAuthSlots(null);
})();
