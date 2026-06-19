'use strict';

// ─── AUTH LOGIC ───
function loadUsers() { const u = localStorage.getItem(USERS_KEY); return u ? JSON.parse(u) : []; }
function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

function initAuth() {
  if (useFirebase) {
    // Timeout defensivo: se o Firebase travar, exibe o login em 5s
    const authTimeout = setTimeout(() => {
      console.warn('Firebase auth timeout — exibindo tela de login.');
      const wrapper = $('auth-wrapper');
      if (wrapper) wrapper.classList.remove('hidden');
    }, 5000);

    firebase.auth().onAuthStateChanged(user => {
      clearTimeout(authTimeout);
      if (user) {
        const uid = user.uid;
        firebase.firestore().collection('users').doc(uid).get()
          .then(doc => {
            if (doc.exists) {
              currentUser = doc.data();
              currentUser.uid = uid;
              if (!currentUser.email) currentUser.email = user.email;
            } else {
              currentUser = { email: user.email, nome: user.email.split('@')[0], uid };
            }
            if (currentUser.email) currentUser.email = currentUser.email.toLowerCase().trim();
          })
          .catch(err => {
            // Erro ao carregar perfil do Firestore — usa dados mínimos do Firebase Auth
            console.warn('[DinDimpass] Perfil Firestore indisponível, usando auth básico:', err.message || err);
            currentUser = { email: user.email, nome: user.email.split('@')[0], uid };
            if (currentUser.email) currentUser.email = currentUser.email.toLowerCase().trim();
          })
          .finally(() => {
            // startApp() é chamado AQUI, fora do .then()/.catch(), para não ser
            // afetado por erros do Firestore nem ter seus próprios erros capturados
            if (currentUser) startApp();
          });
      } else {
        const wrapper = $('auth-wrapper');
        if (wrapper) wrapper.classList.remove('hidden');
      }
    });
  } else {
    const loggedEmail = localStorage.getItem('pland_logged_in') || sessionStorage.getItem('pland_logged_in');
    if (loggedEmail) {
      const users = loadUsers();
      currentUser = users.find(u => u.email === loggedEmail);
      if (currentUser) { startApp(); return; }
    }
    const wrapper = $('auth-wrapper');
    if (wrapper) wrapper.classList.remove('hidden');
  }
}

function switchAuth(view) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  const targetView = $(`view-${view}`);
  if (targetView) targetView.classList.add('active');
}

function handleRegisterSubmit() {
  const nome = $('reg-nome').value.trim();
  const email = $('reg-email').value.trim().toLowerCase();
  const senha = $('reg-senha').value.trim();
  if(!nome || !email || senha.length < 6) { toast('Preencha os dados corretamente (senha mínimo 6 caracteres).'); return; }
  
  if (useFirebase) {
    const btn = $('btn-reg-submit');
    const oldText = btn.textContent;
    btn.disabled = true; btn.textContent = '...';
    
    firebase.auth().createUserWithEmailAndPassword(email, senha)
      .then(userCredential => {
        const uid = userCredential.user.uid;
        currentUser = {
          nome,
          email,
          uid,
          saldoInicial: 0,
          salario: 0,
          profissao: '',
          geminiKey: '',
          sobrenome: '',
          nascimento: '',
          cpf: '',
          telefone: ''
        };
        return firebase.firestore().collection('users').doc(uid).set(currentUser);
      })
      .then(() => {
        toast('Conta criada com sucesso!');
        return firebase.auth().signOut();
      })
      .then(() => {
        switchAuth('login');
      })
      .catch(err => {
        toast('Erro ao registrar: ' + err.message);
      })
      .finally(() => {
        btn.disabled = false; btn.textContent = oldText;
      });
  } else {
    const users = loadUsers();
    if(users.find(u => u.email === email)) { toast('E-mail já cadastrado.'); return; }
    users.push({ nome, email, senha });
    saveUsers(users);
    localStorage.setItem(`pland_data_${email}`, JSON.stringify({ saldoInicial: 0, transacoes: [] }));
    toast('Conta DinDimpass criada! Bora fazer sua grana trabalhar! 🚀'); 
    switchAuth('login');
  }
}

function handleLoginSubmit() {
  const email = $('login-email').value.trim().toLowerCase();
  const senha = $('login-senha').value.trim();
  const remember = $('login-remember').checked;
  
  if (useFirebase) {
    const btn = $('btn-login-submit');
    const oldText = btn.textContent;
    btn.disabled = true; btn.textContent = '...';
    
    const persistence = remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
    
    firebase.auth().setPersistence(persistence)
      .then(() => {
        return firebase.auth().signInWithEmailAndPassword(email, senha);
      })
      .then(userCredential => {
        const uid = userCredential.user.uid;
        return firebase.firestore().collection('users').doc(uid).get();
      })
      .then(doc => {
        if (doc.exists) {
          currentUser = doc.data();
          currentUser.uid = firebase.auth().currentUser.uid;
          if (!currentUser.email) currentUser.email = email;
        } else {
          currentUser = { email, nome: email.split('@')[0], uid: firebase.auth().currentUser.uid };
        }
        if (currentUser.email) currentUser.email = currentUser.email.toLowerCase().trim();
        toast(`Bem-vindo, ${currentUser.nome || currentUser.email.split('@')[0]}! 🎉`);
      })
      .catch(err => {
        // Só captura erros de autenticação/Firestore, não erros do startApp()
        if (!currentUser) {
          toast('E-mail ou senha incorretos: ' + err.message);
          btn.disabled = false; btn.textContent = oldText;
          return;
        }
        // Se currentUser existe, o erro foi em outra coisa — tenta carregar mesmo assim
        console.warn('[DinDimpass] Erro não-auth no login:', err.message || err);
      })
      .finally(() => {
        btn.disabled = false; btn.textContent = oldText;
        // startApp() chamado aqui para isolar erros do startApp() dos erros de auth
        if (currentUser) startApp();
      });
  } else {
    const users = loadUsers();
    const u = users.find(x => x.email === email && x.senha === senha);
    if (u) {
      currentUser = u;
      if (remember) {
        localStorage.setItem('pland_logged_in', email);
      } else {
        sessionStorage.setItem('pland_logged_in', email);
      }
      toast(`Bem-vindo, ${u.nome}!`); 
      startApp();
    } else { 
      toast('E-mail ou senha incorretos.'); 
    }
  }
}

function handleRecoverSubmit() {
  const email = $('rec-email').value.trim().toLowerCase();
  if (useFirebase) {
    firebase.auth().sendPasswordResetEmail(email)
      .then(() => {
        toast('Link de redefinição enviado para o e-mail!');
        setTimeout(()=>switchAuth('login'), 2000);
      })
      .catch(err => {
        toast('Erro: ' + err.message);
      });
  } else {
    const users = loadUsers();
    if(users.find(u => u.email === email)) {
      toast('Um link fictício foi enviado para ' + email);
      setTimeout(()=>switchAuth('login'), 2000);
    } else { 
      toast('E-mail não encontrado.'); 
    }
  }
}

function logout() {
  if (useFirebase) {
    firebase.auth().signOut()
      .then(() => {
        currentUser = null; 
        appData = null;
        $('app-layout').style.display = 'none'; 
        $('auth-wrapper').classList.remove('hidden');
        switchAuth('login');
      })
      .catch(err => {
        toast('Erro ao sair: ' + err.message);
      });
  } else {
    localStorage.removeItem('pland_logged_in');
    sessionStorage.removeItem('pland_logged_in');
    currentUser = null; 
    appData = null;
    $('app-layout').style.display = 'none'; 
    $('auth-wrapper').classList.remove('hidden');
    switchAuth('login');
  }
}
