import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Eye, EyeOff, User, Mail, Lock, X } from 'lucide-react';
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
    setAcceptedTerms(false);
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
        if (!acceptedTerms) {
          toast.error('Por favor, aceite os Termos de Uso e Política de Privacidade');
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
            <p className="text-muted-foreground">Iniciar sessão</p>
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

            {/* Terms and Privacy Checkbox - Only show in register mode */}
            {!isLogin && (
              <div className="mb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                    Concordo com os{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      Termos de Uso e Política de Privacidade
                    </button>
                  </label>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || (!isLogin && !acceptedTerms)}
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

      {/* Terms and Privacy Policy Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-foreground">Termos de Uso e Política de Privacidade</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X size={24} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-6 text-sm text-muted-foreground overflow-y-auto max-h-[calc(90vh-80px)]">
              
              {/* Terms of Use */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">📄 TERMOS DE USO DA PLATAFORMA DE AFILIADOS</h3>
                <p className="text-xs">Última atualização: 03.03.2026</p>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">1. Aceitação dos Termos</h4>
                  <p>Ao acessar ou utilizar esta plataforma de afiliados ("Plataforma"), o usuário ("Afiliado") declara que leu, compreendeu e concorda integralmente com estes Termos de Uso.</p>
                  <p>Caso não concorde, o uso da Plataforma deve ser imediatamente interrompido.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">2. Objeto da Plataforma</h4>
                  <p>A Plataforma tem como objetivo intermediar atividades promocionais realizadas por afiliados, mediante execução de tarefas previamente definidas, sujeitas à validação administrativa.</p>
                  <p>A Plataforma não garante aprovação automática de tarefas, pagamentos ou recompensas.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">3. Cadastro e Responsabilidade do Afiliado</h4>
                  <p>O Afiliado declara que:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>As informações fornecidas no cadastro são verdadeiras e atualizadas;</li>
                    <li>Utiliza apenas uma conta pessoal, salvo autorização expressa;</li>
                    <li>Executa as tarefas de forma legítima, sem uso de automações, bots ou meios fraudulentos;</li>
                    <li>Não compartilha contas, dispositivos ou identidades com a finalidade de obter vantagem indevida.</li>
                  </ul>
                  <p>O Afiliado é integralmente responsável por todas as ações realizadas em sua conta.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">4. Execução e Envio de Tarefas</h4>
                  <p>O envio de tarefas é realizado de forma digital, incluindo o envio de capturas de tela como prova.</p>
                  <p>O envio não implica aprovação automática.</p>
                  <p>O sistema foi projetado para permitir envio rápido e sem bloqueios, sem validações antifraude automáticas.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">5. Validação Administrativa</h4>
                  <p>Todas as tarefas passam por análise administrativa, podendo ser:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Aprovadas</li>
                    <li>Rejeitadas</li>
                    <li>Submetidas à verificação antifraude manual</li>
                  </ul>
                  <p>A decisão administrativa é soberana, respeitando os critérios internos da Plataforma.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">6. Sistema Antifraude (Modelo Sob Demanda)</h4>
                  <p>A Plataforma utiliza um sistema antifraude sob demanda, com as seguintes características:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Não é executado automaticamente</li>
                    <li>Não roda no envio de tarefas</li>
                    <li>Não roda no carregamento de páginas</li>
                    <li>É ativado exclusivamente por solicitação manual do administrador</li>
                  </ul>
                  <p>O objetivo do sistema antifraude é auxiliar na tomada de decisão, e não aplicar punições automáticas.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">7. Penalidades e Encerramento de Conta</h4>
                  <p>A Plataforma poderá aplicar penalidades graduais em casos de violação destes Termos, incluindo:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Advertências</li>
                    <li>Redução de créditos</li>
                    <li>Suspensão temporária</li>
                    <li>Encerramento definitivo da conta</li>
                  </ul>
                  <p>Nenhuma penalidade grave será aplicada sem análise administrativa.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">8. Proibição de Garantias</h4>
                  <p>A Plataforma não garante:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Aprovação de tarefas</li>
                    <li>Resultados financeiros</li>
                    <li>Continuidade de campanhas</li>
                    <li>Disponibilidade ininterrupta do sistema</li>
                  </ul>
                  <p>O uso é fornecido "como está", respeitando os limites técnicos razoáveis.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">9. Alterações dos Termos</h4>
                  <p>A Plataforma pode atualizar estes Termos a qualquer momento. O uso contínuo após alterações implica aceitação automática.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">10. Foro e Legislação Aplicável</h4>
                  <p>Estes Termos são regidos pelas leis aplicáveis à jurisdição da Plataforma.</p>
                  <p>Fica eleito o foro competente para dirimir eventuais conflitos.</p>
                </div>
              </div>

              {/* Privacy Policy */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-lg font-bold text-foreground">🔐 POLÍTICA DE PRIVACIDADE</h3>
                <p className="text-xs">Última atualização: 04.03.2026</p>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">1. Princípios Gerais</h4>
                  <p>A Plataforma respeita a privacidade dos usuários e trata dados pessoais com base nos princípios de:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Finalidade</li>
                    <li>Necessidade</li>
                    <li>Transparência</li>
                    <li>Segurança</li>
                    <li>Não discriminação</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">2. Dados Coletados</h4>
                  <p><strong>2.1 Dados fornecidos pelo usuário:</strong></p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Nome ou identificador</li>
                    <li>Informações de login</li>
                    <li>Dados enviados voluntariamente em tarefas</li>
                  </ul>
                  <p><strong>2.2 Dados coletados automaticamente:</strong></p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Endereço IP</li>
                    <li>User-Agent</li>
                    <li>Fingerprint do dispositivo</li>
                    <li>Data e hora de acessos</li>
                    <li>Metadados técnicos de navegação</li>
                  </ul>
                  <p className="text-xs italic">Esses dados são coletados de forma passiva, sem execução automática de análises antifraude.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">3. Capturas de Tela (Screenshots)</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>As capturas enviadas são armazenadas de forma segura</li>
                    <li>Utilizadas exclusivamente para validação de tarefas</li>
                    <li>Não são compartilhadas com terceiros não autorizados</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">4. Uso do Sistema Antifraude</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Os dados coletados não são analisados automaticamente</li>
                    <li>A análise antifraude ocorre somente quando solicitada manualmente pelo administrador</li>
                    <li>Os resultados são utilizados apenas para apoio à decisão administrativa</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">5. Compartilhamento de Dados</h4>
                  <p>A Plataforma não vende dados pessoais.</p>
                  <p>Os dados podem ser compartilhados apenas quando:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Exigido por lei</li>
                    <li>Necessário para cumprimento contratual</li>
                    <li>Utilizado por provedores técnicos (storage, infraestrutura), sob confidencialidade</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">6. Armazenamento e Segurança</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Os dados são armazenados em ambiente seguro</li>
                    <li>Acesso restrito por níveis de permissão</li>
                    <li>Medidas técnicas e organizacionais são aplicadas para evitar acessos não autorizados</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">7. Retenção de Dados</h4>
                  <p>Os dados são mantidos apenas pelo período necessário para:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Cumprimento das finalidades da Plataforma</li>
                    <li>Obrigações legais</li>
                    <li>Auditoria e segurança</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">8. Direitos do Usuário</h4>
                  <p>O usuário pode solicitar:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Acesso aos seus dados</li>
                    <li>Correção de informações</li>
                    <li>Exclusão de conta (quando legalmente permitido)</li>
                    <li>Esclarecimentos sobre o uso dos dados</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">9. Cookies e Tecnologias Semelhantes</h4>
                  <p>A Plataforma pode utilizar cookies estritamente necessários para funcionamento, segurança e desempenho.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">10. Alterações da Política</h4>
                  <p>Esta Política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas na Plataforma.</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">11. Contato</h4>
                  <p>Para dúvidas relacionadas a privacidade ou dados pessoais, o usuário pode entrar em contato pelos canais oficiais da Plataforma.</p>
                </div>
              </div>

              {/* Strategic Note */}
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                <p className="text-sm text-foreground font-semibold">🧠 Observação estratégica</p>
                <p className="text-xs mt-2">Esses documentos foram escritos para:</p>
                <ul className="list-disc pl-4 text-xs mt-1 space-y-1">
                  <li>✔️ Proteger juridicamente a plataforma</li>
                  <li>✔️ Evitar acusações de banimento injusto</li>
                  <li>✔️ Justificar tecnicamente o antifraude sob demanda</li>
                  <li>✔️ Estar alinhados com a arquitetura real do sistema</li>
                </ul>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowTermsModal(false);
                  }}
                  className="w-full btn-glow-primary"
                >
                  Aceitar e Continuar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateLogin;
