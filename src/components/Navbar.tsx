import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: '/about', label: 'Sobre' },
    { to: '/support', label: 'Suporte Técnico' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold tracking-tight font-display">
            <span className="text-gradient-primary">Fv-Comércio</span>
            <span className="text-muted-foreground"> & Serviços</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === link.to ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/advertise" className="btn-glow-accent text-sm !px-4 !py-2 !rounded-lg">
              Publicite Aqui
            </Link>
            <Link to="/affiliate-login" className="btn-glow-primary text-sm !px-4 !py-2 !rounded-lg">
              Afiliados
            </Link>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-foreground">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden pb-4 space-y-2 animate-in slide-in-from-top-2">
            {links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link to="/advertise" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium text-accent">
              Publicite Aqui
            </Link>
            <Link to="/affiliate-login" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium text-primary">
              Afiliados
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
