import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const AffiliateLogin = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      const success = login(email, password);
      if (success) {
        if (email === 'admin@vuangala.tv') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        toast.error('Email ou senha incorretos');
      }
    } else {
      if (password !== confirmPassword) {
        toast.error('As senhas não coincidem');
        return;
      }
      if (password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      const success = register(email, password);
      if (success) {
        toast.success('Conta criada com sucesso! Faça login.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      } else {
        toast.error('Este email já está registado');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-background" />
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-accent/8 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft size={18} /> Voltar
        </Link>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2 font-display">
            <span className="text-gradient-primary">Fv-Comércio</span>
          </h1>
          <p className="text-center text-muted-foreground mb-8">Área de Afiliados</p>

          <div className="flex rounded-xl bg-secondary/50 p-1 mb-8">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isLogin ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !isLogin ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-secondary/50 border-border h-12"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-secondary/50 border-border h-12"
            />
            {!isLogin && (
              <Input
                type="password"
                placeholder="Confirmar Senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="bg-secondary/50 border-border h-12"
              />
            )}
            <Button type="submit" className="w-full h-12 btn-glow-primary !rounded-xl text-base">
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AffiliateLogin;
