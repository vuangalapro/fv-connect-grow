import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Home, CheckSquare, User, Wallet, Headphones, ChevronLeft, ChevronRight, ExternalLink, Upload, ArrowLeft, Send, MessageCircle, Menu, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Panel = 'home' | 'tasks' | 'profile' | 'wallet' | 'support' | 'withdrawals';

const slides = [
  { title: 'Marketing Digital', desc: 'Alcance milhões de clientes online', colors: 'from-blue-600 to-cyan-500' },
  { title: 'Redes Sociais', desc: 'Gestão profissional de conteúdo', colors: 'from-purple-600 to-pink-500' },
  { title: 'SEO & SEM', desc: 'Posicione-se no topo dos buscadores', colors: 'from-green-600 to-emerald-500' },
  { title: 'Email Marketing', desc: 'Campanhas personalizadas', colors: 'from-orange-600 to-yellow-500' },
  { title: 'Branding', desc: 'Construa uma marca memorável', colors: 'from-red-600 to-rose-500' },
  { title: 'E-commerce', desc: 'Venda online sem limites', colors: 'from-indigo-600 to-blue-500' },
  { title: 'Publicidade Paga', desc: 'ROI maximizado em campanhas', colors: 'from-teal-600 to-cyan-500' },
  { title: 'Marketing de Conteúdo', desc: 'Conteúdo que converte', colors: 'from-violet-600 to-purple-500' },
  { title: 'Influencers', desc: 'Parcerias estratégicas', colors: 'from-pink-600 to-rose-500' },
  { title: 'Analytics', desc: 'Dados que impulsionam resultados', colors: 'from-sky-600 to-blue-500' },
  { title: 'Automação', desc: 'Processos inteligentes', colors: 'from-amber-600 to-orange-500' },
  { title: 'Estratégia Digital', desc: 'Planejamento completo', colors: 'from-emerald-600 to-teal-500' },
];

const menuItems: { id: Panel; label: string; icon: any }[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'tasks', label: 'Tarefas', icon: CheckSquare },
  { id: 'profile', label: 'Meu Perfil', icon: User },
  { id: 'wallet', label: 'Minha Carteira', icon: Wallet },
  { id: 'withdrawals', label: 'Saques', icon: Banknote },
  { id: 'support', label: 'Suporte Técnico', icon: Headphones },
];

const AffiliateDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>('home');
  const [slide, setSlide] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [profile, setProfile] = useState({ fullName: '', age: '', address: '', gender: '', phone: '', bankAccount: '' });
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; url: string }>>([]);
  const [taskUploads, setTaskUploads] = useState<Record<string, string>>({});
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const [rejectedTasks, setRejectedTasks] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [supportForm, setSupportForm] = useState({ name: '', email: '', subject: '', message: '' });

  useEffect(() => {
    if (!user || user.isAdmin) { navigate('/affiliate-login'); return; }
  }, [user, navigate]);

  useEffect(() => {
    if (panel !== 'home') return;
    const timer = setInterval(() => setSlide(s => (s + 1) % slides.length), 3000);
    return () => clearInterval(timer);
  }, [panel]);

  useEffect(() => {
    if (!user) return;
    const adminTasks = JSON.parse(localStorage.getItem('fv_admin_tasks') || '[]');
    if (adminTasks.length === 0) {
      const defaults = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i + 1}`,
        title: `Tarefa ${i + 1} - Assistir vídeo`,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }));
      localStorage.setItem('fv_admin_tasks', JSON.stringify(defaults));
      setTasks(defaults);
    } else {
      setTasks(adminTasks);
    }
    const p = localStorage.getItem(`fv_profile_${user.id}`);
    if (p) setProfile(JSON.parse(p));
    const subs = JSON.parse(localStorage.getItem('fv_task_submissions') || '[]');
    const userSubs = subs.filter((s: any) => s.userId === user.id);
    setCompletedTasks(userSubs.filter((s: any) => s.status === 'approved').map((s: any) => s.taskId));
    setPendingTasks(userSubs.filter((s: any) => s.status === 'pending').map((s: any) => s.taskId));
    setRejectedTasks(userSubs.filter((s: any) => s.status === 'rejected').map((s: any) => s.taskId));
    setBalance(parseFloat(localStorage.getItem(`fv_balance_${user.id}`) || '0'));
    const allWithdrawals = JSON.parse(localStorage.getItem('fv_withdrawals') || '[]');
    setWithdrawals(allWithdrawals.filter((w: any) => w.userId === user.id));
  }, [user, panel]);

  const saveProfile = () => {
    if (!user) return;
    localStorage.setItem(`fv_profile_${user.id}`, JSON.stringify(profile));
    toast.success('Informações guardadas com sucesso!');
  };

  const handleTaskUpload = (taskId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => setTaskUploads(prev => ({ ...prev, [taskId]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const validateTask = (taskId: string) => {
    if (!taskUploads[taskId]) { toast.error('Envie uma captura primeiro'); return; }
    const userProfile = JSON.parse(localStorage.getItem(`fv_profile_${user!.id}`) || '{}');
    const subs = JSON.parse(localStorage.getItem('fv_task_submissions') || '[]');
    subs.push({
      id: crypto.randomUUID(),
      taskId,
      userId: user!.id,
      userEmail: user!.email,
      userName: userProfile.fullName || user!.email,
      screenshot: taskUploads[taskId],
      status: 'pending',
      date: new Date().toISOString(),
    });
    localStorage.setItem('fv_task_submissions', JSON.stringify(subs));
    setPendingTasks(prev => [...prev, taskId]);
    setTaskUploads(prev => { const n = { ...prev }; delete n[taskId]; return n; });
    toast.success('Tarefa enviada para validação!');
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast.error('Insira um valor válido'); return; }
    if (amount > balance) { toast.error('Saldo insuficiente'); return; }
    if (!profile.bankAccount) { toast.error('Registe sua conta bancária no Meu Perfil'); return; }

    const newBalance = balance - amount;
    localStorage.setItem(`fv_balance_${user!.id}`, String(newBalance));
    setBalance(newBalance);

    const allWithdrawals = JSON.parse(localStorage.getItem('fv_withdrawals') || '[]');
    const withdrawal = {
      id: crypto.randomUUID(),
      userId: user!.id,
      userEmail: user!.email,
      userName: profile.fullName || user!.email,
      amount,
      bankAccount: profile.bankAccount,
      status: 'pending',
      date: new Date().toISOString(),
    };
    allWithdrawals.push(withdrawal);
    localStorage.setItem('fv_withdrawals', JSON.stringify(allWithdrawals));
    setWithdrawals(prev => [...prev, withdrawal]);
    setWithdrawAmount('');
    toast.success(`Pedido de saque de ${amount} Kz enviado!`);
  };

  const handleLogout = () => { logout(); navigate('/affiliate-login'); };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Mensagem enviada com sucesso!');
    setSupportForm({ name: '', email: '', subject: '', message: '' });
  };

  if (!user) return null;

  // Filter out completed (approved) tasks so they don't show
  const availableTasks = tasks.filter(t => !completedTasks.includes(t.id));

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="glass md:w-64 md:min-h-screen p-4 flex md:flex-col gap-2 shrink-0">
        <div className="hidden md:block mb-6">
          <h2 className="text-lg font-bold text-gradient-primary font-display">Fv-Comércio</h2>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>

        <div className="md:hidden flex items-center justify-between w-full">
          <h2 className="text-sm font-bold text-gradient-primary font-display">Fv-Comércio</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileMenu(!mobileMenu)} className="text-muted-foreground p-1">
              <Menu size={20} />
            </button>
            <button onClick={handleLogout} className="text-destructive p-1">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className={`${mobileMenu ? 'flex' : 'hidden'} md:flex flex-col gap-1 w-full`}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setPanel(item.id); setMobileMenu(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                panel === item.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden md:block mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors w-full">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        {/* HOME - Slider */}
        {panel === 'home' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 font-display">Publicidades em Destaque</h2>
            <div className="relative rounded-2xl overflow-hidden" style={{ height: '400px' }}>
              {slides.map((s, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br ${s.colors} transition-opacity duration-700 ${
                    i === slide ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <h3 className="text-4xl md:text-5xl font-bold text-white mb-4 font-display">{s.title}</h3>
                  <p className="text-xl text-white/80">{s.desc}</p>
                </div>
              ))}
              <button onClick={() => setSlide(s => (s - 1 + slides.length) % slides.length)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-colors z-10">
                <ChevronLeft size={24} />
              </button>
              <button onClick={() => setSlide(s => (s + 1) % slides.length)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-colors z-10">
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setSlide(i)} className={`w-2 h-2 rounded-full transition-all ${i === slide ? 'bg-white w-6' : 'bg-white/40'}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TASKS */}
        {panel === 'tasks' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-2 font-display">Completar tarefas hoje</h2>
            <p className="text-muted-foreground mb-6">{completedTasks.length}/{tasks.length} tarefas completas</p>
            <div className="grid gap-3">
              {availableTasks.map(task => {
                const isPending = pendingTasks.includes(task.id);
                const isRejected = rejectedTasks.includes(task.id);

                return (
                  <div key={task.id} className="glass rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <a href={task.url} target="_blank" rel="noopener noreferrer" className="w-24 h-16 rounded-lg bg-red-600/20 flex items-center justify-center shrink-0 hover:bg-red-600/30 transition-colors">
                        <ExternalLink size={16} className="text-red-400" />
                      </a>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <a href={task.url} target="_blank" className="text-xs text-primary hover:underline truncate block">Abrir no YouTube</a>
                        {isPending && <p className="text-xs text-yellow-400 mt-1">⏳ Aguardando validação</p>}
                        {isRejected && <p className="text-xs text-red-400 mt-1">✗ Rejeitada - Tente novamente</p>}
                      </div>
                      {!isPending && (
                        <div className="flex items-center gap-1 shrink-0">
                          <label className="cursor-pointer">
                            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => e.target.files?.[0] && handleTaskUpload(task.id, e.target.files[0])} />
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors ${taskUploads[task.id] ? 'bg-green-500/20 text-green-400' : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'}`}>
                              <Upload size={14} />
                            </div>
                          </label>
                          <button onClick={() => validateTask(task.id)} className="h-8 px-2 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors">
                            Validar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {availableTasks.length === 0 && <p className="text-muted-foreground">Todas as tarefas foram concluídas! 🎉</p>}
            </div>
          </div>
        )}

        {/* PROFILE */}
        {panel === 'profile' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Meu Perfil</h2>
            <div className="glass rounded-2xl p-6 max-w-lg space-y-4">
              {[
                { label: 'Nome Completo', key: 'fullName' as const },
                { label: 'Idade', key: 'age' as const },
                { label: 'Morada', key: 'address' as const },
                { label: 'Género', key: 'gender' as const },
                { label: 'Telefone', key: 'phone' as const },
                { label: 'Conta Bancária (IBAN)', key: 'bankAccount' as const },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-sm text-muted-foreground mb-1 block">{field.label}</label>
                  <Input value={profile[field.key]} onChange={e => setProfile({ ...profile, [field.key]: e.target.value })} className="bg-secondary/50" />
                </div>
              ))}
              <Button onClick={saveProfile} className="w-full btn-glow-primary !rounded-xl">Guardar Informações</Button>
            </div>
          </div>
        )}

        {/* WALLET */}
        {panel === 'wallet' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Minha Carteira</h2>
            <div className="grid gap-4 max-w-lg">
              <div className="glass rounded-2xl p-6">
                <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                <p className="text-4xl font-bold text-gradient-primary mt-1 font-display">{balance.toFixed(2)} Kz</p>
              </div>
              <div className="glass rounded-2xl p-6">
                <p className="text-sm text-muted-foreground">Conta Bancária - IBAN</p>
                <p className="text-lg font-mono text-foreground mt-1">{profile.bankAccount || 'Não registada - Atualize no Meu Perfil'}</p>
              </div>
              <div className="glass rounded-2xl p-6">
                <p className="text-sm text-muted-foreground mb-2">Fundo a Retirar</p>
                <Input type="number" placeholder="Valor em Kz" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="bg-secondary/50 mb-3" />
                <Button onClick={handleWithdraw} className="w-full btn-glow-accent !rounded-xl">
                  Sacar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* WITHDRAWALS */}
        {panel === 'withdrawals' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Meus Saques</h2>
            <div className="space-y-3 max-w-lg">
              {withdrawals.map(w => (
                <div key={w.id} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{w.amount.toFixed(2)} Kz</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.date).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">IBAN: {w.bankAccount}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      w.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {w.status === 'approved' ? '✓ Aprovado' : w.status === 'rejected' ? '✗ Rejeitado' : '⏳ Pendente'}
                    </span>
                  </div>
                </div>
              ))}
              {withdrawals.length === 0 && <p className="text-muted-foreground">Nenhum saque realizado</p>}
            </div>
          </div>
        )}

        {/* SUPPORT */}
        {panel === 'support' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-2 font-display">Suporte Técnico</h2>
            <p className="text-muted-foreground mb-6">Entre em contacto com a equipe do suporte técnico</p>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
              <div className="space-y-4">
                <a href="https://wa.me/244925833661" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 transition-colors">
                  <MessageCircle className="text-green-400" size={24} />
                  <div>
                    <p className="font-semibold text-foreground">WhatsApp</p>
                    <p className="text-sm text-muted-foreground">+244 925 833 661</p>
                  </div>
                </a>
                <a href="https://t.me/Philip0024" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
                  <Send className="text-blue-400" size={24} />
                  <div>
                    <p className="font-semibold text-foreground">Telegram</p>
                    <p className="text-sm text-muted-foreground">@Philip0024</p>
                  </div>
                </a>
              </div>
              <div className="glass rounded-2xl p-6">
                <form onSubmit={handleSupportSubmit} className="space-y-3">
                  <Input placeholder="Nome Completo" value={supportForm.name} onChange={e => setSupportForm({ ...supportForm, name: e.target.value })} className="bg-secondary/50" required />
                  <Input type="email" placeholder="Email" value={supportForm.email} onChange={e => setSupportForm({ ...supportForm, email: e.target.value })} className="bg-secondary/50" required />
                  <Input placeholder="Assunto" value={supportForm.subject} onChange={e => setSupportForm({ ...supportForm, subject: e.target.value })} className="bg-secondary/50" required />
                  <Textarea placeholder="Escreva sua mensagem" value={supportForm.message} onChange={e => setSupportForm({ ...supportForm, message: e.target.value })} className="bg-secondary/50" rows={3} required />
                  <Button type="submit" className="w-full btn-glow-primary !rounded-xl">Enviar</Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AffiliateDashboard;
