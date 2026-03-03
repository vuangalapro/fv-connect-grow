import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Eye, EyeOff, User, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

const AffiliateLogin = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { user, login, register, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Clear fields when switching between Login and Register
  useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [isLogin]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      console.log('User detected in Login, redirecting to:', user.is_admin ? '/admin' : '/dashboard');
      if (user.is_admin) navigate('/admin');
      else navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await login(email.trim(), password.trim());
        if (result.success) {
          toast.success('Bem-vindo de volta!');
        } else {
          toast.error(result.error || 'Email ou senha incorretos');
        }
      } else {
        if (!fullName.trim()) {
          toast.error('Por favor, insira o seu nome completo');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error('As senhas não coincidem');
          setIsLoading(false);
          return;
        }

        const result = await register(email.trim(), password.trim(), fullName.trim());
        if (result.success) {
          toast.success('Conta criada com sucesso!');
        } else {
          toast.error(result.error || 'Erro ao criar conta');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground animate-pulse">A verificar sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-background">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-all mb-8 group"
        >
          <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
            <ArrowLeft size={18} />
          </div>
          <span className="font-medium">Voltar para a página inicial</span>
        </Link>

        <div className="glass rounded-3xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3 font-display tracking-tight">
              <span className="text-gradient-primary">Fv-Comércio</span>
            </h1>
            <p className="text-muted-foreground">Portal do Afiliado Digital</p>
          </div>

          <div className="flex rounded-2xl bg-secondary/50 p-1.5 mb-8 border border-white/5">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${isLogin
                ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${!isLogin
                ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User size={20} />
                </div>
                <Input
                  type="text"
                  placeholder="Nome Completo"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="bg-secondary/30 h-14 pl-12 border-white/5 focus:border-primary/50 transition-all rounded-2xl"
                />
              </div>
            )}

            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Mail size={20} />
              </div>
              <Input
                type="email"
                placeholder="Endereço de Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-secondary/30 h-14 pl-12 border-white/5 focus:border-primary/50 transition-all rounded-2xl"
              />
            </div>

            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Lock size={20} />
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Sua Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-secondary/30 h-14 pl-12 pr-12 border-white/5 focus:border-primary/50 transition-all rounded-2xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {!isLogin && (
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock size={20} />
                </div>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmar Senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="bg-secondary/30 h-14 pl-12 pr-12 border-white/5 focus:border-primary/50 transition-all rounded-2xl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 btn-glow-primary !rounded-2xl text-lg font-bold transition-all duration-300 active:scale-95"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>A processar...</span>
                </div>
              ) : (
                isLogin ? 'Iniciar Sessão' : 'Criar Conta'
              )}
            </Button>
          </form>

          {isLogin && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Esqueceu sua senha? <Link to="/support" className="text-primary hover:underline font-medium">Contacte o suporte</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AffiliateLogin;
