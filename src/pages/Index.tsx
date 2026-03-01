import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Megaphone, Youtube, Zap } from 'lucide-react';

const plans = [
  {
    title: 'Publicitar no nosso canal',
    description: 'Aqui nós publicitamos o seu negócio no nosso canal oficial com nossas propagandas',
    price: '15.000 Kz',
    icon: Megaphone,
    gradient: 'from-primary/20 to-primary/5',
    border: 'border-primary/30',
    iconColor: 'text-primary',
  },
  {
    title: 'Publicitar o seu canal',
    description: 'Podes publicitar o seu canal do youtube até 30 dias utéis',
    price: '10.000 Kz',
    icon: Youtube,
    gradient: 'from-accent/20 to-accent/5',
    border: 'border-accent/30',
    iconColor: 'text-accent',
  },
  {
    title: 'Pacote Plus Ultra',
    description: 'Pacote completo de publicidades para todas as redes sociais com o prazo de 1 mês',
    price: '30.000 Kz',
    icon: Zap,
    gradient: 'from-yellow-500/20 to-yellow-500/5',
    border: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
  },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-muted-foreground">
            🚀 Plataforma de Marketing Digital em Angola
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight font-display">
            <span className="text-gradient-primary">Fv-Comércio</span>
            <br />
            <span className="text-foreground">& Serviços</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            A sua plataforma de marketing digital e afiliados. Alcance novos clientes e ganhe dinheiro promovendo produtos.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
            <Link to="/advertise" className="btn-glow-accent text-lg">
              Publicite Aqui
            </Link>
            <Link to="/affiliate-login" className="btn-glow-primary text-lg">
              Afiliados
            </Link>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="relative px-4 pb-24 -mt-20 z-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 font-display text-foreground">
            Escolha o seu plano de publicidade
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Selecione o plano ideal para impulsionar o seu negócio
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.title}
                className={`glass rounded-2xl p-8 border ${plan.border} bg-gradient-to-br ${plan.gradient} hover:scale-105 transition-transform duration-300 flex flex-col`}
              >
                <div className={`w-14 h-14 rounded-xl bg-background/50 flex items-center justify-center mb-6 ${plan.iconColor}`}>
                  <plan.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 font-display">{plan.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-6">{plan.description}</p>
                <div className="border-t border-border/50 pt-4">
                  <p className="text-3xl font-bold text-foreground font-display">{plan.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
