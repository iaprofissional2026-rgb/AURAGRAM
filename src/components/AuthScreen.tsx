import React, { useState } from 'react';
import { 
  Instagram, 
  Mail, 
  Lock, 
  User as UserIcon, 
  AtSign, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { User } from '../types';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState(''); // email or username
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Check username availability in Firestore
  const handleCheckUsername = async (val: string) => {
    const clean = val.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setUsername(clean);
    if (clean.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', clean));
      const snap = await getDocs(q);
      setUsernameAvailable(snap.empty);
    } catch (err) {
      console.warn('Could not check username', err);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Helper to create or fetch Firestore profile
  const syncUserProfile = async (uid: string, initialData: Partial<User>): Promise<User> => {
    const userDocRef = doc(db, 'users', uid);
    const existingSnap = await getDoc(userDocRef);

    if (existingSnap.exists()) {
      const data = existingSnap.data() as User;
      return { ...data, id: uid };
    } else {
      const newUser: User = {
        id: uid,
        email: initialData.email || '',
        username: initialData.username || `user_${uid.slice(0, 6)}`,
        name: initialData.name || 'Novo Usuário',
        avatar: initialData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${initialData.username || uid}`,
        bio: 'Membro do AuraGram ✨',
        website: '',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        isOnline: true,
        following: [],
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(userDocRef, newUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'users');
      }
      return newUser;
    }
  };

  // Register with Email + Password + Username
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Double check username uniqueness in Firestore
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setErrorMessage(`O nome de usuário @${cleanUsername} já está em uso. Escolha outro.`);
        setIsLoading(false);
        return;
      }

      // 2. Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;

      // 3. Update displayName
      await updateProfile(fbUser, {
        displayName: fullName.trim() || cleanUsername,
      });

      // 4. Save to Firestore
      const userProfile = await syncUserProfile(fbUser.uid, {
        email: email.trim().toLowerCase(),
        username: cleanUsername,
        name: fullName.trim() || cleanUsername,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
      });

      onAuthSuccess(userProfile);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('Este e-mail já está cadastrado. Faça login ou recupere a senha.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage('Formato de e-mail inválido.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('A senha é muito fraca. Digite pelo menos 6 dígitos.');
      } else {
        console.warn('Registration issue:', err?.message || err);
        setErrorMessage(err.message || 'Erro ao realizar cadastro.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Login with Email or Username + Password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const input = loginIdentifier.trim();
    if (!input || !password) {
      setErrorMessage('Preencha todos os campos.');
      return;
    }

    setIsLoading(true);

    try {
      let targetEmail = input;

      // If user typed username instead of email, find corresponding email in Firestore
      if (!input.includes('@')) {
        const cleanUser = input.toLowerCase().replace('@', '');
        const q = query(collection(db, 'users'), where('username', '==', cleanUser));
        const snap = await getDocs(q);

        if (snap.empty) {
          setErrorMessage(`Não encontramos nenhuma conta com o nome de usuário @${cleanUser}`);
          setIsLoading(false);
          return;
        }

        const userData = snap.docs[0].data();
        if (!userData.email) {
          setErrorMessage('Conta encontrada sem e-mail vinculado.');
          setIsLoading(false);
          return;
        }
        targetEmail = userData.email;
      }

      // Perform real Firebase Auth sign-in
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      const fbUser = userCredential.user;

      const profile = await syncUserProfile(fbUser.uid, {
        email: fbUser.email || '',
        name: fbUser.displayName || 'Usuário',
        username: input.includes('@') ? (fbUser.email?.split('@')[0] || 'usuario') : input,
      });

      onAuthSuccess(profile);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMessage('Usuário ou senha incorretos. Verifique suas credenciais.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Muitas tentativas sem sucesso. Tente novamente mais tarde ou recupere a senha.');
      } else {
        console.warn('Login issue:', err?.message || err);
        setErrorMessage(err.message || 'Erro ao entrar na conta.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Real Password Reset Email
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const input = loginIdentifier.trim();
    if (!input) {
      setErrorMessage('Informe seu e-mail ou nome de usuário cadastrado.');
      return;
    }

    setIsLoading(true);

    try {
      let targetEmail = input;

      if (!input.includes('@')) {
        const cleanUser = input.toLowerCase().replace('@', '');
        const q = query(collection(db, 'users'), where('username', '==', cleanUser));
        const snap = await getDocs(q);

        if (snap.empty) {
          setErrorMessage(`Nenhuma conta encontrada com o nome de usuário @${cleanUser}.`);
          setIsLoading(false);
          return;
        }

        const userData = snap.docs[0].data();
        targetEmail = userData.email;
      }

      await sendPasswordResetEmail(auth, targetEmail);
      setSuccessMessage(`Enviamos um link oficial de redefinição de senha para: ${targetEmail}. Verifique sua caixa de entrada e spam!`);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setErrorMessage('Nenhum usuário cadastrado com esse e-mail.');
      } else {
        console.warn('Password reset issue:', err?.message || err);
        setErrorMessage(err.message || 'Erro ao enviar e-mail de recuperação.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Google 1-Click Sign-In
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      const userDocRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userDocRef);

      let usernameGen = fbUser.email ? fbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') : `user_${fbUser.uid.slice(0, 5)}`;

      if (!snap.exists()) {
        // Check collision for generated username
        const q = query(collection(db, 'users'), where('username', '==', usernameGen));
        const check = await getDocs(q);
        if (!check.empty) {
          usernameGen = `${usernameGen}_${Math.floor(100 + Math.random() * 900)}`;
        }
      }

      const profile = await syncUserProfile(fbUser.uid, {
        email: fbUser.email || '',
        name: fbUser.displayName || 'Usuário Google',
        username: usernameGen,
        avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${usernameGen}`,
      });

      onAuthSuccess(profile);
    } catch (err: any) {
      // User closed the popup window or canceled the request - normal user action
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // Intentionally cancelled by user; do nothing or clear loading cleanly
        return;
      }

      if (err.code === 'auth/popup-blocked') {
        setErrorMessage('A janela pop-up foi bloqueada pelo navegador. Permita pop-ups ou faça login com e-mail e senha.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage('Domínio não autorizado no Firebase Console. Utilize o login por e-mail e senha.');
      } else {
        console.warn('Google sign in issue:', err?.message || err);
        setErrorMessage(err.message || 'Erro ao autenticar com o Google.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-4 selection:bg-pink-500 selection:text-white relative overflow-hidden">
      {/* Background Aura glow gradients */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Box */}
      <div className="w-full max-w-[390px] space-y-3 z-10">
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 md:p-9 shadow-2xl space-y-6">
          {/* Logo & Brand Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-2xl auragram-gradient flex items-center justify-center shadow-lg shadow-pink-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 bg-clip-text text-transparent font-serif">
                AuraGram
              </h1>
            </div>

            {mode === 'register' && (
              <p className="text-xs text-zinc-400 font-medium leading-relaxed px-2">
                Cadastre-se para ver fotos, vídeos e interagir em tempo real com pessoas de verdade.
              </p>
            )}

            {mode === 'forgot' && (
              <div className="pt-2">
                <div className="w-14 h-14 mx-auto rounded-full border border-zinc-700 flex items-center justify-center mb-2">
                  <Lock className="w-6 h-6 text-zinc-300" />
                </div>
                <h2 className="text-base font-bold text-white">Problemas para entrar?</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Insira seu e-mail ou nome de usuário e enviaremos um link para você redefinir sua senha.
                </p>
              </div>
            )}
          </div>

          {/* Quick Google Sign In button for instant 1-click */}
          {mode !== 'forgot' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{mode === 'register' ? 'Cadastrar com o Google' : 'Entrar com o Google'}</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px] bg-zinc-800" />
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">ou</span>
                <div className="flex-1 h-[1px] bg-zinc-800" />
              </div>
            </div>
          )}

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="flex-1 leading-snug">{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="flex-1 leading-snug">{successMessage}</p>
            </div>
          )}

          {/* FORMS */}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  E-mail ou Nome de usuário
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="ex: usuario ou email@exemplo.com"
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-pink-500 transition-colors"
                  />
                  <UserIcon className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-zinc-400">Senha</label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setMode('forgot');
                    }}
                    className="text-[11px] text-pink-400 hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha segura"
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-pink-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl auragram-gradient text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">E-mail</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-pink-500 transition-colors"
                  />
                  <Mail className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Nome Completo</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ex: Marcelo Silva"
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-pink-500 transition-colors"
                  />
                  <UserIcon className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-zinc-400">Nome de usuário (@)</label>
                  {checkingUsername && <span className="text-[10px] text-zinc-500">verificando...</span>}
                  {usernameAvailable === true && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> disponível
                    </span>
                  )}
                  {usernameAvailable === false && (
                    <span className="text-[10px] text-rose-400 font-semibold">já está em uso</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => handleCheckUsername(e.target.value)}
                    placeholder="ex: marcelo_silva"
                    className={`w-full bg-zinc-900 border text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none transition-colors ${
                      usernameAvailable === false
                        ? 'border-rose-500'
                        : usernameAvailable === true
                        ? 'border-emerald-500'
                        : 'border-zinc-800 focus:border-pink-500'
                    }`}
                  />
                  <AtSign className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Pelo menos 6 caracteres"
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-pink-500 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 leading-relaxed pt-1">
                Ao se cadastrar, você concorda com nossos Termos e Política de Privacidade do AuraGram.
              </p>

              <button
                type="submit"
                disabled={isLoading || usernameAvailable === false}
                className="w-full py-2.5 rounded-xl auragram-gradient text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Criando conta real...</span>
                  </>
                ) : (
                  <span>Cadastrar-se</span>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  E-mail ou Nome de usuário
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="ex: seu e-mail ou @usuario"
                  className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl auragram-gradient text-xs font-bold text-white shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <span>Enviar link de recuperação</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
                className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao login</span>
              </button>
            </form>
          )}
        </div>

        {/* Bottom Switch Box */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-center">
          {mode === 'login' && (
            <p className="text-xs text-zinc-400">
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('register');
                }}
                className="font-bold text-pink-500 hover:text-pink-400 ml-1"
              >
                Cadastre-se
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p className="text-xs text-zinc-400">
              Tem uma conta?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
                className="font-bold text-pink-500 hover:text-pink-400 ml-1"
              >
                Conecte-se
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p className="text-xs text-zinc-400">
              Lembrou a senha?{' '}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
                className="font-bold text-pink-500 hover:text-pink-400 ml-1"
              >
                Fazer login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
