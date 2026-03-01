import Navbar from '@/components/Navbar';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft size={18} /> Voltar
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold mb-8 text-gradient-primary font-display">Sobre Nós</h1>

        <div className="space-y-8">
          <div className="glass rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground font-display">Fv-Comércio & Serviços</h2>
            <p className="text-muted-foreground leading-relaxed">
              Somos uma empresa de marketing digital focada em conectar empresas a afiliados qualificados.
              A nossa missão é democratizar o acesso ao marketing digital em Angola, oferecendo uma plataforma
              acessível e eficiente para todos.
            </p>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground font-display">Nossa Missão</h2>
            <p className="text-muted-foreground leading-relaxed">
              Empoderar empresas e empreendedores angolanos através de soluções inovadoras de marketing digital,
              criando oportunidades de rendimento para afiliados e visibilidade para marcas.
            </p>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground font-display">Nossos Desafios</h2>
            <ul className="space-y-3 text-muted-foreground">
              {[
                'Expandir o acesso ao marketing digital em todo o território angolano',
                'Formar uma rede sólida de afiliados comprometidos e qualificados',
                'Garantir transparência e confiança nas transações entre empresas e afiliados',
                'Inovar continuamente para acompanhar as tendências globais de marketing digital',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground font-display">Nossa Visão</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ser a principal plataforma de marketing digital e afiliados em Angola,
              reconhecida pela inovação, qualidade de serviço e impacto positivo na economia digital do país.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
