import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'philipvuangala@gmail.com';

const Support = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Try to get user
      const { data: { user } } = await supabase.auth.getUser();

      // Always try to insert to database first
      if (user) {
        // Logged in user - submit to database
        const { error: dbError } = await supabase.from('support_messages').insert({
          user_id: user.id,
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
        });

        if (!dbError) {
          toast.success('Mensagem enviada com sucesso! O nosso suporte entrará em contacto em breve.');
          setForm({ name: '', email: '', subject: '', message: '' });
          return;
        }
        
        console.warn('Database submission failed:', dbError);
      } else {
        // User not logged in - try to insert with null user_id
        const { error: dbError } = await supabase.from('support_messages').insert({
          user_id: null,
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
        });

        if (!dbError) {
          toast.success('Mensagem enviada com sucesso! O nosso suporte entrará em contacto em breve.');
          setForm({ name: '', email: '', subject: '', message: '' });
          return;
        }
        
        console.warn('Database submission failed:', dbError);
      }
    } catch (err) {
      console.warn('Error submitting to database:', err);
    }

    // Fallback: open email client
    const emailSubject = encodeURIComponent(`Suporte Fv-Comércio: ${form.subject}`);
    const emailBody = encodeURIComponent(
      `Nome: ${form.name}\n` +
      `Email: ${form.email}\n` +
      `\n` +
      `Mensagem:\n${form.message}`
    );

    window.open(`mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`);
    toast.success('A abrir o seu cliente de email...');
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gradient-primary font-display">Suporte Técnico</h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="glass rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-6 text-foreground font-display">Entre em contacto</h2>
              <div className="space-y-4">
                <a
                  href="https://wa.me/244925833661"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 transition-colors"
                >
                  <MessageCircle className="text-green-400" size={24} />
                  <div>
                    <p className="font-semibold text-foreground">WhatsApp</p>
                    <p className="text-sm text-muted-foreground">+244 925 833 661</p>
                  </div>
                </a>
                <a
                  href="https://t.me/Philip0024"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                >
                  <Send className="text-blue-400" size={24} />
                  <div>
                    <p className="font-semibold text-foreground">Telegram</p>
                    <p className="text-sm text-muted-foreground">@Philip0024</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-6 text-foreground font-display">Envie uma mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="Nome Completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="bg-secondary/50 border-border" />
              <Input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="bg-secondary/50 border-border" />
              <Input placeholder="Assunto" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required className="bg-secondary/50 border-border" />
              <Textarea placeholder="Escreva sua mensagem" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required rows={4} className="bg-secondary/50 border-border" />
              <Button type="submit" className="w-full btn-glow-primary !rounded-xl">Enviar</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
