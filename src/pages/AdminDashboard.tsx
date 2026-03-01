import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, CheckSquare, Megaphone, PlusCircle, ArrowLeft, Trash2, Check, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Panel = 'users' | 'tasks' | 'ads' | 'newTasks' | null;

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [taskLinks, setTaskLinks] = useState<string[]>(Array(10).fill(''));

  useEffect(() => {
    if (!user || !user.isAdmin) { navigate('/affiliate-login'); return; }
  }, [user, navigate]);

  useEffect(() => {
    const allUsers = JSON.parse(localStorage.getItem('fv_users') || '[]');
    setUsers(allUsers.filter((u: any) => u.email !== 'admin@vuangala.tv'));
    setSubmissions(JSON.parse(localStorage.getItem('fv_task_submissions') || '[]').filter((s: any) => s.status === 'pending'));
    setAds(JSON.parse(localStorage.getItem('fv_ads') || '[]'));
    const existing = JSON.parse(localStorage.getItem('fv_admin_tasks') || '[]');
    setTaskLinks(Array(10).fill('').map((_, i) => existing[i]?.url || ''));
  }, [panel]);

  const approveTask = (sub: any) => {
    const allSubs = JSON.parse(localStorage.getItem('fv_task_submissions') || '[]');
    const idx = allSubs.findIndex((s: any) => s.id === sub.id);
    if (idx >= 0) {
      allSubs[idx].status = 'approved';
      localStorage.setItem('fv_task_submissions', JSON.stringify(allSubs));
      const bal = parseFloat(localStorage.getItem(`fv_balance_${sub.userId}`) || '0');
      localStorage.setItem(`fv_balance_${sub.userId}`, String(bal + 50));
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      toast.success('Tarefa aprovada! +50 Kz adicionado ao utilizador');
    }
  };

  const rejectTask = (sub: any) => {
    const allSubs = JSON.parse(localStorage.getItem('fv_task_submissions') || '[]');
    const idx = allSubs.findIndex((s: any) => s.id === sub.id);
    if (idx >= 0) {
      allSubs[idx].status = 'rejected';
      localStorage.setItem('fv_task_submissions', JSON.stringify(allSubs));
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      toast.info('Tarefa rejeitada');
    }
  };

  const deleteAd = (id: string) => {
    const all = JSON.parse(localStorage.getItem('fv_ads') || '[]');
    localStorage.setItem('fv_ads', JSON.stringify(all.filter((a: any) => a.id !== id)));
    setAds(prev => prev.filter(a => a.id !== id));
    toast.success('Mensagem apagada');
  };

  const saveTasks = () => {
    const tasks = taskLinks.map((url, i) => ({
      id: `task-${i + 1}`,
      title: `Tarefa ${i + 1} - Assistir vídeo`,
      url: url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    }));
    localStorage.setItem('fv_admin_tasks', JSON.stringify(tasks));
    toast.success('Tarefas atualizadas!');
  };

  const handleLogout = () => { logout(); navigate('/affiliate-login'); };

  if (!user) return null;

  const menuItems = [
    { id: 'users' as Panel, label: 'Ver Utilizadores', icon: Users },
    { id: 'tasks' as Panel, label: 'Validar Tarefas', icon: CheckSquare },
    { id: 'ads' as Panel, label: 'Publicidades', icon: Megaphone },
    { id: 'newTasks' as Panel, label: 'Novas Tarefas', icon: PlusCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="glass md:w-64 md:min-h-screen p-4 flex md:flex-col gap-2 shrink-0">
        <div className="hidden md:block mb-6">
          <h2 className="text-lg font-bold text-gradient-accent font-display">Admin Panel</h2>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setPanel(item.id); setSelectedUser(null); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                panel === item.id ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <item.icon size={18} />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="hidden md:block mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors w-full">
            <LogOut size={18} /> Sair
          </button>
        </div>
        <button onClick={handleLogout} className="md:hidden text-destructive p-1 ml-auto">
          <LogOut size={18} />
        </button>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-auto">
        {!panel && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gradient-accent mb-2 font-display">Painel do Administrador</h2>
              <p className="text-muted-foreground">Selecione uma opção no menu</p>
            </div>
          </div>
        )}

        {/* USERS */}
        {panel === 'users' && !selectedUser && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Utilizadores Registados ({users.length})</h2>
            <div className="space-y-2">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="w-full glass rounded-xl p-4 text-left hover:border-primary/50 transition-colors"
                >
                  <p className="font-medium text-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">ID: {u.id}</p>
                </button>
              ))}
              {users.length === 0 && <p className="text-muted-foreground">Nenhum utilizador registado</p>}
            </div>
          </div>
        )}

        {panel === 'users' && selectedUser && (
          <div>
            <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Detalhes do Utilizador</h2>
            <div className="glass rounded-2xl p-6 max-w-lg space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <Input value={selectedUser.email} onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })} className="bg-secondary/50" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Senha</label>
                <Input value={selectedUser.password} onChange={e => setSelectedUser({ ...selectedUser, password: e.target.value })} className="bg-secondary/50" />
              </div>
              {(() => {
                const profile = JSON.parse(localStorage.getItem(`fv_profile_${selectedUser.id}`) || '{}');
                return Object.keys(profile).length > 0 ? (
                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">Informações do Perfil:</p>
                    {[
                      { label: 'Nome', value: profile.fullName },
                      { label: 'Idade', value: profile.age },
                      { label: 'Morada', value: profile.address },
                      { label: 'Género', value: profile.gender },
                      { label: 'Telefone', value: profile.phone },
                      { label: 'IBAN', value: profile.bankAccount },
                    ].map(item => (
                      <p key={item.label} className="text-sm text-muted-foreground">{item.label}: {item.value || '-'}</p>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Perfil ainda não preenchido</p>;
              })()}
              <Button onClick={() => {
                const allUsers = JSON.parse(localStorage.getItem('fv_users') || '[]');
                const idx = allUsers.findIndex((u: any) => u.id === selectedUser.id);
                if (idx >= 0) {
                  allUsers[idx].email = selectedUser.email;
                  allUsers[idx].password = selectedUser.password;
                  localStorage.setItem('fv_users', JSON.stringify(allUsers));
                  toast.success('Utilizador atualizado!');
                }
              }} className="w-full btn-glow-primary !rounded-xl">
                Guardar Alterações
              </Button>
            </div>
          </div>
        )}

        {/* VALIDATE TASKS */}
        {panel === 'tasks' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Validar Tarefas ({submissions.length} pendentes)</h2>
            <div className="space-y-4">
              {submissions.map(sub => (
                <div key={sub.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start gap-4">
                    {sub.screenshot && (
                      <img src={sub.screenshot} alt="Captura" className="w-32 h-24 object-cover rounded-lg border border-border" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{sub.userEmail}</p>
                      <p className="text-sm text-muted-foreground">Tarefa: {sub.taskId}</p>
                      <p className="text-xs text-muted-foreground">{new Date(sub.date).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveTask(sub)} className="bg-green-600 hover:bg-green-700">
                        <Check size={16} />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectTask(sub)}>
                        <X size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {submissions.length === 0 && <p className="text-muted-foreground">Nenhuma tarefa pendente</p>}
            </div>
          </div>
        )}

        {/* ADS */}
        {panel === 'ads' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Publicidades Recebidas ({ads.length})</h2>
            <div className="space-y-4">
              {ads.map(ad => (
                <div key={ad.id} className="glass rounded-2xl p-6">
                  <div className="grid gap-2 text-sm">
                    {[
                      { label: 'Nome', value: ad.name },
                      { label: 'Empresa', value: ad.company },
                      { label: 'Email', value: ad.email },
                      { label: 'Detalhes', value: ad.details },
                      { label: 'Banco', value: ad.bank },
                      { label: 'Arquivo', value: ad.fileName || 'N/A' },
                      { label: 'Comprovativo', value: ad.receiptName || 'N/A' },
                      { label: 'Data', value: new Date(ad.date).toLocaleString() },
                    ].map(item => (
                      <p key={item.label}><span className="text-muted-foreground">{item.label}:</span> <span className="text-foreground">{item.value}</span></p>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="text-xs">
                      <Download size={14} className="mr-1" /> Baixar Publicidade
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteAd(ad.id)} className="text-xs">
                      <Trash2 size={14} className="mr-1" /> Apagar Mensagem
                    </Button>
                  </div>
                </div>
              ))}
              {ads.length === 0 && <p className="text-muted-foreground">Nenhuma publicidade recebida</p>}
            </div>
          </div>
        )}

        {/* NEW TASKS */}
        {panel === 'newTasks' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Novas Tarefas</h2>
            <div className="glass rounded-2xl p-6 max-w-lg space-y-3">
              {taskLinks.map((link, i) => (
                <div key={i}>
                  <label className="text-sm text-muted-foreground mb-1 block">Tarefa {i + 1}</label>
                  <Input
                    placeholder="Cole o link do YouTube"
                    value={link}
                    onChange={e => {
                      const newLinks = [...taskLinks];
                      newLinks[i] = e.target.value;
                      setTaskLinks(newLinks);
                    }}
                    className="bg-secondary/50"
                  />
                </div>
              ))}
              <Button onClick={saveTasks} className="w-full btn-glow-accent !rounded-xl">Guardar Tarefas</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
