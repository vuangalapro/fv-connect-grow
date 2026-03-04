import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRuleAcceptance } from '@/contexts/RuleAcceptanceContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Home, CheckSquare, User, Wallet, Headphones, ChevronLeft, ChevronRight, ExternalLink, Upload, ArrowLeft, Send, MessageCircle, Menu, Banknote, ClipboardList, X, Trash2, Pencil, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useVideoTask } from '@/contexts/VideoTaskContext';
import VideoTaskPlayer from '@/components/VideoTaskPlayer';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'philipvuangala@gmail.com';

type Panel = 'home' | 'tasks' | 'reviews' | 'profile' | 'wallet' | 'withdrawals' | 'support';

const slides = [
  { title: 'Marketing Digital', desc: 'Alcance milhões de clientes online', colors: 'from-blue-600 to-cyan-500', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80' },
  { title: 'Redes Sociais', desc: 'Gestão profissional de conteúdo', colors: 'from-purple-600 to-pink-500', image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80' },
  { title: 'SEO & SEM', desc: 'Posicione-se no topo dos buscadores', colors: 'from-green-600 to-emerald-500', image: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80' },
  { title: 'Email Marketing', desc: 'Campanhas personalizadas', colors: 'from-orange-600 to-yellow-500', image: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&q=80' },
  { title: 'Branding', desc: 'Construa uma marca memorável', colors: 'from-red-600 to-rose-500', image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80' },
  { title: 'E-commerce', desc: 'Venda online sem limites', colors: 'from-indigo-600 to-blue-500', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80' },
  { title: 'Publicidade Paga', desc: 'ROI maximizado em campanhas', colors: 'from-teal-600 to-cyan-500', image: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80' },
  { title: 'Marketing de Conteúdo', desc: 'Conteúdo que converte', colors: 'from-violet-600 to-purple-500', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80' },
  { title: 'Influencers', desc: 'Parcerias estratégicas', colors: 'from-pink-600 to-rose-500', image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80' },
  { title: 'Analytics', desc: 'Dados que impulsionam resultados', colors: 'from-sky-600 to-blue-500', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80' },
  { title: 'Automação', desc: 'Processos inteligentes', colors: 'from-amber-600 to-orange-500', image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80' },
  { title: 'Estratégia Digital', desc: 'Planejamento completo', colors: 'from-emerald-600 to-teal-500', image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80' },
];

const menuItems: { id: Panel; label: string; icon: any }[] = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'tasks', label: 'Tarefas', icon: CheckSquare },
  { id: 'reviews', label: 'Em revisão', icon: ClipboardList },
  { id: 'profile', label: 'Meu Perfil', icon: User },
  { id: 'wallet', label: 'Minha Carteira', icon: Wallet },
  { id: 'withdrawals', label: 'Saques', icon: Banknote },
  { id: 'support', label: 'Suporte Técnico', icon: Headphones },
];

const AffiliateDashboard = () => {
  const { user, loading, logout, refreshProfile } = useAuth();
  const { showRulesOnDemand } = useRuleAcceptance();
  const { setSwitchToReviewsCallback } = useVideoTask();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>('home');
  const [slide, setSlide] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [profile, setProfile] = useState({ fullName: '', age: '', address: '', gender: '', phone: '', bankName: '', bankAccount: '', penaltyCredit: 100 });
  const [isEditing, setIsEditing] = useState(false);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; url: string; expires_at?: string; task_type?: string; required_time?: number }>>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const [rejectedTasks, setRejectedTasks] = useState<string[]>([]);
  const [submissionsHistory, setSubmissionsHistory] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });
  const [myMessages, setMyMessages] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const unreadRepliesCount = myMessages.filter(m => m.reply && !m.affiliate_read).length;

  const [openedTasks, setOpenedTasks] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Only redirect if we're sure user is not logged in
        navigate('/affiliate-login');
      } else if (user.is_admin) {
        navigate('/admin');
      }
    }
  }, [user, loading, navigate]);

  // Calculate remaining time for a task
  const getRemainingTime = (expiresAt: string) => {
    if (!expiresAt) return '24h';
    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    const diff = expires - now;

    if (diff <= 0) return 'Expirada';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    if (panel !== 'home') return;
    const timer = setInterval(() => setSlide(s => (s + 1) % slides.length), 3000);
    return () => clearInterval(timer);
  }, [panel]);

  // fetchData function must be defined before its useEffect
  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile({
          fullName: profileData.full_name || '',
          age: profileData.age || '',
          address: profileData.address || '',
          gender: profileData.gender || '',
          phone: profileData.phone || '',
          bankName: profileData.bank_name || '',
          bankAccount: profileData.bank_account || '',
          penaltyCredit: profileData.penalty_credit ?? 100,
        });
        setBalance(parseFloat(profileData.balance || 0));
      }

      // 2. Fetch Tasks
      const { data: tasksData } = await supabase.from('tasks').select('*');
      if (tasksData) setTasks(tasksData);

      // 3. Fetch Submissions
      const { data: subsData } = await supabase
        .from('task_submissions')
        .select(`*, tasks(title)`)
        .eq('user_id', user.id);

      if (subsData) {
        setSubmissionsHistory(subsData);
        setCompletedTasks(subsData.filter(s => s.status === 'approved').map(s => s.task_id));
        setPendingTasks(subsData.filter(s => s.status === 'pending').map(s => s.task_id));
        setRejectedTasks(subsData.filter(s => s.status === 'rejected').map(s => s.task_id));
      }

      // 4. Fetch Withdrawals
      const { data: withdrawalsData } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (withdrawalsData) setWithdrawals(withdrawalsData);

      // 5. Opened Tasks
      const { data: openedData } = await supabase
        .from('opened_tasks')
        .select('task_id')
        .eq('user_id', user.id);

      if (openedData) setOpenedTasks(openedData.map(o => o.task_id));

      // 6. Try to fetch Support Messages (wrapped in its own try-catch to not break the page)
      try {
        const { data: supportData } = await supabase
          .from('support_messages')
          .select('*')
          .eq('user_id', user.id);
        if (supportData) setMyMessages(supportData);
      } catch (e) {
        console.log('Support messages not available');
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  // Fetch data when user or panel changes
  useEffect(() => {
    if (!loading && user) {
      fetchData();
    }
  }, [loading, user, panel, fetchData]);

  // Register callback for switching to reviews panel after task submission
  useEffect(() => {
    if (setSwitchToReviewsCallback) {
      setSwitchToReviewsCallback(() => {
        setPanel('reviews');
      });
    }
  }, [setSwitchToReviewsCallback]);

  // Fetch support messages when support panel is opened
  useEffect(() => {
    if (panel === 'support' && user) {
      fetchMyMessages();
    }
  }, [panel, user]);

  // Reset edit mode and refresh profile when opening profile panel
  useEffect(() => {
    if (panel === 'profile' && user) {
      setIsEditing(false);
      const fetchProfileData = async () => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profileData) {
          setProfile({
            fullName: profileData.full_name || '',
            age: profileData.age || '',
            address: profileData.address || '',
            gender: profileData.gender || '',
            phone: profileData.phone || '',
            bankName: profileData.bank_name || '',
            bankAccount: profileData.bank_account || '',
            penaltyCredit: profileData.penalty_credit ?? 100,
          });
        }
      };
      fetchProfileData();
    }
  }, [panel, user]);

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground animate-pulse font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.fullName,
        age: profile.age,
        address: profile.address,
        gender: profile.gender,
        phone: profile.phone,
        bank_name: profile.bankName,
        bank_account: profile.bankAccount,
      })
      .eq('id', user.id);

    if (error) {
      toast.error('Erro ao guardar informações');
    } else {
      toast.success('Informações guardadas com sucesso!');
      setIsEditing(false);
      refreshProfile();
    }
  };

  // Check if profile is complete
  const isProfileComplete = () => {
    return profile.fullName && profile.phone && profile.bankName && profile.bankAccount;
  };

  const markTaskAsOpened = async (taskId: string) => {
    if (!user) return;
    if (!openedTasks.includes(taskId)) {
      try {
        const { error } = await supabase
          .from('opened_tasks')
          .insert({ user_id: user.id, task_id: taskId });

        if (error && !error.message.includes('duplicate key')) throw error;

        setOpenedTasks(prev => [...prev, taskId]);
      } catch (error) {
        console.error('Error marking task as opened:', error);
      }
    }
  };

  const handleTaskUpload = async (taskId: string, file: File) => {
    if (!user) return;
    if (!openedTasks.includes(taskId)) {
      toast.error('Por favor, abra o link da tarefa primeiro para assisti-la antes de enviar a captura de ecrã.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const screenshotData = canvas.toDataURL('image/jpeg', 0.6);

        try {
          // Check if user already submitted this task
          const { data: existingSubmission } = await supabase
            .from('task_submissions')
            .select('id, status')
            .eq('task_id', taskId)
            .eq('user_id', user.id)
            .single();

          if (existingSubmission) {
            if (existingSubmission.status === 'approved') {
              toast.error('Já completaste esta tarefa!');
            } else if (existingSubmission.status === 'pending') {
              toast.error('Já enviaste esta tarefa! Aguarda validação.');
            } else if (existingSubmission.status === 'rejected') {
              // Allow resubmission - update instead of insert
              const { error } = await supabase
                .from('task_submissions')
                .update({
                  screenshot_url: screenshotData,
                  status: 'pending',
                  created_at: new Date().toISOString()
                })
                .eq('id', existingSubmission.id);

              if (error) throw error;
              toast.success('Tarefa reenviada! Aguardando validação.');
              fetchData();
            }
            return;
          }

          const { error } = await supabase.from('task_submissions').insert({
            task_id: taskId,
            user_id: user.id,
            screenshot_url: screenshotData,
            status: 'pending',
          });

          if (error) throw error;

          toast.success('Tarefa concluída! Aguardando validação do administrador.');
          fetchData();
        } catch (error) {
          console.error("Submission error:", error);
          toast.error('Erro ao enviar a tarefa.');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast.error('Insira um valor válido'); return; }
    if (amount > balance) { toast.error('Saldo insuficiente'); return; }
    if (!profile.bankAccount) { toast.error('Registe sua conta bancária no Meu Perfil'); return; }

    try {
      // Use atomic RPC to deduct balance (prevents race conditions)
      const { data: success, error: rpcError } = await supabase.rpc('atomic_balance_deduct', {
        target_user_id: user.id,
        amount: amount,
      });

      if (rpcError || !success) {
        toast.error('Saldo insuficiente ou erro ao processar');
        return;
      }

      // Insert withdrawal request
      const { error } = await supabase.from('withdrawals').insert({
        user_id: user.id,
        amount,
        bank_account: `${profile.bankName} - ${profile.bankAccount}`,
        status: 'pending',
      });

      if (error) throw error;

      setWithdrawAmount('');
      toast.success(`Pedido de saque de ${amount} Kz enviado!`);
      fetchData();
      refreshProfile();
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error('Erro ao processar saque');
    }
  };

  const handleLogout = async () => { await logout(); navigate('/affiliate-login'); };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Submit to database
      const { error: dbError } = await supabase.from('support_messages').insert({
        user_id: user?.id,
        name: profile.fullName || user?.email?.split('@')[0] || 'Afiliado',
        email: user?.email || '',
        subject: supportForm.subject,
        message: supportForm.message,
      });

      if (!dbError) {
        toast.success('Mensagem enviada com sucesso!');
        setSupportForm({ subject: '', message: '' });
        // Refresh messages
        fetchMyMessages();
        return;
      }

      console.warn('Database error:', dbError);
    } catch (err) {
      console.error('Error:', err);
    }

    // Fallback: open email client
    const targetEmail = SUPPORT_EMAIL;
    const emailSubject = encodeURIComponent(`Suporte Fv-Comércio: ${supportForm.subject}`);
    const emailBody = encodeURIComponent(
      `Nome: ${profile.fullName || user?.email?.split('@')[0] || 'Afiliado'}\n` +
      `Email: ${user?.email || ''}\n` +
      `\n` +
      `Mensagem:\n${supportForm.message}`
    );

    window.open(`mailto:${targetEmail}?subject=${emailSubject}&body=${emailBody}`);
    toast.success('A abrir o seu cliente de email...');
    setSupportForm({ subject: '', message: '' });
  };

  const fetchMyMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setMyMessages(data);
  };

  const markAsRead = async (msgId: string) => {
    const msg = myMessages.find(m => m.id === msgId);
    if (msg && msg.reply && !msg.affiliate_read) {
      try {
        const { error } = await supabase
          .from('support_messages')
          .update({ affiliate_read: true })
          .eq('id', msgId);

        if (!error) {
          setMyMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, affiliate_read: true } : m
          ));
        }
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
  };

  if (!user) return null;

  // Filter out completed (approved), pending and rejected tasks so they don't show in available tasks
  const availableTasks = tasks.filter(t => !completedTasks.includes(t.id) && !pendingTasks.includes(t.id) && !rejectedTasks.includes(t.id));

  return (
    <div className="min-h-screen flex flex-col md:flex-row !overflow-visible">
      {/* Mobile Menu Overlay */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* Sidebar - Desktop only */}
      <div className="hidden md:flex glass md:w-64 md:h-screen md:sticky md:top-0 p-4 flex-col gap-2 shrink-0">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gradient-primary font-display">Fv-Comércio</h2>
          <p className="text-xs text-muted-foreground truncate">Bem-Vindo {profile.fullName || 'Afiliado'}</p>
        </div>

        <div className="flex flex-col gap-1 w-full">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { 
                if (item.id === 'home') {
                  showRulesOnDemand();
                }
                setPanel(item.id); 
                setMobileMenu(false); 
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${panel === item.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === 'support' && unreadRepliesCount > 0 && (
                <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{unreadRepliesCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-auto">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors w-full">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 glass flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-bold text-gradient-primary font-display">Fv-Comércio</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileMenu(!mobileMenu)} className="text-muted-foreground p-1">
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
          <button onClick={handleLogout} className="text-destructive p-1">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Mobile Menu - Slides from top */}
      <div className={`${mobileMenu ? 'flex' : 'hidden'} md:hidden flex-col gap-1 w-full fixed inset-x-0 z-40 top-12 bg-background/95 backdrop-blur-sm px-4 py-4 shadow-lg`}>
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => { 
              if (item.id === 'home') {
                showRulesOnDemand();
              }
              setPanel(item.id); 
              setMobileMenu(false); 
            }}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${panel === item.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
          >
            <item.icon size={20} />
            {item.label}
            {item.id === 'support' && unreadRepliesCount > 0 && (
              <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold ml-auto">{unreadRepliesCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 !overflow-visible relative md:pt-4 pt-16">
        {isLoadingData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl" style={{opacity: 0, pointerEvents: 'none'}}>
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-muted-foreground animate-pulse" style={{opacity: 0}}>A carregar dados...</p>
            </div>
          </div>
        )}
        {/* HOME - Slider */}
        {panel === 'home' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 font-display">Publicidades em Destaque</h2>
            <div className="relative rounded-2xl overflow-hidden h-64 md:h-96 lg:h-[400px]">
              {slides.map((s, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 flex flex-col items-center justify-center p-8 bg-cover bg-center transition-opacity duration-700 ${i === slide ? 'opacity-100' : 'opacity-0'
                    }`}
                  style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(${s.image})` }}
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
            
            {/* Progress Bars - Penalty Credit & Tasks */}
            <div className="mt-8 space-y-6">
              {/* Penalty Credit Progress Bar */}
              <div className="p-4 bg-card rounded-xl border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <AlertTriangle size={18} className={profile.penaltyCredit <= 20 ? 'text-red-400' : profile.penaltyCredit <= 50 ? 'text-yellow-400' : 'text-green-400'} />
                    Crédito de Penalidades
                  </h3>
                  <span className={`font-bold ${profile.penaltyCredit <= 20 ? 'text-red-400' : profile.penaltyCredit <= 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {profile.penaltyCredit}/100
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${profile.penaltyCredit <= 20 ? 'bg-red-500' : profile.penaltyCredit <= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.max(0, profile.penaltyCredit)}%` }}
                  />
                </div>
                {profile.penaltyCredit <= 20 && (
                  <p className="text-xs text-red-400 mt-2">⚠️ Atenção: Seus créditos estão muito baixos.</p>
                )}
              </div>

              {/* Tasks Completed Progress Bar */}
              <div className="p-4 bg-card rounded-xl border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <CheckSquare size={18} className="text-primary" />
                    Tarefas de Hoje
                  </h3>
                  <span className="font-bold text-primary">
                    {completedTasks.length}/{tasks.length}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {completedTasks.length === tasks.length ? '🎉 Todas as tarefas concluídas!' : `${tasks.length - completedTasks.length} tarefas restantes`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TASKS */}
        {panel === 'tasks' && (
          <div className="overflow-visible">
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-2 font-display">Completar tarefas hoje</h2>
            <p className="text-muted-foreground mb-6">{completedTasks.length}/{tasks.length} tarefas completas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableTasks.map(task => {
                const isPending = pendingTasks.includes(task.id);
                const isRejected = rejectedTasks.includes(task.id);
                const isVideoTask = task.task_type === 'video';

                return (
                  <div key={task.id} className="glass rounded-xl p-3 overflow-visible">
                    {isVideoTask ? (
                      // Video Task with YouTube player
                      <VideoTaskPlayer
                        taskId={task.id}
                        userId={user?.id || ''}
                        videoUrl={task.url}
                        requiredTime={task.required_time || 90}
                        onTimeUpdate={(seconds) => {
                          console.log('Video watched:', seconds, 'seconds');
                        }}
                        onSubmit={async (submissionData) => {
                          const { screenshotData, watchedTime, deviceFingerprint, startTime } = submissionData;

                          try {
                            // Check if user already submitted this task
                            const { data: existingSubmission } = await supabase
                              .from('task_submissions')
                              .select('id, status')
                              .eq('task_id', task.id)
                              .eq('user_id', user.id)
                              .single();

                            if (existingSubmission) {
                              if (existingSubmission.status === 'approved') {
                                toast.error('Já completaste esta tarefa!');
                                return;
                              } else if (existingSubmission.status === 'pending') {
                                toast.error('Já enviaste esta tarefa! Aguarda validação.');
                                return;
                              } else if (existingSubmission.status === 'rejected') {
                                // Allow resubmission - update instead of insert
                                const { error } = await supabase
                                  .from('task_submissions')
                                  .update({
                                    screenshot_url: screenshotData,
                                    watched_time: watchedTime,
                                    device_fingerprint: deviceFingerprint,
                                    start_time: startTime.toISOString(),
                                    screenshot_uploaded: true,
                                    status: 'pending',
                                    created_at: new Date().toISOString()
                                  })
                                  .eq('id', existingSubmission.id);

                                if (error) throw error;
                                toast.success('Tarefa reenviada! Aguardando validação.');
                                fetchData();
                                return;
                              }
                            }

                            // Simple submission without code
                            const submissionData: any = {
                              task_id: task.id,
                              user_id: user.id,
                              screenshot_url: screenshotData,
                              watched_time: watchedTime,
                              device_fingerprint: deviceFingerprint,
                              start_time: startTime.toISOString(),
                              screenshot_uploaded: true,
                              risk_score: 0,
                              fraud_alert: null,
                              status: 'pending',
                            };

                            const { error } = await supabase.from('task_submissions').insert(submissionData);

                            if (error) throw error;

                            toast.success('Tarefa concluída! Aguardando validação do administrador.');
                            fetchData();
                          } catch (error) {
                            console.error('Submission error:', error);
                            // Show more detailed error message
                            if (error instanceof Error) {
                              toast.error(`Erro: ${error.message}`);
                            } else {
                              toast.error('Erro ao enviar a tarefa. Tente novamente.');
                            }
                          }
                        }}
                      />
                    ) : (
                      // Regular link task
                      <div className="flex items-center gap-3">
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (user && !openedTasks.includes(task.id)) {
                              supabase.from('opened_tasks').insert({ user_id: user.id, task_id: task.id }).then(() => {
                                setOpenedTasks(prev => [...prev, task.id]);
                              });
                            }
                          }}
                          className="w-24 h-16 rounded-lg bg-red-600/20 flex items-center justify-center shrink-0 hover:bg-red-600/30 transition-colors"
                        >
                          <ExternalLink size={16} className="text-red-400" />
                        </a>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <span className="text-xs text-orange-400 font-medium shrink-0 ml-2">
                              ⏱ {getRemainingTime(task.expires_at)}
                            </span>
                          </div>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              if (user && !openedTasks.includes(task.id)) {
                                supabase.from('opened_tasks').insert({ user_id: user.id, task_id: task.id }).then(() => {
                                  setOpenedTasks(prev => [...prev, task.id]);
                                });
                              }
                            }}
                            className="text-xs text-primary hover:underline truncate block"
                          >Abrir no YouTube</a>
                          {isPending && <p className="text-xs text-yellow-400 mt-1">⏳ Aguardando validação</p>}
                          {isRejected && <p className="text-xs text-red-400 mt-1">✗ Rejeitada - Envie nova captura cumprindo os requisitos</p>}
                        </div>
                        {!isPending && (
                          <div className="flex items-center gap-1 shrink-0">
                            <label className="cursor-pointer">
                              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => e.target.files?.[0] && handleTaskUpload(task.id, e.target.files[0])} />
                              <div className="flex bg-primary/20 text-primary items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors">
                                <Upload size={14} /> Anexar captura
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {tasks.length === 0 && <p className="text-muted-foreground">Nenhuma tarefa disponivel hoje</p>}
              {tasks.length > 0 && availableTasks.length === 0 && <p className="text-muted-foreground">Todas as tarefas de hoje foram concluídas</p>}
            </div>
          </div>
        )}

        {/* REVIEWS */}
        {panel === 'reviews' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-2 font-display">Em Revisão</h2>
            <p className="text-muted-foreground mb-6">Acompanhe o estado de aprovação das suas tarefas.</p>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{submissionsHistory.filter(s => s.status === 'approved' && new Date(s.created_at).toDateString() === new Date().toDateString()).length}</p>
                <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary">{availableTasks.length}</p>
                <p className="text-xs text-muted-foreground">Disponíveis</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">{submissionsHistory.filter(s => s.status === 'pending').length}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{submissionsHistory.filter(s => s.status === 'rejected').length}</p>
                <p className="text-xs text-muted-foreground">Rejeitadas</p>
              </div>
            </div>

            <div className="grid gap-3">
              {submissionsHistory
                .filter(sub => sub.status !== 'approved') // Hide approved tasks from review section
                .map(sub => {
                  const task = tasks.find(t => t.id === sub.task_id);
                  return (
                    <div key={sub.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{task?.title || 'Tarefa'}</p>
                          <p className="text-xs text-muted-foreground mt-1">Enviado em {new Date(sub.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sub.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          sub.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                          {sub.status === 'approved' ? '✓ Aprovada (+50 Kz)' : sub.status === 'rejected' ? '✗ Rejeitada' : '⏳ Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              {submissionsHistory.filter(sub => sub.status !== 'approved').length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Não há tarefas em revisão.</p>
                  <p className="text-sm text-muted-foreground mt-1">Tarefas concluídas aparecem no seu histórico.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFILE */}
        {panel === 'profile' && (
          <div>
            <button onClick={() => setPanel('home')} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>

            {/* Warning if profile not complete */}
            {!isProfileComplete() && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-amber-400 font-medium">Complete o seu perfil</p>
                  <p className="text-amber-400/70 text-sm mt-1">Por favor, adicione as suas informações bancárias para poder solicitar saques.</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-display">Meu Perfil</h2>
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant={isEditing ? "outline" : "default"}
                className={isEditing ? "!rounded-xl" : "btn-glow-primary !rounded-xl"}
              >
                {isEditing ? (
                  <><X size={16} className="mr-2" /> Cancelar</>
                ) : (
                  <><Pencil size={16} className="mr-2" /> Editar</>
                )}
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Info Card */}
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <User className="text-primary" size={20} />
                  </div>
                  <h3 className="text-lg font-semibold">Informações Pessoais</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nome Completo</label>
                    {isEditing ? (
                      <Input
                        value={profile.fullName}
                        onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                        className="bg-secondary/50"
                        placeholder="Seu nome completo"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{profile.fullName || 'Não definido'}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Idade</label>
                    {isEditing ? (
                      <Input
                        value={profile.age}
                        onChange={e => setProfile({ ...profile, age: e.target.value })}
                        className="bg-secondary/50"
                        placeholder="Sua idade"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{profile.age || 'Não definido'}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Morada</label>
                    {isEditing ? (
                      <Input
                        value={profile.address}
                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                        className="bg-secondary/50"
                        placeholder="Sua morada"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{profile.address || 'Não definido'}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Género</label>
                    {isEditing ? (
                      <select
                        value={profile.gender}
                        onChange={e => setProfile({ ...profile, gender: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="" disabled>Selecione uma opção</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Outro">Outro</option>
                        <option value="Prefiro não dizer">Prefiro não dizer</option>
                      </select>
                    ) : (
                      <p className="text-foreground font-medium">{profile.gender || 'Não definido'}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
                    {isEditing ? (
                      <Input
                        value={profile.phone}
                        onChange={e => setProfile({ ...profile, phone: e.target.value })}
                        className="bg-secondary/50"
                        placeholder="Seu número de telefone"
                      />
                    ) : (
                      <p className="text-foreground font-medium">{profile.phone || 'Não definido'}</p>
                    )}
                  </div>

                  {/* Penalty Credit Display */}
                  <div className="mt-6 pt-6 border-t border-border/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl ${profile.penaltyCredit <= 20 ? 'bg-red-500/20' : profile.penaltyCredit <= 50 ? 'bg-yellow-500/20' : 'bg-green-500/20'} flex items-center justify-center`}>
                        <AlertTriangle className={profile.penaltyCredit <= 20 ? 'text-red-400' : profile.penaltyCredit <= 50 ? 'text-yellow-400' : 'text-green-400'} size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Créditos de Penalty</h3>
                        <p className="text-xs text-muted-foreground">Sistema antifraude</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Créditos disponíveis</span>
                          <span className={`font-bold ${profile.penaltyCredit <= 20 ? 'text-red-400' : profile.penaltyCredit <= 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {profile.penaltyCredit}/100
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${profile.penaltyCredit <= 20 ? 'bg-red-500' : profile.penaltyCredit <= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.max(0, profile.penaltyCredit)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {profile.penaltyCredit <= 20 && (
                      <p className="text-xs text-red-400 mt-2">⚠️ Atenção: Seus créditos estão muito baixos. Evite violações das regras.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bank Info Card */}
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Banknote className="text-green-400" size={20} />
                  </div>
                  <h3 className="text-lg font-semibold">Informações Bancárias</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Banco</label>
                    {isEditing ? (
                      <select
                        value={profile.bankName}
                        onChange={e => setProfile({ ...profile, bankName: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="" disabled>Selecione um banco</option>
                        <option value="BAI">BAI</option>
                        <option value="BFA">BFA</option>
                        <option value="BCI">BCI</option>
                        <option value="BIC">BIC</option>
                        <option value="BPC">BPC</option>
                        <option value="Banco Atlântico">Banco Atlântico</option>
                      </select>
                    ) : (
                      <p className="text-foreground font-medium">{profile.bankName || 'Não definido'}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Conta Bancária (IBAN)</label>
                    {isEditing ? (
                      <Input
                        value={profile.bankAccount}
                        onChange={e => setProfile({ ...profile, bankAccount: e.target.value })}
                        className="bg-secondary/50 font-mono"
                        placeholder="AO06 0000 0000 0000 0000 0000"
                      />
                    ) : (
                      <p className="text-foreground font-medium font-mono">{profile.bankAccount || 'Não definido'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isEditing && (
              <Button onClick={saveProfile} className="w-full btn-glow-primary !rounded-xl mt-6">
                <Check size={16} className="mr-2" /> Guardar Informações
              </Button>
            )}
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
                      <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">IBAN: {w.bank_account}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
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

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
              {/* Form to send new message */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-bold mb-4">Nova Mensagem</h3>
                <div className="text-sm text-muted-foreground mb-3">
                  <p>A enviar como: <span className="text-foreground font-medium">{profile.fullName || user?.email?.split('@')[0]}</span></p>
                  <p>Email: <span className="text-foreground font-medium">{user?.email}</span></p>
                </div>
                <form onSubmit={handleSupportSubmit} className="space-y-3">
                  <Input placeholder="Assunto" value={supportForm.subject} onChange={e => setSupportForm({ ...supportForm, subject: e.target.value })} className="bg-secondary/50" required />
                  <Textarea placeholder="Escreva sua mensagem" value={supportForm.message} onChange={e => setSupportForm({ ...supportForm, message: e.target.value })} className="bg-secondary/50" rows={3} required />
                  <Button type="submit" className="w-full btn-glow-primary !rounded-xl">Enviar</Button>
                </form>
              </div>

              {/* Messages list */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-bold mb-4">Minhas Mensagens ({myMessages.length})</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {myMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${msg.reply && !msg.affiliate_read
                        ? 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/30'
                        : selectedMessage?.id === msg.id
                          ? 'bg-primary/20 border border-primary/30'
                          : 'bg-secondary/30 hover:bg-secondary/50'
                        }`}
                      onClick={() => { setSelectedMessage(msg); markAsRead(msg.id); }}
                    >
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm truncate">{msg.subject}</p>
                        {msg.reply && !msg.affiliate_read && (
                          <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">Nova</span>
                        )}
                        {msg.reply && msg.affiliate_read && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{msg.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {myMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma mensagem ainda
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Selected message detail */}
            {selectedMessage && (
              <div className="mt-6 glass rounded-2xl p-6 max-w-4xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold">{selectedMessage.subject}</h3>
                    <p className="text-sm text-muted-foreground">{selectedMessage.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Enviada em: {new Date(selectedMessage.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
                    <X size={16} />
                  </Button>
                </div>

                <div className="bg-secondary/30 p-4 rounded-lg mb-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>

                {selectedMessage.reply ? (
                  <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                    <p className="text-sm font-bold text-green-400 mb-2">Resposta do Suporte:</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedMessage.reply}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedMessage.replied_at && new Date(selectedMessage.replied_at).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg">
                    <p className="text-sm text-orange-400">Aguardando resposta do suporte...</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (confirm('Tem certeza que deseja eliminar esta mensagem?')) {
                        await supabase.from('support_messages').delete().eq('id', selectedMessage.id);
                        setMyMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                        setSelectedMessage(null);
                        toast.success('Mensagem eliminada');
                      }
                    }}
                  >
                    <Trash2 size={14} className="mr-1" /> Eliminar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AffiliateDashboard;
