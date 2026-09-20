import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles, BookOpen, Compass, Brain, Clock, Globe, ArrowRight,
  Send, GraduationCap, School, Lightbulb, Shield,
  Quote, CheckCircle2, Menu, X, ChevronLeft, ChevronRight, Award, LogIn, UserPlus,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Input, Badge, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { AuthModal } from "../components/AuthModal";
import { LegalLinks } from "../components/Legal";
import { HERO_BG, SCHOOL_IMG, TECH_IMG, LOGO, IMG_PRIMARIA, IMG_BACHILLERATO, IMG_AUTODIDACTA, IMG_ESFUERZATE } from "../lib/assets";

const LogoMark = ({ size = 36 }: { size?: number }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]"
    style={{ width: size, height: size }}
  >
    <img src={LOGO} alt="" className="h-full w-full object-cover" />
  </span>
);

// ====== NAVBAR ======
function Navbar({ onOpenAuth }: { onOpenAuth: (m: "login" | "register") => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const links = [
    { href: "#caracteristicas", label: "Características" },
    { href: "#como-funciona", label: "Cómo funciona" },
    { href: "#sobre-mimiria", label: "Sobre MIMIRIA" },
    { href: "#institucion", label: "Institución" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header data-testid="navbar-main" className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-12">
        <a href="#top" data-testid="logo-link" className="flex shrink-0 items-center gap-2.5">
          <LogoMark size={36} />
          <span className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">
            MIMIR <span className="text-[var(--brand-text)]">IA</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm font-medium text-[var(--text-2)] transition-colors hover:text-[var(--brand-text)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button
                onClick={() => navigate("/chat")}
                data-testid="nav-go-chat"
                className="hidden gap-2 rounded-full bg-[var(--brand)] px-5 text-white hover:bg-[var(--brand-hover)] sm:flex"
              >
                <MessageCircle size={15} /> Hablar con MIMIRIA
              </Button>
              <div className="hidden items-center gap-2.5 text-sm text-[var(--text-2)] sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold uppercase text-white">
                  {user.username?.slice(0, 1)}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="max-w-[90px] truncate text-xs font-semibold text-[var(--text)]">{user.username}</span>
                  <span className="font-mono text-[10px] text-[var(--amber)]">{user.id}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs text-[var(--text-3)] transition-colors hover:text-[var(--brand-text)]"
                  data-testid="nav-logout"
                >
                  Salir
                </button>
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={() => onOpenAuth("login")}
                data-testid="nav-login-btn"
                variant="ghost"
                className="hidden gap-1.5 text-sm font-medium text-[var(--text-2)] hover:bg-transparent hover:text-[var(--brand-text)] sm:inline-flex"
              >
                <LogIn size={14} /> Iniciar sesión
              </Button>
              <Button
                onClick={() => onOpenAuth("register")}
                data-testid="nav-register-btn"
                className="gap-1.5 rounded-full bg-[var(--brand)] px-4 text-white hover:bg-[var(--brand-hover)] sm:px-5"
              >
                <UserPlus size={14} /> <span className="hidden sm:inline">Crear cuenta</span>
                <span className="sm:hidden">Crear</span>
              </Button>
            </>
          )}
          <button
            className="p-2 text-[var(--text)] lg:hidden"
            onClick={() => setOpen(!open)}
            data-testid="mobile-menu-toggle"
            aria-label="Menú"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[var(--border)] bg-[var(--bg)] px-6 py-4 lg:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-[var(--text-2)]"
              data-testid={`mobile-nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {l.label}
            </a>
          ))}
          {user ? (
            <div className="flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold uppercase text-white">
                  {user.username?.slice(0, 1)}
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-[var(--text)]">{user.username}</div>
                  <div className="font-mono text-[10px] text-[var(--amber)]">{user.id}</div>
                </div>
              </div>
              <Button
                onClick={() => { navigate("/chat"); setOpen(false); }}
                className="mt-1 w-full gap-2 rounded-full bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
              >
                <MessageCircle size={15} /> Hablar con MIMIRIA
              </Button>
              <button onClick={logout} className="text-xs text-[var(--text-3)] hover:text-[var(--brand-text)]">
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
              <Button onClick={() => { onOpenAuth("login"); setOpen(false); }} variant="outline" className="w-full rounded-full">
                Iniciar sesión
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

// ====== HERO ======
function Hero({ onOpenAuth }: { onOpenAuth: (m: "login" | "register") => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handlePrimary = () => {
    if (user) navigate("/chat");
    else onOpenAuth("register");
  };

  return (
    <section id="top" data-testid="hero-section" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_BG})` }} aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg)]/85 via-[var(--bg)]/70 to-[var(--bg)]" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-24 pt-20 md:px-12 md:pt-28 md:pb-32 lg:grid-cols-12">
        <div className="animate-fade-in-up lg:col-span-7">
          <Badge className="mb-6 rounded-full border-0 bg-[var(--brand-tint)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-text)] hover:bg-[var(--brand-tint)]">
            <Sparkles size={12} className="mr-1.5" /> Proyecto SENA — Ficha 3156695
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl">
            Sabiduría ancestral,
            <br />
            <span className="italic font-light text-[var(--brand-text)]">inteligencia</span> moderna
            <br />
            para tu educación.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[var(--text-2)] sm:text-xl">
            MIMIR IA es tu tutor personal: explica conceptos paso a paso, busca
            información con <strong className="font-semibold text-[var(--text)]">fuentes verificadas</strong> y diseña
            rutas de estudio adaptadas a tu nivel.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={handlePrimary}
              data-testid="hero-cta-primary"
              className="group h-12 gap-2 rounded-full bg-[var(--brand)] px-7 text-base font-medium text-white hover:bg-[var(--brand-hover)]"
            >
              {user ? "Hablar con MIMIRIA" : "Crear cuenta gratis"}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </Button>
            <a href="#como-funciona">
              <Button
                size="lg"
                variant="outline"
                data-testid="hero-cta-secondary"
                className="h-12 w-full rounded-full border-[var(--border)] px-7 text-base font-medium text-[var(--text)] hover:bg-[var(--bg-soft)] sm:w-auto"
              >
                Cómo funciona
              </Button>
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-4 text-sm text-[var(--text-3)] sm:gap-6">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--brand-text)]" /> Sin costo</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--brand-text)]" /> En español</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--brand-text)]" /> Con fuentes reales</div>
          </div>
        </div>

        <div className="animate-fade-in-up relative lg:col-span-5" style={{ animationDelay: "0.2s" }}>
          <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface)]/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <LogoMark size={40} />
              <div>
                <div className="font-display font-semibold text-[var(--text)]">MIMIR IA</div>
                <div className="flex items-center gap-1.5 text-xs text-[#65a30d]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#65a30d]" /> Conectado
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[var(--brand)] px-4 py-2.5 text-sm text-white">
                ¿Qué es la fotosíntesis?
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text)]">
                <p>Es el proceso por el cual las plantas convierten luz solar, agua y CO₂ en glucosa y oxígeno. Ocurre en los <strong>cloroplastos</strong>...</p>
                <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-soft)] pt-3 text-xs font-medium text-[var(--brand-text)]">
                  <Globe size={12} /> 3 fuentes citadas
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-4 rotate-3 rounded-2xl bg-[var(--amber)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-lg">
            Con fuentes verificadas
          </div>
        </div>
      </div>
    </section>
  );
}

// ====== CHAT TEASER ======
function ChatTeaser({ onOpenAuth }: { onOpenAuth: (m: "login" | "register") => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [demoInput, setDemoInput] = useState("");

  const goChat = (prefillText: string) => {
    if (user) {
      if (prefillText) sessionStorage.setItem("mimir_first_prompt", prefillText);
      navigate("/chat");
    } else {
      onOpenAuth("register");
    }
  };

  return (
    <section id="probar" data-testid="chat-teaser-section" className="relative border-y border-[var(--border-soft)] bg-[var(--bg-soft)] py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6 text-center md:px-12">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]">Empieza ahora</div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
          Tu primer chat con MIMIR está a un clic.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--text-2)] sm:text-lg">
          {user
            ? "Tu cuenta está lista. Abre MIMIR y comienza a aprender con fuentes verificadas."
            : "Crea tu cuenta gratis, recibe tu ID de estudiante y entra al asistente con historial guardado."}
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); goChat(demoInput); }}
          className="mt-10 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-sm transition-colors focus-within:border-[var(--brand)]"
        >
          <Input
            data-testid="teaser-input"
            value={demoInput}
            onChange={(e) => setDemoInput(e.target.value)}
            placeholder="¿Qué quieres aprender hoy?"
            className="h-11 flex-1 border-0 bg-transparent px-4 text-base text-[var(--text)] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            data-testid="teaser-submit"
            className="h-11 shrink-0 gap-1.5 rounded-full bg-[var(--brand)] px-5 text-white hover:bg-[var(--brand-hover)]"
          >
            <span className="hidden sm:inline">{user ? "Continuar" : "Empezar"}</span>
            <Send size={15} />
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["Fotosíntesis", "Ecuaciones cuadráticas", "Guerra de los Mil Días", "¿Qué es una IA?"].map((p) => (
            <button
              key={p}
              onClick={() => goChat(p)}
              data-testid={`teaser-chip-${p.toLowerCase().replace(/\s+/g, "-")}`}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ====== FEATURES BENTO ======
function Features({ onOpenAuth }: { onOpenAuth: (m: "login" | "register") => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const handleCta = () => (user ? navigate("/chat") : onOpenAuth("register"));

  return (
    <section id="caracteristicas" data-testid="features-section" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]">Características</div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
            Aprende con la profundidad que mereces.
          </h2>
          <p className="mt-4 text-base text-[var(--text-2)] sm:text-lg">
            Cuatro pilares que hacen de MIMIR IA un aliado real para tu rendimiento académico.
          </p>
        </div>

        <div data-testid="features-bento-grid" className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
          <div className="group relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-3xl bg-[#0F172A] p-8 text-white md:col-span-8 md:row-span-2 md:p-12">
            <div className="absolute inset-0 bg-cover bg-center opacity-25 transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${TECH_IMG})` }} />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0F172A] via-[#0F172A]/80 to-transparent" />
            <div className="relative">
              <Globe size={28} className="mb-5 text-[var(--amber)]" />
              <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                Búsqueda con fuentes citadas en cada respuesta.
              </h3>
              <p className="mt-4 max-w-md text-base text-white/70">
                MIMIR consulta enciclopedias, sitios académicos y fuentes oficiales. Cada explicación viene con enlaces para que <em>verifiques y profundices</em>.
              </p>
            </div>
            <div className="relative mt-8 flex flex-wrap gap-2">
              {["Wikipedia", "MDN", ".edu", "Khan Academy", ".gov"].map((tag) => (
                <span key={tag} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs backdrop-blur">{tag}</span>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-soft)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand)]/40 md:col-span-4">
            <Compass size={26} className="mb-4 text-[var(--brand-text)]" />
            <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">Rutas personalizadas</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">Planes de estudio adaptados a tu nivel, ritmo y objetivos académicos.</p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--amber)]/50 md:col-span-4">
            <Brain size={26} className="mb-4 text-[var(--amber)]" />
            <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">Pensamiento crítico</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">No te da la respuesta directa: te guía paso a paso para que pienses por ti.</p>
          </div>

          <div className="flex flex-col gap-6 rounded-3xl bg-[var(--brand)] p-8 text-white md:col-span-12 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="flex items-center gap-5">
              <Clock size={36} className="shrink-0 text-[var(--amber)]" />
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Disponible 24/7, en cualquier dispositivo.</h3>
                <p className="mt-1.5 text-sm text-white/70 sm:text-base">Estudia a tu hora. MIMIR no descansa, ni en fines de semana ni en vacaciones.</p>
              </div>
            </div>
            <Button
              onClick={handleCta}
              data-testid="features-cta-button"
              className="h-11 gap-2 whitespace-nowrap rounded-full bg-[var(--bg)] px-6 font-medium text-[var(--brand-text)] hover:bg-[var(--bg-soft)] hover:shadow-lg transition-all"
            >
              Empezar ahora <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ====== HOW IT WORKS ======
function HowItWorks() {
  const steps: { n: string; icon: LucideIcon; title: string; desc: string }[] = [
    { n: "01", icon: Lightbulb, title: "Crea tu cuenta", desc: "Regístrate con tu nombre de usuario y una contraseña. Recibes un ID único que guarda todo tu historial." },
    { n: "02", icon: Globe, title: "Haz tu pregunta", desc: "Escribe en tus palabras lo que necesites entender. MIMIR la analiza y consulta fuentes." },
    { n: "03", icon: Compass, title: "Recibe tu ruta", desc: "Obtén una explicación clara con citas y preguntas de seguimiento para profundizar." },
    { n: "04", icon: CheckCircle2, title: "Guarda y vuelve", desc: "Tus chats se guardan automáticamente. Vuelve cuando quieras y continúa desde donde estabas." },
  ];
  return (
    <section id="como-funciona" data-testid="how-it-works-section" className="border-t border-[var(--border-soft)] bg-[var(--bg)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]">Cómo funciona</div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
            Cuatro pasos. Cero fricción.
          </h2>
        </div>
        <div data-testid="how-it-works-steps" className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n} data-testid={`step-${i + 1}`} className="relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand)] hover:shadow-[0_8px_24px_var(--shadow-brand)]">
              <div className="mb-5 font-mono text-xs tracking-widest text-[var(--amber)]">{s.n}</div>
              <s.icon size={26} className="mb-4 text-[var(--brand-text)]" />
              <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ====== SOBRE MIMIRIA ======
function AboutMimiria() {
  return (
    <section id="sobre-mimiria" data-testid="about-mimiria-section" className="border-t border-[var(--border-soft)] bg-[var(--bg-soft)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-14 max-w-3xl">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]">Sobre MIMIRIA</div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
            ¿Qué es MIMIR IA?
          </h2>
          <p className="mt-4 text-base text-[var(--text-2)] sm:text-lg">
            MIMIR IA (Mente Inteligente para Mejorar el Rendimiento) es un tutor personal impulsado por inteligencia artificial, diseñado específicamente para estudiantes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-tint)]">
                <Brain size={24} className="text-[var(--brand-text)]" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">Tecnología</h3>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              Utiliza <strong className="font-semibold text-[var(--text)]">GPT-5-mini y GPT-5-nano de OpenAI</strong> con enrutamiento inteligente que selecciona el modelo óptimo según la dificultad de tu pregunta, más un sistema de caché que evita consultas repetitivas para preguntas frecuentes.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-tint)]">
                <School size={24} className="text-[var(--brand-text)]" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">Origen</h3>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              Creado por estudiantes del <strong className="font-semibold text-[var(--text)]">SENA</strong> (programa 233108, ficha 3156695) como proyecto productivo para la <strong className="font-semibold text-[var(--text)]">Institución Educativa Gonzalo Rivera Laguado</strong> de Cúcuta, Colombia.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-tint)]">
                <Globe size={24} className="text-[var(--brand-text)]" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">Funcionalidades</h3>
            </div>
            <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-2)]">
              <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> Explica conceptos paso a paso con ejemplos</li>
              <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> Busca información con fuentes verificadas</li>
              <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> Analiza imágenes y PDFs (ejercicios, diagramas, documentos)</li>
              <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> Diseña rutas de estudio personalizadas</li>
              <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> Guarda tu historial de conversaciones</li>
              <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> Disponible 24/7 desde cualquier dispositivo</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-tint)]">
                <Shield size={24} className="text-[var(--brand-text)]" />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">Privacidad</h3>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              Las contraseñas se guardan <strong className="font-semibold text-[var(--text)]">encriptadas</strong>, no se venden datos personales y cumple con la <strong className="font-semibold text-[var(--text)]">Ley 1581 de 2012</strong> de Protección de Datos Personales de Colombia. Tu historial es privado y solo tú puedes acceder a él.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-3xl bg-[var(--brand)] p-8 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                ¿Tienes preguntas sobre MIMIRIA?
              </h3>
              <p className="mt-2 text-sm text-white/80 sm:text-base">
                Pregúntale directamente a la IA: "¿Qué es MIMIRIA?", "¿Quién te creó?", "¿Cómo funcionas?"
              </p>
            </div>
            <a href="#faq">
              <Button className="h-11 gap-2 whitespace-nowrap rounded-full bg-white px-6 font-medium text-[var(--brand)] hover:bg-white/90">
                Ver preguntas frecuentes <ArrowRight size={16} />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ====== TARGET AUDIENCE — CAROUSEL (cíclico, 10s, con reinicio de contador) ======
const AUDIENCE_CARDS: { icon: LucideIcon; title: string; desc: string; img: string; testid: string }[] = [
  {
    icon: School,
    title: "Primaria",
    desc: "Explicaciones simples, ejemplos cotidianos y refuerzo de fundamentos. Aprende a tu ritmo, con paciencia.",
    img: IMG_PRIMARIA,
    testid: "audience-basica",
  },
  {
    icon: GraduationCap,
    title: "Bachillerato",
    desc: "Preparación para ICFES, ensayos, matemáticas avanzadas y ciencias. Tu próximo grado, con respaldo real.",
    img: IMG_BACHILLERATO,
    testid: "audience-media",
  },
  {
    icon: BookOpen,
    title: "Autodidactas",
    desc: "Curiosos sin maestro. MIMIR te diseña el plan que te falta para avanzar por tu cuenta y no perderte en internet.",
    img: IMG_AUTODIDACTA,
    testid: "audience-autodidactas",
  },
  {
    icon: Award,
    title: "Esfuérzate",
    desc: "El conocimiento no se regala, se conquista. MIMIR está a tu lado: tú pones el esfuerzo, nosotros las herramientas.",
    img: IMG_ESFUERZATE,
    testid: "audience-esfuerzate",
  },
];

const AUTOPLAY_MS = 10000; // pasa de imagen cada 10 segundos
const VISIBLE = 3; // tarjetas visibles a la vez en pantallas grandes

function TargetAudienceCarousel({ onOpenAuth }: { onOpenAuth: (m: "login" | "register") => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [dotIndex, setDotIndex] = useState(0);
  const dotIndexRef = useRef(0);
  const [tick, setTick] = useState(0); // al cambiar, el contador de 10s se reinicia

  const cards = AUDIENCE_CARDS;
  const n = cards.length;
  const OFFSET = VISIBLE; // índice donde empiezan las tarjetas reales
  // Clones a los lados: hacen que el bucle sea continuo (la imagen que falta aparece al girar)
  const extended = [...cards.slice(-VISIBLE), ...cards, ...cards.slice(0, VISIBLE)];

  const setDot = (i: number) => {
    dotIndexRef.current = i;
    setDotIndex(i);
  };

  const stepOf = (el: HTMLDivElement) => {
    const first = el.children[0] as HTMLElement | undefined;
    if (!first) return 0;
    const gap = parseFloat(window.getComputedStyle(el).columnGap) || 0;
    return first.offsetWidth + gap;
  };
  const currentP = (el: HTMLDivElement) => {
    const s = stepOf(el);
    return s ? Math.round(el.scrollLeft / s) : 0;
  };
  const goTo = (el: HTMLDivElement, p: number, smooth: boolean) => {
    const s = stepOf(el);
    if (!s) return;
    el.scrollTo({ left: p * s, behavior: smooth ? "smooth" : "auto" });
  };

  // Si el scroll termina sobre la zona de clones, salta en silencio a su equivalente real
  const normalize = () => {
    const el = scrollerRef.current;
    if (!el) return;
    let p = currentP(el);
    if (p >= OFFSET + n) p -= n;
    else if (p <= OFFSET - 1) p += n;
    else return;
    goTo(el, p, false);
    setDot(((p - OFFSET) % n + n) % n);
  };

  // Posición inicial + sincronización de los puntos con el scroll
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    goTo(el, OFFSET, false);
    let idle = 0;
    const onScroll = () => {
      const s = stepOf(el);
      if (s) {
        const p = Math.round(el.scrollLeft / s);
        setDot(((p - OFFSET) % n + n) % n);
      }
      window.clearTimeout(idle);
      idle = window.setTimeout(normalize, 150);
    };
    const onScrollEnd = () => {
      window.clearTimeout(idle);
      normalize();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const hasScrollEnd = "onscrollend" in window;
    if (hasScrollEnd) el.addEventListener("scrollend", onScrollEnd);
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (hasScrollEnd) el.removeEventListener("scrollend", onScrollEnd);
      window.clearTimeout(idle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // Al redimensionar la ventana, recoloca la tarjeta actual con la nueva medida
  useEffect(() => {
    const onResize = () => {
      const el = scrollerRef.current;
      if (!el) return;
      goTo(el, OFFSET + dotIndexRef.current, false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fromRealZone = (el: HTMLDivElement) => {
    let p = currentP(el);
    if (p >= OFFSET + n || p <= OFFSET - 1) {
      p = p >= OFFSET + n ? p - n : p + n;
      goTo(el, p, false);
    }
    return p;
  };

  const next = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const p = fromRealZone(el);
    requestAnimationFrame(() => goTo(el, p + 1, true));
  };
  const prev = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const p = fromRealZone(el);
    requestAnimationFrame(() => goTo(el, p - 1, true));
  };
  const goReal = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    fromRealZone(el);
    requestAnimationFrame(() => goTo(el, OFFSET + i, true));
  };

  // Autoplay cíclico cada 10s. `tick` cambia con cada acción manual → el contador se reinicia.
  useEffect(() => {
    const id = window.setInterval(() => next(), AUTOPLAY_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const handleCardClick = () => {
    if (user) navigate("/chat");
    else onOpenAuth("register");
  };

  const scrollPrev = () => {
    prev();
    setTick((t) => t + 1);
  };
  const scrollNext = () => {
    next();
    setTick((t) => t + 1);
  };
  const scrollTo = (i: number) => {
    goReal(i);
    setTick((t) => t + 1);
  };

  return (
    <section data-testid="target-audience-section" className="overflow-hidden bg-[var(--bg-soft)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]">Para quién es</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
              Pensado para todo quien quiera aprender mejor.
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={scrollPrev}
              data-testid="carousel-prev"
              aria-label="Anterior"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={scrollNext}
              data-testid="carousel-next"
              aria-label="Siguiente"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          data-testid="audience-carousel"
          style={{ scrollPaddingLeft: 24 }}
          onPointerDown={() => setTick((t) => t + 1)}
          className="scrollbar-hide -mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain px-6 pb-2 md:gap-6"
        >
          {extended.map((c, i) => {
            const isReal = i >= OFFSET && i < OFFSET + n;
            return (
              <article
                key={`${c.title}-${i}`}
                data-testid={isReal ? c.testid : `${c.testid}-clone`}
                aria-hidden={!isReal}
                onClick={handleCardClick}
                className="group w-[85%] shrink-0 cursor-pointer snap-start overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] transition-all hover:border-[var(--brand)] hover:shadow-[0_8px_28px_var(--shadow-brand)] sm:w-[60%] md:w-[46%] lg:w-[calc((100%-48px)/3)]"
              >
                <div className="relative h-56 overflow-hidden bg-[var(--border-soft)]">
                  <img
                    src={c.img}
                    alt={isReal ? c.title : ""}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <c.icon size={22} className="absolute left-4 top-4 text-white drop-shadow-lg" />
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#065F46] opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                    Abrir MIMIR <ArrowRight size={11} />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--text)]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{c.desc}</p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Puntos — sincronizados con la tarjeta visible */}
        <div className="mt-8 flex justify-center gap-2">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Ir a la tarjeta ${i + 1}`}
              data-testid={`carousel-dot-${i}`}
              className={`h-1.5 cursor-pointer rounded-full transition-all ${
                dotIndex === i ? "w-8 bg-[var(--brand)]" : "w-1.5 bg-[var(--text)]/20 hover:bg-[var(--text)]/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ====== INSTITUTION SECTION ======
function InstitutionSection() {
  const objectives = [
    "Diseñar una interfaz accesible y fácil de usar que permita a los estudiantes interactuar con la IA de forma intuitiva.",
    "Implementar un sistema de aprendizaje adaptativo que analice el progreso del estudiante y genere recomendaciones personalizadas.",
    "Crear módulos de estudio, cuestionarios y planes de aprendizaje que refuercen los conocimientos en áreas fundamentales.",
    "Mejorar el desarrollo de habilidades cognitivas y el rendimiento académico de los estudiantes.",
    "Promover el uso de tecnologías educativas dentro de la institución como apoyo al proceso de enseñanza-aprendizaje.",
  ];

  return (
    <section id="institucion" data-testid="institution-info" className="bg-[#0F172A] py-20 text-white md:py-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:px-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--amber)]">La institución</div>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Un proyecto del SENA, hecho desde Cúcuta para el mundo.
          </h2>
          <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-3xl bg-black">
            <img src={SCHOOL_IMG} alt="Institución Educativa Gonzalo Rivera Laguado" className="h-full w-full object-cover" />
          </div>
          <div className="mt-4">
            <div className="font-display text-xl font-semibold">Institución Educativa Gonzalo Rivera Laguado</div>
            <div className="mt-1 text-sm text-white/70">Cúcuta · Norte de Santander · Colombia</div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
              <div className="mb-1 text-xs uppercase tracking-widest text-white/50">Programa</div>
              <div className="font-mono">233108</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
              <div className="mb-1 text-xs uppercase tracking-widest text-white/50">Ficha</div>
              <div className="font-mono">3156695</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
              <div className="mb-1 text-xs uppercase tracking-widest text-white/50">Vigencia</div>
              <div className="font-mono">2025 — 2026</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
              <div className="mb-1 text-xs uppercase tracking-widest text-white/50">Inicio</div>
              <div className="font-mono">04 / 08 / 2025</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 lg:border-l lg:border-white/10 lg:pl-8">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--amber)]">Objetivos del proyecto</div>
          <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Cinco metas para transformar la educación.
          </h3>
          <ol className="mt-8 space-y-5">
            {objectives.map((o, i) => (
              <li key={i} data-testid={`objective-${i + 1}`} className="group flex gap-5 border-b border-white/10 pb-5 last:border-0">
                <span className="mt-1 shrink-0 font-mono text-2xl leading-none text-[var(--amber)] transition-transform group-hover:-translate-y-0.5">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-base leading-relaxed text-white/85">{o}</p>
              </li>
            ))}
          </ol>

          <blockquote className="mt-10 border-l-2 border-[var(--amber)] bg-white/5 py-4 pl-5 italic text-white/80">
            <Quote size={20} className="mb-2 text-[var(--amber)]" />
            "MIMIR IA no busca reemplazar al docente, sino caminar al lado del estudiante: ser ese pie de apoyo que reduce la brecha y reactiva la curiosidad."
          </blockquote>
        </div>
      </div>
    </section>
  );
}

// ====== FAQ ======
function FAQ() {
  const faqs = [
    { q: "¿MIMIR IA es realmente gratuito para los estudiantes?", a: "Sí. El proyecto nació en el SENA con vocación de impacto social. La plataforma es de acceso libre para estudiantes de la institución y, en su fase abierta, para cualquier estudiante hispanohablante." },
    { q: "¿Necesito una cuenta para usar MIMIR?", a: "Sí. Al registrarte recibes un ID único (por ejemplo #001) que se guarda en la base de datos y vincula todo tu historial de conversaciones, para que puedas volver a ellas cuando quieras." },
    { q: "¿De dónde saca la información MIMIR?", a: "MIMIR utiliza GPT-5-mini y GPT-5-nano de OpenAI con un sistema inteligente de enrutamiento que selecciona el modelo óptimo según la dificultad de tu pregunta, más un sistema de caché que guarda respuestas frecuentes para evitar consultas repetitivas. En cada respuesta, te indica las fuentes (Wikipedia, sitios .edu, .gov, MDN, Khan Academy, entre otros) para que puedas verificar la información." },
    { q: "¿Reemplaza a un profesor?", a: "No. MIMIR es un complemento: explica conceptos, da ejemplos y propone rutas de estudio. El acompañamiento docente sigue siendo irremplazable. Nuestra meta es reducir su carga repetitiva, no eliminar su rol." },
    { q: "¿Qué tan precisa es la información?", a: "MIMIR puede cometer errores como cualquier IA. Por eso siempre citamos fuentes: para que el estudiante desarrolle pensamiento crítico verificándolas. Esa es justamente la habilidad que queremos fomentar." },
    { q: "¿Mis datos están seguros?", a: "Cumplimos con la Ley 1581 de 2012 de Protección de Datos Personales. No vendemos tus datos. Las contraseñas se guardan encriptadas y las conversaciones se usan únicamente para mejorar tu experiencia." },
  ];
  return (
    <section id="faq" className="border-t border-[var(--border-soft)] bg-[var(--bg)] py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 md:px-12">
        <div className="mb-14 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-text)]">Preguntas frecuentes</div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
            Resolvamos las dudas.
          </h2>
        </div>
        <Accordion type="single" collapsible data-testid="faq-accordion" className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              data-testid={`faq-item-${i}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 data-[state=open]:border-[var(--brand)]"
            >
              <AccordionTrigger className="py-5 text-left font-display text-base font-medium text-[var(--text)] hover:no-underline sm:text-lg">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-[var(--text-2)] sm:text-base">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

// ====== FOOTER ======
function Footer() {
  return (
    <footer data-testid="footer-main" className="bg-[#0F172A] py-14 text-white/80">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="mb-4 flex items-center gap-2.5">
              <LogoMark size={36} />
              <span className="font-display text-xl font-semibold tracking-tight text-white">MIMIR IA</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed">Plan de mejoramiento académico a partir de inteligencia artificial. Proyecto productivo SENA — Programa 233108. Creado por Cristian C. Caro M. y Camilo H. Torres S.</p>
          </div>
          <div className="md:col-span-3">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Institución</div>
            <ul className="space-y-2 text-sm">
              <li>I.E. Gonzalo Rivera Laguado</li>
              <li>Cúcuta, Colombia</li>
              <li>SENA — Ficha 3156695</li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Explorar</div>
            <ul className="space-y-2 text-sm">
              <li><a href="#caracteristicas" className="transition-colors hover:text-white">Características</a></li>
              <li><a href="#como-funciona" className="transition-colors hover:text-white">Cómo funciona</a></li>
              <li><Link to="/chat" className="transition-colors hover:text-white">Hablar con MIMIRIA</Link></li>
              <li><a href="#faq" className="transition-colors hover:text-white">Preguntas frecuentes</a></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Legal y contacto</div>
            <LegalLinks />
          </div>
        </div>
        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row">
          <div>© {new Date().getFullYear()} MIMIR IA · Todos los derechos reservados.</div>
          <div className="font-mono">v0.3 — Vigencia 2025–2026</div>
        </div>
      </div>
    </footer>
  );
}

// ====== LANDING PAGE ======
export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const openAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div className="App font-body">
      <Navbar onOpenAuth={openAuth} />
      <main>
        <Hero onOpenAuth={openAuth} />
        <ChatTeaser onOpenAuth={openAuth} />
        <Features onOpenAuth={openAuth} />
        <HowItWorks />
        <AboutMimiria />
        <TargetAudienceCarousel onOpenAuth={openAuth} />
        <InstitutionSection />
        <FAQ />
      </main>
      <Footer />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultMode={authMode} />
    </div>
  );
}
