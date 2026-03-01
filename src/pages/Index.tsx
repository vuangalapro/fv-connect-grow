import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';

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
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link to="/advertise" className="btn-glow-accent text-lg">
              Publicite Aqui
            </Link>
            <Link to="/affiliate-login" className="btn-glow-primary text-lg">
              Afiliados
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
