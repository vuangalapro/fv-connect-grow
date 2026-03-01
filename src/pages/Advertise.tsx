import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const bankIbans: Record<string, string> = {
  BAI: 'AO06.0040.0000.2735.1578.1014.2',
  'Banco Atlântico': 'AO06.0055.0000.3287.2261.1013.5',
};

const banks = ['BAI', 'BFA', 'BCI', 'Banco Sol', 'BPC', 'BIC', 'Banco Atlântico'];

const adPlans = [
  { value: 'canal-nosso', label: 'Publicitar no nosso canal - 15.000Kz' },
  { value: 'canal-seu', label: 'Publicitar o seu canal - 10.000Kz' },
  { value: 'plus-ultra', label: 'Pacote Plus Ultra - 30.000Kz' },
];

const Advertise = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', company: '', email: '', details: '', file: null as File | null });
  const [bank, setBank] = useState('');
  const [plan, setPlan] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async () => {
    if (!bank) { toast.error('Selecione um banco'); return; }
    if (!plan) { toast.error('Selecione um plano'); return; }

    let fileData = '';
    let receiptData = '';
    if (form.file) fileData = await toBase64(form.file);
    if (receipt) receiptData = await toBase64(receipt);

    const ads = JSON.parse(localStorage.getItem('fv_ads') || '[]');
    ads.push({
      id: crypto.randomUUID(),
      name: form.name,
      company: form.company,
      email: form.email,
      details: form.details,
      fileName: form.file?.name || '',
      fileData,
      bank,
      plan: adPlans.find(p => p.value === plan)?.label || plan,
      receiptName: receipt?.name || '',
      receiptData,
      date: new Date().toISOString(),
    });
    localStorage.setItem('fv_ads', JSON.stringify(ads));
    toast.success('Pagamento registado com sucesso! A equipe irá analisar.');
    setStep(1);
    setForm({ name: '', company: '', email: '', details: '', file: null });
    setBank('');
    setPlan('');
    setReceipt(null);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gradient-accent font-display">Publicite Aqui</h1>

        {step === 1 ? (
          <div className="glass rounded-2xl p-8 space-y-4">
            <Input placeholder="Digite seu nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="bg-secondary/50" />
            <Input placeholder="Digite o nome da sua empresa" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} required className="bg-secondary/50" />
            <Input type="email" placeholder="Inserir email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="bg-secondary/50" />
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Inserir arquivo para publicidade</label>
              <Input type="file" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} className="bg-secondary/50" />
            </div>
            <Textarea placeholder="Escreva detalhes adicionais" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} rows={4} className="bg-secondary/50" />
            <Button
              onClick={() => {
                if (!form.name || !form.email) { toast.error('Preencha os campos obrigatórios'); return; }
                setStep(2);
              }}
              className="w-full btn-glow-accent !rounded-xl"
            >
              Próximo Passo
            </Button>
          </div>
        ) : (
          <div className="glass rounded-2xl p-8 space-y-6">
            <button onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
              <ArrowLeft size={14} /> Voltar
            </button>
            <h2 className="text-2xl font-bold text-foreground font-display">Efetuar Pagamento</h2>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Escolha o seu banco</label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bank && bankIbans[bank] && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                <p className="text-sm text-foreground">
                  Efectuar a transferência bancária com o mesmo banco:
                </p>
                <p className="font-mono font-bold text-primary mt-1">IBAN {bankIbans[bank]}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Escolha o plano de publicidade</label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {adPlans.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Envie seu comprovativo</label>
              <Input type="file" onChange={e => setReceipt(e.target.files?.[0] || null)} className="bg-secondary/50" />
            </div>

            <Button onClick={handleSubmit} className="w-full btn-glow-primary !rounded-xl">
              Efetuar Pagamento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Advertise;
