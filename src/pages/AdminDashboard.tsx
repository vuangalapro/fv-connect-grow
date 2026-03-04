import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, CheckSquare, Megaphone, PlusCircle, ArrowLeft, Trash2, Check, X, Download, Search, Banknote, Eye, Home, MessageSquare, FileText, Menu, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { performOCR, quickOCR } from '@/lib/ocrService';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

type Panel = 'users' | 'tasks' | 'ads' | 'newTasks' | 'withdrawals' | 'messages' | null;

// Modern color palette for charts
const COLORS = {
  primary: '#8b5cf6',
  secondary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
};

// Gradient colors for modern look
const GRADIENTS = {
  blue: ['#3b82f6', '#1d4ed8'],
  purple: ['#a855f7', '#7c3aed'],
  green: ['#10b981', '#059669'],
  orange: ['#f59e0b', '#d97706'],
  red: ['#ef4444', '#dc2626'],
  cyan: ['#06b6d4', '#0891b2'],
};

// Helper function to get color based on count - modern colors
const getCountColor = (count: number) => {
  if (count <= 30) return COLORS.secondary; // cyan for low
  if (count <= 60) return COLORS.success; // green for medium
  return COLORS.danger; // red for high
};

const getBarColor = (count: number) => {
  if (count <= 30) return COLORS.secondary;
  if (count <= 60) return COLORS.success;
  return COLORS.danger;
};

// Get gradient based on count
const getGradient = (count: number) => {
  if (count <= 30) return GRADIENTS.cyan;
  if (count <= 60) return GRADIENTS.green;
  return GRADIENTS.red;
};

// Process user registrations by date (last 7 days)
const processUserRegistrations = (profiles: any[]) => {
  const last7Days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = profiles.filter(p => {
      const createdAt = p.created_at?.split('T')[0];
      return createdAt === dateStr;
    }).length;
    last7Days.push({ date: dateStr, count, day: date.toLocaleDateString('pt-PT', { weekday: 'short' }) });
  }
  return last7Days;
};

// Process task submissions by date (last 7 days)
const processTaskRegistrations = (submissions: any[]) => {
  const last7Days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = submissions.filter(s => {
      const createdAt = s.created_at?.split('T')[0];
      return createdAt === dateStr;
    }).length;
    last7Days.push({ date: dateStr, count, day: date.toLocaleDateString('pt-PT', { weekday: 'short' }) });
  }
  return last7Days;
};

// Process ads by date (last 7 days)
const processAdsRegistrations = (adsData: any[]) => {
  const last7Days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = adsData.filter(a => {
      const createdAt = a.created_at?.split('T')[0];
      return createdAt === dateStr;
    }).length;
    last7Days.push({ date: dateStr, count, day: date.toLocaleDateString('pt-PT', { weekday: 'short' }) });
  }
  return last7Days;
};

const AdminDashboard = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [adSearchQuery, setAdSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [processingOCR, setProcessingOCR] = useState<Record<string, boolean>>({});
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(4);
  const [taskLinks, setTaskLinks] = useState<string[]>(Array(4).fill(''));
  const [taskTypes, setTaskTypes] = useState<string[]>(Array(4).fill('video'));
  const [taskRequiredTimes, setTaskRequiredTimes] = useState<number[]>(Array(4).fill(90));
  const [existingTasks, setExistingTasks] = useState<Array<{ id: string; title: string; url: string; expires_at?: string; task_type?: string; required_time?: number }>>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [previewFile, setPreviewFile] = useState<{ data: string; title: string; extractedCode?: string; fraudAlert?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const processedTaskIds = useRef<string[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const unreadMessagesCount = supportMessages.filter(m => !m.is_read).length;

  // Time series data for charts - registrations per day
  const [userRegistrations, setUserRegistrations] = useState<{ date: string; count: number }[]>([]);
  const [taskRegistrations, setTaskRegistrations] = useState<{ date: string; count: number }[]>([]);
  const [adsRegistrations, setAdsRegistrations] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/affiliate-login');
      } else if (!user.is_admin) {
        navigate('/dashboard');
      }
    }
  }, [user, loading, navigate]);

  // Fetch summary data when panel is null (overview page)
  useEffect(() => {
    if (panel === null && user?.is_admin) {
      const fetchOverviewData = async () => {
        const { data: profiles } = await supabase.from('profiles').select('id, created_at').neq('is_admin', true);
        const { data: w } = await supabase.from('withdrawals').select('*');
        const { data: s } = await supabase.from('task_submissions').select('*');
        const { data: t } = await supabase.from('tasks').select('id');
        const { data: a } = await supabase.from('ads').select('*, created_at');
        const { data: msgs } = await supabase.from('support_messages').select('*');

        if (profiles) {
          setUsers(profiles);
          setUserRegistrations(processUserRegistrations(profiles));
        }
        if (w) setWithdrawals(w);
        if (s) {
          setSubmissions(s);
          setTaskRegistrations(processTaskRegistrations(s));
        }
        if (t) setTaskCount(t.length);
        if (a) {
          setAds(a);
          setAdsRegistrations(processAdsRegistrations(a));
        }
        if (msgs) setSupportMessages(msgs);
      };
      fetchOverviewData();
    }
  }, [panel, user]);


  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      if (panel === 'users') {
        const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        const { data: withdrawals } = await supabase.from('withdrawals').select('*');
        const { data: submissions } = await supabase.from('task_submissions').select('*');
        const { data: tasks } = await supabase.from('tasks').select('id');
        const totalTasks = tasks?.length || 0;

        // Filter out admins in frontend instead of SQL to avoid complex filter errors
        const filteredProfiles = (profiles || []).filter(p => p.is_admin !== true);

        const usersWithFinance = filteredProfiles.map(p => {
          const userWithdrawals = (withdrawals || []).filter(w => w.user_id === p.id);
          const userSubmissions = (submissions || []).filter(s => s.user_id === p.id);

          const approved = userWithdrawals.filter(w => w.status === 'approved').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const pending = userWithdrawals.find(w => w.status === 'pending');

          const completedToday = userSubmissions.filter(s => s.status === 'approved').length;
          const pendingTasks = userSubmissions.filter(s => s.status === 'pending').length;

          return {
            ...p,
            last_withdrawal: approved.length > 0 ? approved[0].amount : 0,
            pending_withdrawal: pending ? pending.amount : 0,
            completed_tasks: completedToday,
            pending_tasks: pendingTasks,
            total_tasks: totalTasks
          };
        });
        setUsers(usersWithFinance);
      } else if (panel === 'tasks') {
        // Fetch submissions and profile data separately
        const { data: submissionsData } = await supabase
          .from('task_submissions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email');

        // Fetch tasks for video task info
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, task_type, required_time, url');

        const mergedSubmissions = (submissionsData || []).map(sub => {
          const profile = (profilesData || []).find(p => p.id === sub.user_id);
          const task = (tasksData || []).find(t => t.id === sub.task_id);
          return {
            ...sub,
            profiles: profile || { full_name: 'Unknown', email: 'N/A' },
            tasks: task || { title: 'Tarefa Desconhecida', task_type: 'link', required_time: 90, url: '' }
          };
        });

        setSubmissions(mergedSubmissions);
      } else if (panel === 'ads') {
        try {
          console.log('Fetching ads...');
          const { data, error } = await supabase.from('ads').select('*').order('created_at', { ascending: false });
          console.log('Ads response:', { data, error });
          if (error) {
            console.error('Error fetching ads:', error);
          }
          setAds(data || []);
        } catch (err) {
          console.error('Exception fetching ads:', err);
          setAds([]);
        }
      } else if (panel === 'withdrawals') {
        // Fetch withdrawals and profile data separately since foreign key may not exist
        const { data: withdrawalsData } = await supabase
          .from('withdrawals')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        // Also fetch all profiles for joining
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email');

        // Merge the data
        const mergedWithdrawals = (withdrawalsData || []).map(w => {
          const profile = (profilesData || []).find(p => p.id === w.user_id);
          return {
            ...w,
            profiles: profile || { full_name: 'Unknown', email: 'N/A' }
          };
        });

        console.log('Withdrawals query result:', { withdrawalsData, profilesData, mergedWithdrawals });
        setWithdrawals(mergedWithdrawals);
      } else if (panel === 'messages') {
        // Fetch support messages
        const { data: messages } = await supabase.from('support_messages').select('*').order('created_at', { ascending: false });
        setSupportMessages(messages || []);
      } else if (panel === 'newTasks') {
        const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
        if (data) {
          setExistingTasks(data.map(t => ({
            ...t,
            expires_at: t.expires_at
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Run OCR on video task submissions automatically
  const processOCRForSubmissions = useCallback(async (subs: any[]) => {
    const videoSubs = subs.filter(sub => sub.unique_comment_code && sub.screenshot_url);

    for (const sub of videoSubs) {
      if (processingOCR[sub.id]) continue;

      setProcessingOCR(prev => ({ ...prev, [sub.id]: true }));

      try {
        const ocrResult = await quickOCR(sub.screenshot_url);

        let fraudAlert: 'confiavel' | 'suspeita' | null = null;
        let riskScore = 0;

        // Check if code matches
        if (ocrResult.foundCodes && ocrResult.foundCodes.length > 0) {
          const codeMatch = ocrResult.foundCodes.some((code: string) =>
            code.toUpperCase() === sub.unique_comment_code?.toUpperCase()
          );

          if (codeMatch && ocrResult.confidence > 0.5) {
            fraudAlert = 'confiavel';
          } else {
            fraudAlert = 'suspeita';
            riskScore = 30;
          }
        } else {
          fraudAlert = 'suspeita';
          riskScore = 50;
        }

        // Update submission with OCR results
        await supabase.from('task_submissions').update({
          ocr_extracted_code: ocrResult.foundCodes?.join(', ') || null,
          ocr_confidence: ocrResult.confidence,
          fraud_alert: fraudAlert,
          risk_score: riskScore
        }).eq('id', sub.id);

        // Update local state
        setSubmissions(prev => prev.map(s =>
          s.id === sub.id ? {
            ...s,
            ocr_extracted_code: ocrResult.foundCodes?.join(', ') || null,
            ocr_confidence: ocrResult.confidence,
            fraudAlert,
            riskScore
          } : s
        ));

      } catch (error) {
        console.error('OCR error for submission:', sub.id, error);
      } finally {
        setProcessingOCR(prev => ({ ...prev, [sub.id]: false }));
      }
    }
  }, [processingOCR]);

  useEffect(() => {
    if (panel) {
      fetchData();
    }
  }, [panel, user]);

  // Run OCR when submissions are loaded
  useEffect(() => {
    if (submissions.length > 0 && panel === 'tasks') {
      processOCRForSubmissions(submissions);
    }
  }, [submissions, panel]);

  const approveTask = async (sub: any) => {
    try {
      // 1. Update submission status with validation info
      const { error: subError } = await supabase
        .from('task_submissions')
        .update({
          status: 'approved',
          validated_by: user?.id,
          validated_at: new Date().toISOString()
        })
        .eq('id', sub.id);

      if (subError) {
        console.error('Error updating task status:', subError);
        throw subError;
      }

      // 2. Use atomic function to add balance (prevents race conditions)
      const { data: success, error: rpcError } = await supabase.rpc('atomic_balance_add', {
        target_user_id: sub.user_id,
        amount: 50,
      });

      if (rpcError) {
        console.warn('RPC error, falling back to direct update:', rpcError);
        // Fallback to direct update
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', sub.user_id)
          .single();

        const currentBalance = parseFloat(profile?.balance || 0);
        const { error: balError } = await supabase
          .from('profiles')
          .update({ balance: currentBalance + 50 })
          .eq('id', sub.user_id);

        if (balError) throw balError;
      }

      setSubmissions(prev => prev.filter(s => s.id !== sub.id));

      // Mark task as processed to prevent re-appearance after fetchData
      processedTaskIds.current.push(sub.id);

      // Also update user submissions if viewing that user
      if (selectedUser && selectedUser.id === sub.user_id) {
        setUserSubmissions(prev => prev.map(s =>
          s.id === sub.id ? { ...s, status: 'approved' } : s
        ));
      }

      // Refresh users list to update task counts

      // Mark task as processed to prevent re-appearance
      processedTaskIds.current.push(sub.id);

      // Also update user submissions if viewing that user
      if (selectedUser && selectedUser.id === sub.user_id) {
        setUserSubmissions(prev => prev.map(s =>
          s.id === sub.id ? { ...s, status: 'rejected' } : s
        ));
      }




      // Refresh users list to update task counts
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      const { data: withdrawals } = await supabase.from('withdrawals').select('*');
      const { data: allSubmissions } = await supabase.from('task_submissions').select('*');
      const { data: tasks } = await supabase.from('tasks').select('id');
      const totalTasks = tasks?.length || 0;
      const filteredProfiles = (profiles || []).filter(p => p.is_admin !== true);
      const usersWithFinance = filteredProfiles.map(p => {
        const userWithdrawals = (withdrawals || []).filter(w => w.user_id === p.id);
        const userSubmissionsArr = (allSubmissions || []).filter(s => s.user_id === p.id);
        const approved = userWithdrawals.filter(w => w.status === 'approved').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const pending = userWithdrawals.find(w => w.status === 'pending');
        const completedToday = userSubmissionsArr.filter(s => s.status === 'approved').length;
        const pendingTasksCount = userSubmissionsArr.filter(s => s.status === 'pending').length;
        return {
          ...p,
          last_withdrawal: approved.length > 0 ? approved[0].amount : 0,
          pending_withdrawal: pending ? pending.amount : 0,
          completed_tasks: completedToday,
          pending_tasks: pendingTasksCount,
          total_tasks: totalTasks
        };
      });
      setUsers(usersWithFinance);

      toast.success('Tarefa aprovada! +50 Kz adicionado ao perfil');
    } catch (error) {
      console.error('Approve task error:', error);
      toast.error(`Erro ao aprovar tarefa: ${error}`);
    }
  };

  const rejectTask = async (sub: any) => {
    try {
      const { error } = await supabase
        .from('task_submissions')
        .update({ status: 'rejected' })
        .eq('id', sub.id);

      if (error) throw error;

      setSubmissions(prev => prev.filter(s => s.id !== sub.id));

      // Refresh submissions list
      const { data: submissionsData } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      const mergedSubmissions = (submissionsData || []).map(sub => {
        const profile = (profilesData || []).find(p => p.id === sub.user_id);
        return {
          ...sub,
          profiles: profile || { full_name: 'Unknown', email: 'N/A' }
        };
      });

      // Also update user submissions if viewing that user
      if (selectedUser && selectedUser.id === sub.user_id) {
        setUserSubmissions(prev => prev.map(s =>
          s.id === sub.id ? { ...s, status: 'rejected' } : s
        ));
      }




      // Refresh users list to update task counts
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      const { data: withdrawals } = await supabase.from('withdrawals').select('*');
      const { data: allSubmissions } = await supabase.from('task_submissions').select('*');
      const { data: tasks } = await supabase.from('tasks').select('id');
      const totalTasks = tasks?.length || 0;
      const filteredProfiles = (profiles || []).filter(p => p.is_admin !== true);
      const usersWithFinance = filteredProfiles.map(p => {
        const userWithdrawals = (withdrawals || []).filter(w => w.user_id === p.id);
        const userSubmissionsArr = (allSubmissions || []).filter(s => s.user_id === p.id);
        const approved = userWithdrawals.filter(w => w.status === 'approved').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const pending = userWithdrawals.find(w => w.status === 'pending');
        const completedToday = userSubmissionsArr.filter(s => s.status === 'approved').length;
        const pendingTasksCount = userSubmissionsArr.filter(s => s.status === 'pending').length;
        return {
          ...p,
          last_withdrawal: approved.length > 0 ? approved[0].amount : 0,
          pending_withdrawal: pending ? pending.amount : 0,
          completed_tasks: completedToday,
          pending_tasks: pendingTasksCount,
          total_tasks: totalTasks
        };
      });
      setUsers(usersWithFinance);

      toast.info('Tarefa rejeitada');
    } catch (error) {
      console.error('Reject task error:', error);
      toast.error(`Erro ao rejeitar tarefa: ${error}`);
    }
  };

  const deleteAd = async (id: string) => {
    try {
      const { error } = await supabase.from('ads').delete().eq('id', id);
      if (error) throw error;
      setAds(prev => prev.filter(a => a.id !== id));
      toast.success('Publicidade apagada');
    } catch (error) {
      toast.error('Erro ao apagar');
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase.from('support_messages').delete().eq('id', id);
      if (error) throw error;
      setSupportMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Mensagem apagada');
    } catch (error) {
      toast.error('Erro ao apagar mensagem');
    }
  };

  const replyMessage = async (msgId: string) => {
    if (!replyText.trim()) {
      toast.error('Digite uma resposta');
      return;
    }
    try {
      const { error } = await supabase
        .from('support_messages')
        .update({
          reply: replyText,
          replied_at: new Date().toISOString(),
          is_read: true
        })
        .eq('id', msgId);

      if (error) throw error;

      setSupportMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, reply: replyText, replied_at: new Date().toISOString(), is_read: true } : m
      ));
      setReplyingTo(null);
      setReplyText('');
      toast.success('Resposta enviada!');
    } catch (error) {
      toast.error('Erro ao enviar resposta');
    }
  };

  const markAsRead = async (msgId: string) => {
    const msg = supportMessages.find(m => m.id === msgId);
    if (msg && !msg.is_read) {
      try {
        await supabase
          .from('support_messages')
          .update({ is_read: true })
          .eq('id', msgId);

        setSupportMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, is_read: true } : m
        ));
        toast.success('Mensagem marcada como lida');
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }
  };

  const downloadBase64 = (data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    link.click();
  };

  const saveTasks = async () => {
    try {
      // Get only new tasks with URL filled
      const existingCount = existingTasks.length;
      const tasksToInsert = taskLinks
        .map((url, i) => ({
          title: `Tarefa ${existingCount + i + 1} - Assistir vídeo`,
          url: url || '',
          task_type: taskTypes[i] || 'video',
          required_time: taskRequiredTimes[i] || 90,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }))
        .filter(t => t.url.trim() !== '');

      if (tasksToInsert.length > 0) {
        const { error } = await supabase.from('tasks').insert(tasksToInsert);
        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
      }

      // Clear the form after successful save
      setTaskLinks(Array(taskCount).fill(''));
      toast.success('Tarefas guardadas com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Save tasks error:', error);
      toast.error('Erro ao guardar tarefas: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setExistingTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Tarefa eliminada!');
    } catch (error: any) {
      console.error('Delete task error:', error);
      toast.error('Erro ao eliminar tarefa');
    }
  };

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

  const approveWithdrawal = async (w: any) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'approved' })
        .eq('id', w.id);

      if (error) throw error;
      setWithdrawals(prev => prev.filter(x => x.id !== w.id));
      toast.success('Saque aprovado!');
    } catch (error) {
      toast.error('Erro ao aprovar saque');
    }
  };

  const rejectWithdrawal = async (w: any) => {
    try {
      // 1. Reject withdrawal
      const { error: wError } = await supabase
        .from('withdrawals')
        .update({ status: 'rejected' })
        .eq('id', w.id);

      if (wError) throw wError;

      // 2. Return funds to balance using atomic function
      const { data: success, error: rpcError } = await supabase.rpc('atomic_balance_add', {
        target_user_id: w.user_id,
        amount: w.amount,
      });

      if (rpcError) {
        console.warn('RPC error, falling back to direct update:', rpcError);
        // Fallback
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', w.user_id)
          .single();

        const currentBalance = parseFloat(profile?.balance || 0);
        const { error: balError } = await supabase
          .from('profiles')
          .update({ balance: currentBalance + w.amount })
          .eq('id', w.user_id);

        if (balError) throw balError;
      }

      setWithdrawals(prev => prev.filter(x => x.id !== w.id));
      toast.info('Saque rejeitado. Fundos devolvidos ao perfil.');
    } catch (error) {
      toast.error('Erro ao rejeitar saque');
    }
  };

  const handleLogout = async () => { await logout(); navigate('/affiliate-login'); };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: selectedUser.full_name,
          age: selectedUser.age,
          address: selectedUser.address,
          phone: selectedUser.phone,
          bank_name: selectedUser.bank_name,
          bank_account: selectedUser.bank_account,
          gender: selectedUser.gender,
          balance: parseFloat(selectedUser.balance || 0)
        })
        .eq('id', selectedUser.id);

      if (error) throw error;
      toast.success('Utilizador atualizado com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Erro ao atualizar utilizador');
    }
  };

  const handleDeleteUser = async (userToDelete?: any) => {
    const target = userToDelete || selectedUser;
    if (!target) return;

    if (!confirm(`Tem certeza que deseja eliminar o utilizador ${target.full_name || target.email}? Esta ação é irreversível e o utilizador não poderá mais fazer login.`)) return;

    try {
      setIsLoading(true);

      // Try to use RPC function to delete completely (profile + auth)
      const { error: rpcError } = await supabase.rpc('delete_user_completely', {
        target_user_id: target.id,
      });

      if (rpcError) {
        console.warn('RPC delete failed, falling back to manual delete:', rpcError);
        // Fallback: manual deletion of related data
        await supabase.from('withdrawals').delete().eq('user_id', target.id);
        await supabase.from('task_submissions').delete().eq('user_id', target.id);
        await supabase.from('opened_tasks').delete().eq('user_id', target.id);
        await supabase.from('support_messages').delete().eq('user_id', target.id);

        // Delete profile
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', target.id);

        if (error) throw error;
      }

      toast.success('Utilizador eliminado completamente!');
      if (selectedUser?.id === target.id) setSelectedUser(null);
      fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erro ao eliminar utilizador.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Changing password for:', selectedUser.id);

      // Attempt to use a custom RPC function for password change
      // The user will need to apply the SQL for this function
      const { data, error } = await supabase.rpc('admin_change_password', {
        target_user_id: selectedUser.id,
        new_password: newPassword
      });

      if (error) {
        console.error('RPC Error:', error);
        // Fallback or specific message
        if (error.message.includes('function does not exist')) {
          toast.error('Erro: Função de base de dados não encontrada. Por favor, execute o SQL fornecido.');
        } else {
          throw error;
        }
      } else {
        toast.success(`Senha para ${selectedUser.email} atualizada com sucesso!`);
        setNewPassword('');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('Erro ao processar alteração de senha. Verifique as permissões.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  const filteredAds = ads.filter(ad => {
    if (!adSearchQuery) return true;
    const q = adSearchQuery.toLowerCase();
    return (
      (ad.name || '').toLowerCase().includes(q) ||
      (ad.email || '').toLowerCase().includes(q) ||
      (ad.company || '').toLowerCase().includes(q)
    );
  });

  const menuItems = [
    { id: null as Panel, label: 'Início', icon: Home },
    { id: 'users' as Panel, label: 'Ver Utilizadores', icon: Users },
    { id: 'tasks' as Panel, label: 'Validar Tarefas', icon: CheckSquare },
    { id: 'messages' as Panel, label: 'Mensagens', icon: MessageSquare },
    { id: 'ads' as Panel, label: 'Publicidades', icon: Megaphone },
    { id: 'newTasks' as Panel, label: 'Novas Tarefas', icon: PlusCircle },
    { id: 'withdrawals' as Panel, label: 'Ordem de Saque', icon: Banknote },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="glass md:w-64 md:h-screen md:sticky md:top-0 p-4 flex md:flex-col gap-2 shrink-0">
        <div className="hidden md:block mb-6">
          <button
            onClick={() => setPanel(null)}
            className="flex items-center gap-2 hover:text-accent transition-colors"
          >
            <Home className="text-accent" size={24} />
            <div>
              <h2 className="text-lg font-bold text-gradient-accent font-display">Painel</h2>
              <p className="text-xs text-muted-foreground">Bem-Vindo Administrador</p>
            </div>
          </button>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between w-full mb-4">
          <h2 className="text-sm font-bold text-gradient-accent font-display">Painel</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileMenu(!mobileMenu)} className="text-muted-foreground p-1">
              <Menu size={20} />
            </button>
            <button onClick={handleLogout} className="text-destructive p-1">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className={`${mobileMenu ? 'flex' : 'hidden'} md:flex flex-col gap-1 w-full fixed md:relative inset-0 md:inset-auto z-40 bg-background/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none pt-16 md:pt-0 px-4 md:px-0 pb-4`}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setPanel(item.id); setSelectedUser(null); setMobileMenu(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${panel === item.id ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
            >
              <item.icon size={18} />
              <span className="hidden md:inline">{item.label}</span>
              {item.id === 'messages' && unreadMessagesCount > 0 && (
                <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">{unreadMessagesCount}</span>
              )}
              {item.id === 'ads' && ads.length > 0 && (
                <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{ads.length}</span>
              )}
              {item.id === 'tasks' && submissions.filter(s => s.status === 'pending').length > 0 && (
                <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{submissions.filter(s => s.status === 'pending').length}</span>
              )}
              {item.id === 'withdrawals' && withdrawals.filter(w => w.status === 'pending').length > 0 && (
                <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{withdrawals.filter(w => w.status === 'pending').length}</span>
              )}
            </button>
          ))}
          <div className="hidden md:block mt-auto">
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors w-full">
              <LogOut size={18} /> Sair
            </button>
          </div>
          {/* Mobile Logout - inside menu */}
          <button onClick={handleLogout} className="md:hidden flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors w-full mt-auto">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 overflow-auto md:pt-4 pt-16">
        {!panel && (
          <div className="space-y-6">
            {/* Stats Summary - Modern List */}
            <div className="glass rounded-xl p-4 border border-border/50">
              <div className="flex items-center justify-between overflow-x-auto gap-6 py-2">
                <div className="flex items-center gap-3 min-w-fit">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Users className="text-cyan-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Utilizadores</p>
                    <p className="text-xl font-bold text-cyan-400">{users.length}</p>
                  </div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex items-center gap-3 min-w-fit">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Banknote className="text-orange-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saques Pend.</p>
                    <p className="text-xl font-bold text-orange-400">
                      {withdrawals.filter(w => w.status === 'pending').length}
                      <span className="text-xs ml-1 text-orange-400/70">
                        ({withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0).toFixed(0)} Kz)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex items-center gap-3 min-w-fit">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckSquare className="text-green-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tarefas Pend.</p>
                    <p className="text-xl font-bold text-green-400">{submissions.filter(s => s.status === 'pending').length}</p>
                  </div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex items-center gap-3 min-w-fit">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <FileText className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tarefas</p>
                    <p className="text-xl font-bold text-blue-400">{taskCount}</p>
                  </div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex items-center gap-3 min-w-fit">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Megaphone className="text-purple-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Anúncios</p>
                    <p className="text-xl font-bold text-purple-400">{ads.length}</p>
                  </div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex items-center gap-3 min-w-fit">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                    <MessageSquare className="text-pink-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mensagens</p>
                    <p className="text-xl font-bold text-pink-400">{unreadMessagesCount > 0 ? unreadMessagesCount : '0'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <button onClick={() => setPanel('users')} className="p-4 rounded-xl bg-secondary/30 border border-secondary hover:bg-secondary/50 transition-colors text-left">
                <Users className="text-primary mb-2" size={24} />
                <p className="font-medium text-foreground">Gerir Utilizadores</p>
                <p className="text-xs text-muted-foreground">Ver e editar afiliados</p>
              </button>
              <button onClick={() => setPanel('tasks')} className="p-4 rounded-xl bg-secondary/30 border border-secondary hover:bg-secondary/50 transition-colors text-left">
                <CheckSquare className="text-green-500 mb-2" size={24} />
                <p className="font-medium text-foreground">Validar Tarefas</p>
                <p className="text-xs text-muted-foreground">{submissions.filter(s => s.status === 'pending').length} pendentes</p>
              </button>
              <button onClick={() => setPanel('messages')} className="p-4 rounded-xl bg-secondary/30 border border-secondary hover:bg-secondary/50 transition-colors text-left">
                <MessageSquare className="text-pink-500 mb-2" size={24} />
                <p className="font-medium text-foreground">Mensagens</p>
                <p className="text-xs text-muted-foreground">{unreadMessagesCount > 0 ? `${unreadMessagesCount} nova(s)` : '0 mensagens'}</p>
              </button>
              <button onClick={() => setPanel('withdrawals')} className="p-4 rounded-xl bg-secondary/30 border border-secondary hover:bg-secondary/50 transition-colors text-left">
                <Banknote className="text-orange-500 mb-2" size={24} />
                <p className="font-medium text-foreground">Saques</p>
                <p className="text-xs text-muted-foreground">{withdrawals.filter(w => w.status === 'pending').length} pendentes</p>
              </button>
              <button onClick={() => setPanel('ads')} className="p-4 rounded-xl bg-secondary/30 border border-secondary hover:bg-secondary/50 transition-colors text-left">
                <Megaphone className="text-purple-500 mb-2" size={24} />
                <p className="font-medium text-foreground">Publicidades</p>
                <p className="text-xs text-muted-foreground">Gerir anúncios</p>
              </button>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Users Chart - Line Chart showing daily registrations */}
              <div className="glass rounded-xl p-6 border border-border/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Utilizadores</h3>
                  {userRegistrations.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400">
                      Pico: {Math.max(...userRegistrations.map(d => d.count))}
                    </span>
                  )}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userRegistrations}>
                      <defs>
                        <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value: number) => [`${value} registos`, 'Total']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#22d3ee', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center mt-2 text-2xl font-bold text-cyan-400">
                  {users.length}
                </p>
              </div>

              {/* Tasks Chart - Line Chart showing daily submissions */}
              <div className="glass rounded-xl p-6 border border-border/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Tarefas</h3>
                  {taskRegistrations.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                      Pico: {Math.max(...taskRegistrations.map(d => d.count))}
                    </span>
                  )}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={taskRegistrations}>
                      <defs>
                        <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value: number) => [`${value} submissões`, 'Total']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#a855f7"
                        strokeWidth={3}
                        dot={{ fill: '#a855f7', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#c084fc', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center mt-2 text-2xl font-bold text-purple-400">
                  {taskCount}
                </p>
              </div>

              {/* Submissions Chart - Modern donut style */}
              <div className="glass rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold mb-4">Submissões</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="subGlowGreen">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="subGlowYellow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="subGlowRed">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <Pie
                        data={[
                          { name: 'Aprovadas', value: submissions.filter(s => s.status === 'approved').length },
                          { name: 'Pendentes', value: submissions.filter(s => s.status === 'pending').length },
                          { name: 'Rejeitadas', value: submissions.filter(s => s.status === 'rejected').length },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell
                          fill="#10b981"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' }}
                        />
                        <Cell
                          fill="#f59e0b"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))' }}
                        />
                        <Cell
                          fill="#ef4444"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }}
                        />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center mt-2 text-2xl font-bold text-green-400">
                  {submissions.length}
                </p>
              </div>

              {/* Withdrawals Chart - Modern donut style */}
              <div className="glass rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold mb-4">Saques</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="withGlowYellow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="withGlowGreen">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <filter id="withGlowRed">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <Pie
                        data={[
                          { name: 'Pendentes', value: withdrawals.filter(w => w.status === 'pending').length },
                          { name: 'Aprovados', value: withdrawals.filter(w => w.status === 'approved').length },
                          { name: 'Rejeitados', value: withdrawals.filter(w => w.status === 'rejected').length },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell
                          fill="#f59e0b"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))' }}
                        />
                        <Cell
                          fill="#10b981"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' }}
                        />
                        <Cell
                          fill="#ef4444"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }}
                        />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center mt-2 text-2xl font-bold text-orange-400">
                  {withdrawals.length}
                </p>
              </div>

              {/* Ads Chart - Line Chart showing daily ads */}
              <div className="glass rounded-xl p-6 border border-border/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Publicidades</h3>
                  {adsRegistrations.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-pink-500/20 text-pink-400">
                      Pico: {Math.max(...adsRegistrations.map(d => d.count))}
                    </span>
                  )}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={adsRegistrations}>
                      <defs>
                        <linearGradient id="adsLineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value: number) => [`${value} anúncios`, 'Total']}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#ec4899"
                        strokeWidth={3}
                        dot={{ fill: '#ec4899', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#f472b6', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center mt-2 text-2xl font-bold text-pink-400">
                  {ads.length}
                </p>
              </div>

              {/* Messages Chart - Modern donut style */}
              <div className="glass rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold mb-4">Mensagens</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <Pie
                        data={[
                          { name: 'Não lidas', value: unreadMessagesCount },
                          { name: 'Lidas', value: supportMessages.length - unreadMessagesCount },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell
                          fill="#ef4444"
                          filter="url(#glow)"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }}
                        />
                        <Cell
                          fill="#4b5563"
                          style={{ filter: 'drop-shadow(0 0 4px rgba(75, 85, 99, 0.4))' }}
                        />
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center mt-2 text-2xl font-bold text-gray-400">
                  {supportMessages.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-muted-foreground animate-pulse">A carregar dados...</p>
            </div>
          </div>
        )}

        {/* USERS */}
        {panel === 'users' && !selectedUser && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-4 font-display">Utilizadores Registados ({users.length})</h2>
            <div className="relative mb-4 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, email ou telefone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-secondary/50 pl-10"
              />
            </div>
            <div className="space-y-2">
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={async () => {
                    setSelectedUser(u);
                    // Fetch user submissions
                    const { data: subs } = await supabase
                      .from('task_submissions')
                      .select('*, tasks(title)')
                      .eq('user_id', u.id)
                      .order('created_at', { ascending: false });
                    if (subs) setUserSubmissions(subs);
                  }}
                  className="w-full glass rounded-xl p-4 text-left border border-white/5 hover:border-primary/50 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-foreground text-lg">{u.full_name || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">Saldo: {parseFloat(u.balance || 0).toFixed(2)} Kz</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-white/5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Telefone</p>
                      <p className="text-xs font-medium">{u.phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Último Saque</p>
                      <p className="text-xs font-medium text-green-500">{parseFloat(u.last_withdrawal || 0).toFixed(2)} Kz</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saque Pendente</p>
                      <p className="text-xs font-medium text-orange-400">{parseFloat(u.pending_withdrawal || 0).toFixed(2)} Kz</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tarefas Hoje</p>
                      <p className="text-xs font-medium">{u.completed_tasks || 0}/{u.total_tasks || 0} <span className="text-muted-foreground">(pend: {u.pending_tasks || 0})</span></p>
                    </div>
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && !isLoading && <p className="text-muted-foreground">Nenhum utilizador encontrado</p>}
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
                <label className="text-sm text-muted-foreground">Nome Completo</label>
                <Input
                  value={selectedUser.full_name || ''}
                  onChange={e => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                  className="bg-secondary/30"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email (Não editável)</label>
                <Input value={selectedUser.email || ''} readOnly className="bg-secondary/30 opacity-60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Idade</label>
                  <Input
                    value={selectedUser.age || ''}
                    onChange={e => setSelectedUser({ ...selectedUser, age: e.target.value })}
                    className="bg-secondary/30"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Género</label>
                  <select
                    value={selectedUser.gender || ''}
                    onChange={e => setSelectedUser({ ...selectedUser, gender: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">N/A</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Morada</label>
                <Input
                  value={selectedUser.address || ''}
                  onChange={e => setSelectedUser({ ...selectedUser, address: e.target.value })}
                  className="bg-secondary/30"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Telefone</label>
                <Input
                  value={selectedUser.phone || ''}
                  onChange={e => setSelectedUser({ ...selectedUser, phone: e.target.value })}
                  className="bg-secondary/30"
                />
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold text-primary mb-2">Dados Bancários e Saldo</p>
                  <div className="space-y-2">
                    <Input
                      placeholder="Banco"
                      value={selectedUser.bank_name || ''}
                      onChange={e => setSelectedUser({ ...selectedUser, bank_name: e.target.value })}
                      className="bg-secondary/30 h-8 text-sm"
                    />
                    <Input
                      placeholder="IBAN/Conta"
                      value={selectedUser.bank_account || ''}
                      onChange={e => setSelectedUser({ ...selectedUser, bank_account: e.target.value })}
                      className="bg-secondary/30 h-8 text-sm"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-bold whitespace-nowrap">Saldo (Kz):</span>
                      <Input
                        type="number"
                        value={selectedUser.balance || 0}
                        onChange={e => setSelectedUser({ ...selectedUser, balance: e.target.value })}
                        className="bg-secondary/30 h-8 font-bold text-primary"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-secondary/20 p-4 rounded-xl space-y-2">
                  <p className="text-sm font-bold text-foreground">Resumo Financeiro</p>
                  <div className="flex justify-between items-center bg-green-500/10 p-2 rounded-lg">
                    <span className="text-xs text-muted-foreground">Último Saque</span>
                    <span className="text-sm font-bold text-green-500">{parseFloat(selectedUser.last_withdrawal || 0).toFixed(2)} Kz</span>
                  </div>
                  <div className="flex justify-between items-center bg-orange-500/10 p-2 rounded-lg">
                    <span className="text-xs text-muted-foreground">Saque Pendente</span>
                    <span className="text-sm font-bold text-orange-400">{parseFloat(selectedUser.pending_withdrawal || 0).toFixed(2)} Kz</span>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm font-bold text-foreground mb-2">Segurança</p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="Nova senha (min. 6 carateres)"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="bg-secondary/30 h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={handlePasswordChange}
                        disabled={!newPassword || isLoading}
                        className="h-8 text-xs bg-primary/20 hover:bg-primary/40 text-primary border border-primary/30"
                      >
                        Alterar Senha
                      </Button>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">Isso alterará a senha do utilizador instantaneamente.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <Button onClick={handleUpdateUser} className="flex-1 btn-glow-primary !rounded-xl">
                  Salvar Alterações
                </Button>
                <Button onClick={() => handleDeleteUser()} variant="destructive" className="!rounded-xl gap-2 font-bold">
                  <Trash2 size={18} />
                  Eliminar Utilizador
                </Button>
              </div>

              {/* User Submissions Section */}
              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-sm font-bold text-primary mb-3">Tarefas do Utilizador</p>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {userSubmissions.length > 0 ? (
                    userSubmissions.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between bg-secondary/20 p-3 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sub.tasks?.title || `Tarefa ${sub.task_id}`}</p>
                          <p className="text-xs text-muted-foreground">{new Date(sub.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sub.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          sub.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                          {sub.status === 'approved' ? '✓ Concluída' : sub.status === 'rejected' ? '✗ Rejeitada' : '⏳ Pendente'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Este utilizador ainda não enviou nenhuma tarefa.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VALIDATE TASKS */}
        {panel === 'tasks' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Validar Tarefas ({submissions.filter(s => s.status === 'pending').length} pendentes)</h2>
            <div className="space-y-4">
              {submissions.filter(sub => !processedTaskIds.current.includes(sub.id)).map(sub => (
                <div key={sub.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start gap-4">
                    {sub.screenshot_url && (
                      <div className="shrink-0">
                        <img
                          src={sub.screenshot_url}
                          alt="Captura"
                          className="w-32 h-24 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewFile({
                            data: sub.screenshot_url,
                            title: `Captura de ${sub.profiles?.full_name || sub.profiles?.email}`,
                            extractedCode: sub.ocr_extracted_code || sub.unique_comment_code,
                            fraudAlert: sub.fraud_alert
                          })}
                        />
                        <button
                          onClick={() => window.open(sub.screenshot_url, '_blank')}
                          className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                        >
                          <Eye size={12} /> Abrir imagem
                        </button>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{sub.profiles?.full_name || sub.profiles?.email}</p>
                      <p className="text-sm text-muted-foreground">Email: {sub.profiles?.email}</p>
                      <p className="text-sm text-muted-foreground">ID Tarefa: {sub.task_id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(sub.created_at).toLocaleString()}</p>

                      {/* Fraud Detection Info - Only show for video tasks */}
                      {(sub.tasks?.task_type === 'video' || sub.unique_comment_code) && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                          {/* OCR Processing Indicator */}
                          {processingOCR[sub.id] && (
                            <div className="flex items-center gap-2 text-blue-400 text-xs mb-2">
                              <Loader2 size={12} className="animate-spin" />
                              Analisando captura...
                            </div>
                          )}

                          {/* Code comparison */}
                          {sub.unique_comment_code && (
                            <p className="text-xs text-muted-foreground mb-1">
                              <span className="font-medium">Código esperado:</span> {sub.unique_comment_code}
                            </p>
                          )}
                          {sub.ocr_extracted_code && (
                            <p className="text-xs text-muted-foreground mb-1">
                              <span className="font-medium">Código detectado:</span>{' '}
                              <span className={sub.fraudAlert === 'confiavel' ? 'text-green-400 font-mono' : 'text-red-400 font-mono'}>
                                {sub.ocr_extracted_code}
                              </span>
                            </p>
                          )}

                          {/* Risk Score */}
                          {sub.risk_score > 0 && (
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${sub.risk_score >= 70 ? 'bg-red-500/20 text-red-400' :
                              sub.risk_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                              <AlertTriangle size={12} />
                              Risco: {sub.risk_score}%
                            </div>
                          )}

                          {/* Fraud Alert Status */}
                          {sub.fraud_alert && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ml-2 ${sub.fraud_alert === 'suspeita' ? 'bg-red-500/20 text-red-400' :
                              'bg-green-500/20 text-green-400'
                              }`}>
                              {sub.fraud_alert === 'suspeita' ? '🔴 SUSPEITA' : '🟢 CONFIÁVEL'}
                            </span>
                          )}

                          {/* Watch Time */}
                          {sub.watched_time && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ⏱ Tempo assistido: {Math.floor(sub.watched_time / 60)}:{(sub.watched_time % 60).toString().padStart(2, '0')}
                            </p>
                          )}

                          {/* Unique Code */}
                          {sub.unique_comment_code && (
                            <p className="text-xs mt-1">
                              <span className="text-muted-foreground">Código:</span>{' '}
                              <span className="font-mono text-purple-400">{sub.unique_comment_code}</span>
                            </p>
                          )}

                          {/* OCR Extracted Code */}
                          {sub.ocr_extracted_code && (
                            <p className="text-xs mt-1">
                              <span className="text-muted-foreground">OCR detectado:</span>{' '}
                              <span className="font-mono">{sub.ocr_extracted_code}</span>
                              {sub.ocr_confidence && (
                                <span className="text-muted-foreground ml-1">
                                  ({(sub.ocr_confidence * 100).toFixed(0)}%)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
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
              {submissions.length === 0 && !isLoading && <p className="text-muted-foreground">Nenhuma tarefa pendente</p>}
            </div>
          </div>
        )}

        {/* ADS */}
        {panel === 'ads' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-4 font-display">Publicidades Recebidas ({filteredAds.length})</h2>
            <div className="mb-6">
              <Input
                type="text"
                placeholder="Pesquisar por nome ou email..."
                value={adSearchQuery}
                onChange={(e) => setAdSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <div className="space-y-4">
              {filteredAds.map(ad => (
                <div key={ad.id} className="glass rounded-2xl p-6">
                  <div className="grid gap-2 text-sm">
                    {[
                      { label: 'Nome', value: ad.name },
                      { label: 'Empresa', value: ad.company },
                      { label: 'Email', value: ad.email },
                      { label: 'Detalhes', value: ad.details },
                      { label: 'Banco', value: ad.bank },
                      { label: 'Plano', value: ad.plan || 'N/A' },
                      { label: 'Data', value: new Date(ad.date).toLocaleString() },
                    ].map(item => (
                      <p key={item.label}><span className="text-muted-foreground">{item.label}:</span> <span className="text-foreground">{item.value}</span></p>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {ad.file_data && (
                      <>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => downloadBase64(ad.file_data, 'publicidade.jpg')}>
                          <Download size={14} className="mr-1" /> Baixar Publicidade
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreviewFile({ data: ad.file_data, title: 'Arquivo de Publicidade' })}>
                          <Eye size={14} className="mr-1" /> Ver Publicidade
                        </Button>
                      </>
                    )}
                    {ad.receipt_data && (
                      <>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => downloadBase64(ad.receipt_data, 'comprovativo.jpg')}>
                          <Download size={14} className="mr-1" /> Baixar Comprovativo
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setPreviewFile({ data: ad.receipt_data, title: 'Comprovativo de Pagamento' })}>
                          <Eye size={14} className="mr-1" /> Ver Comprovativo
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteAd(ad.id)} className="text-xs">
                      <Trash2 size={14} className="mr-1" /> Apagar
                    </Button>
                  </div>
                </div>
              ))}
              {filteredAds.length === 0 && !isLoading && (
                <p className="text-muted-foreground">
                  {adSearchQuery ? 'Nenhuma publicidade encontrada' : 'Nenhuma publicidade recebida'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* MESSAGES - Support Messages */}
        {panel === 'messages' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Mensagens de Suporte ({unreadMessagesCount > 0 ? `${unreadMessagesCount} nova(s)` : 'Todas vistas'})</h2>
            <div className="space-y-4">
              {supportMessages.map(msg => (
                <div key={msg.id} className={`glass rounded-2xl p-6 ${!msg.is_read ? 'border-l-4 border-l-yellow-500' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground">{msg.name}</p>
                        {msg.user_id && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Afiliado</span>
                        )}
                        {!msg.user_id && (
                          <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded">Visitante</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{msg.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                    {!msg.is_read && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                        Nova
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Assunto:</span> <span className="text-foreground">{msg.subject}</span></p>
                    <div className="bg-secondary/30 p-3 rounded-lg mt-2">
                      <p className="text-foreground whitespace-pre-wrap">{msg.message}</p>
                    </div>

                    {/* Reply Section */}
                    {msg.reply && (
                      <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg mt-2">
                        <p className="text-xs text-green-400 font-bold mb-1">Resposta do Suporte:</p>
                        <p className="text-foreground whitespace-pre-wrap text-sm">{msg.reply}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {msg.replied_at && new Date(msg.replied_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {msg.user_id ? (
                      replyingTo === msg.id ? (
                        <div className="flex-1 space-y-2">
                          <Textarea
                            placeholder="Digite a sua resposta..."
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            className="text-xs"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => replyMessage(msg.id)} className="text-xs bg-green-600 hover:bg-green-700">
                              Enviar Resposta
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-xs">
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => { markAsRead(msg.id); setReplyingTo(msg.id); }}
                        >
                          <MessageSquare size={14} className="mr-1" /> Responder
                        </Button>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs opacity-50"
                        disabled
                        title="Só pode responder a mensagens de afiliados"
                      >
                        <MessageSquare size={14} className="mr-1" /> Responder
                      </Button>
                    )}
                    {!msg.is_read && (
                      <Button size="sm" variant="secondary" onClick={() => markAsRead(msg.id)} className="text-xs">
                        <Check size={14} className="mr-1" /> Marcar como lida
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteMessage(msg.id)} className="text-xs">
                      <Trash2 size={14} className="mr-1" /> Apagar
                    </Button>
                  </div>
                </div>
              ))}
              {supportMessages.length === 0 && !isLoading && <p className="text-muted-foreground">Nenhuma mensagem de suporte recebida</p>}
            </div>
          </div>
        )}

        {/* NEW TASKS */}
        {panel === 'newTasks' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-2 font-display">Configurar Tarefas</h2>
            <p className="text-muted-foreground mb-6">Defina o número de tarefas e os respetivos links do YouTube.</p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Form to add new tasks */}
              <div className="glass rounded-2xl p-6 space-y-6">
                <div>
                  <label className="text-sm font-bold text-foreground mb-2 block">Número de Tarefas</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={taskCount}
                      onChange={e => {
                        const count = Math.max(1, parseInt(e.target.value) || 1);
                        setTaskCount(count);
                      }}
                      className="bg-secondary/50 w-24"
                    />
                    <Button variant="outline" onClick={() => {
                      const newLinks = Array(taskCount).fill('');
                      taskLinks.forEach((link, i) => { if (i < taskCount) newLinks[i] = link; });
                      setTaskLinks(newLinks);
                      toast.info(`Campos ajustados para ${taskCount} tarefas.`);
                    }}>
                      Ajustar Campos
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-auto pr-2">
                  {taskLinks.map((link, i) => (
                    <div key={i} className="space-y-2 p-3 bg-secondary/30 rounded-lg">
                      <label className="text-xs text-muted-foreground mb-1 block">Link da Tarefa {i + 1}</label>
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={link}
                        onChange={e => {
                          const newLinks = [...taskLinks];
                          newLinks[i] = e.target.value;
                          setTaskLinks(newLinks);
                        }}
                        className="bg-secondary/50"
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                          <select
                            value={taskTypes[i]}
                            onChange={e => {
                              const newTypes = [...taskTypes];
                              newTypes[i] = e.target.value;
                              setTaskTypes(newTypes);
                            }}
                            className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="video">Vídeo YouTube</option>
                            <option value="link">Link Normal</option>
                          </select>
                        </div>
                        {taskTypes[i] === 'video' && (
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Tempo (seg)</label>
                            <Input
                              type="number"
                              min={30}
                              max={600}
                              value={taskRequiredTimes[i]}
                              onChange={e => {
                                const newTimes = [...taskRequiredTimes];
                                newTimes[i] = parseInt(e.target.value) || 90;
                                setTaskRequiredTimes(newTimes);
                              }}
                              className="bg-secondary/50"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={saveTasks} className="w-full btn-glow-accent !rounded-xl">Guardar Novas Tarefas</Button>
              </div>

              {/* Existing tasks list */}
              <div className="glass rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-foreground">Tarefas Registadas ({existingTasks.length})</h3>
                {existingTasks.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma tarefa registada.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-auto pr-2">
                    {existingTasks.map((task, i) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground truncate">{task.title || `Tarefa ${i + 1}`}</p>
                            <span className="text-xs text-orange-400 font-medium shrink-0 ml-2">
                              ⏱ {getRemainingTime(task.expires_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${task.task_type === 'video' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {task.task_type === 'video' ? '🎬 Vídeo' : '🔗 Link'}
                            </span>
                            {task.task_type === 'video' && task.required_time && (
                              <span className="text-xs text-muted-foreground">
                                {task.required_time}s mínimo
                              </span>
                            )}
                          </div>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline truncate block"
                          >
                            {task.url}
                          </a>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WITHDRAWALS */}
        {panel === 'withdrawals' && (
          <div>
            <button onClick={() => setPanel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-4 text-sm">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h2 className="text-2xl font-bold mb-6 font-display">Pedidos de Saque ({withdrawals.filter(w => w.status === 'pending').length} pendentes)</h2>
            <div className="space-y-4">
              {withdrawals.map(w => (
                <div key={w.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{w.profiles?.full_name || w.profiles?.email}</p>
                      <p className="text-sm text-muted-foreground">Email: {w.profiles?.email}</p>
                      <p className="text-sm text-foreground font-bold">{parseFloat(w.amount || 0).toFixed(2)} Kz</p>
                      <p className="text-xs text-muted-foreground">Conta/IBAN: {w.bank_account}</p>
                      <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveWithdrawal(w)} className="bg-green-600 hover:bg-green-700">
                        <Check size={16} />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectWithdrawal(w)}>
                        <X size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {withdrawals.length === 0 && !isLoading && <p className="text-muted-foreground">Nenhum pedido de saque pendente</p>}
            </div>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto my-4 glass rounded-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-foreground truncate max-w-[70%]">{previewFile.title}</h3>
                {previewFile.fraudAlert && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${previewFile.fraudAlert === 'suspeita' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {previewFile.fraudAlert === 'suspeita' ? '🔴 SUSPEITA' : '🟢 CONFIÁVEL'}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setPreviewFile(null)} className="gap-2">
                <ArrowLeft size={16} /> Voltar
              </Button>
            </div>
            {previewFile.extractedCode && (
              <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/30">
                <p className="text-sm text-purple-300">
                  <span className="font-semibold">Código encontrado:</span> {previewFile.extractedCode}
                </p>
              </div>
            )}
            <div className="flex-1 bg-black/20 flex items-center justify-center overflow-auto p-4">
              {previewFile.data.startsWith('data:image/') ? (
                <img src={previewFile.data} alt="Preview" className="max-w-full max-h-full object-contain shadow-2xl" />
              ) : (
                <iframe src={previewFile.data} title="Document Preview" className="w-full h-full rounded-lg bg-white" />
              )}
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setPreviewFile(null)} />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
