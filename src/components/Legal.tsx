import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FileText, Shield, Mail, Phone, MapPin, ExternalLink, ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui";

/* ============================================================================
   Datos de contacto
   ========================================================================== */

export const CONTACT_EMAIL = "Cristiancaro027@gmail.com";
export const CONTACT_WHATSAPP_DISPLAY = "+57 324 472 8516";
export const CONTACT_WHATSAPP_INTL = "573244728516";
export const CONTACT_WHATSAPP_URL =
  `https://wa.me/${CONTACT_WHATSAPP_INTL}?text=` +
  encodeURIComponent("Hola, escribo desde la página de MIMIR IA. Tengo una consulta:");

export type LegalKey = "terminos" | "privacidad" | "contacto";

/* ============================================================================
   Panel flotante al pasar el mouse
   --------------------------------------------------------------------------
   En escritorio aparece una tarjeta con el resumen al pasar el cursor (o al
   enfocar con el teclado). En móvil no hay hover, así que el enlace abre
   directamente el detalle completo.
   ========================================================================== */

function HoverCard({
  label,
  icon,
  summary,
  bullets,
  onOpen,
  testid,
}: {
  label: string;
  icon: ReactNode;
  summary: string;
  bullets: string[];
  onOpen: () => void;
  testid: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();

  // Un pequeño retardo al salir evita que la tarjeta desaparezca mientras el
  // cursor viaja del enlace hacia ella.
  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      <button
        type="button"
        onClick={onOpen}
        data-testid={`legal-link-${testid}`}
        aria-haspopup="dialog"
        aria-describedby={open ? panelId : undefined}
        className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
      >
        {icon}
        {label}
      </button>

      {open && (
        <div
          id={panelId}
          role="tooltip"
          data-testid={`legal-hovercard-${testid}`}
          onMouseEnter={show}
          onMouseLeave={hide}
          className="animate-fade-in-up absolute bottom-full left-0 z-50 mb-3 hidden w-72 rounded-2xl border border-white/15 bg-[#131C31] p-4 text-left shadow-[0_18px_44px_rgba(2,8,23,0.45)] md:block"
        >
          <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-white">
            {icon}
            {label}
          </div>
          <p className="text-xs leading-relaxed text-white/70">{summary}</p>
          <ul className="mt-3 space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2 text-xs leading-relaxed text-white/60">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--amber)]" />
                {b}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onOpen}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--amber)] hover:underline"
          >
            Leer completo <ArrowRight size={11} />
          </button>
          {/* Puntita del globo */}
          <span className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 border-b border-r border-white/15 bg-[#131C31]" />
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Contenido
   ========================================================================== */

const LAST_UPDATE = "19 de septiembre de 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="font-display text-sm font-semibold text-[var(--text)]">{title}</h3>
      <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-[var(--text-2)]">{children}</div>
    </section>
  );
}

function TerminosBody() {
  return (
    <>
      <Section title="1. Qué es este servicio">
        <p>
          MIMIR IA es un tutor educativo gratuito creado por estudiantes del SENA (programa 233108,
          ficha 3156695) como proyecto productivo para la Institución Educativa Gonzalo Rivera
          Laguado de Cúcuta, Colombia. Al crear una cuenta aceptas estas condiciones.
        </p>
      </Section>
      <Section title="2. Quién puede usarlo">
        <p>
          El servicio está dirigido a estudiantes. Si eres menor de edad, debes contar con el permiso
          de tu padre, madre o acudiente. Eres responsable de la actividad de tu cuenta y de mantener
          tu contraseña en privado.
        </p>
      </Section>
      <Section title="3. Uso aceptable">
        <p>No está permitido usar MIMIR IA para:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Hacer trampa en evaluaciones cuando tu institución lo prohíba.</li>
          <li>Generar contenido ofensivo, discriminatorio, violento o ilegal.</li>
          <li>Subir información personal sensible de terceros sin su autorización.</li>
          <li>Intentar vulnerar, sobrecargar o dañar la plataforma.</li>
        </ul>
      </Section>
      <Section title="4. Límites de la inteligencia artificial">
        <p>
          MIMIR IA puede equivocarse. Las respuestas se generan con modelos de lenguaje y{" "}
          <strong className="font-semibold text-[var(--text)]">
            siempre deben verificarse con las fuentes citadas
          </strong>{" "}
          antes de usarlas en un trabajo académico. No sustituye a tu docente ni constituye asesoría
          profesional de ningún tipo.
        </p>
      </Section>
      <Section title="5. Archivos que subes">
        <p>
          Puedes adjuntar fotos y documentos de hasta 20 MB (máximo 5 fotos y 5 documentos por
          envío). El texto de los documentos se extrae en tu propio navegador y solo ese texto llega
          a nuestros servidores. No subas documentos con datos confidenciales de otras personas.
        </p>
      </Section>
      <Section title="6. Disponibilidad">
        <p>
          El servicio se ofrece «tal cual», sin garantía de disponibilidad permanente. Al tratarse de
          un proyecto académico, puede haber interrupciones, cambios o cierre del servicio sin previo
          aviso.
        </p>
      </Section>
      <Section title="7. Propiedad intelectual">
        <p>
          El contenido que generas en tus conversaciones es tuyo. El nombre, el logotipo y el código
          de MIMIR IA pertenecen a sus autores del SENA. Las fuentes citadas pertenecen a sus
          respectivos titulares.
        </p>
      </Section>
      <Section title="8. Cambios y contacto">
        <p>
          Estas condiciones pueden actualizarse. La fecha de la última versión aparece arriba. Para
          cualquier duda, escribe a {CONTACT_EMAIL}.
        </p>
      </Section>
    </>
  );
}

function PrivacidadBody() {
  return (
    <>
      <Section title="1. Quién trata tus datos">
        <p>
          El equipo de MIMIR IA (SENA — ficha 3156695, Cúcuta, Norte de Santander). Cumplimos la{" "}
          <strong className="font-semibold text-[var(--text)]">Ley 1581 de 2012</strong> de
          Protección de Datos Personales de Colombia y su Decreto reglamentario 1377 de 2013.
        </p>
      </Section>
      <Section title="2. Qué datos guardamos">
        <ul className="ml-4 list-disc space-y-1">
          <li>Tu nombre de usuario y un ID de estudiante correlativo (por ejemplo #001).</li>
          <li>
            Tu contraseña, nunca en texto plano: se guarda cifrada con scrypt y una sal única por
            cuenta.
          </li>
          <li>Tus conversaciones con la IA, para que puedas volver a ellas.</li>
          <li>
            El texto extraído de los documentos que adjuntas, únicamente dentro de la conversación
            en la que los enviaste.
          </li>
        </ul>
        <p>
          No pedimos correo, teléfono, documento de identidad ni datos de pago. No usamos cookies de
          publicidad ni rastreadores de terceros.
        </p>
      </Section>
      <Section title="3. Para qué los usamos">
        <p>
          Únicamente para que el servicio funcione: identificarte, guardar tu historial y generar las
          respuestas.{" "}
          <strong className="font-semibold text-[var(--text)]">
            No vendemos ni cedemos tus datos personales a terceros.
          </strong>
        </p>
      </Section>
      <Section title="4. Con quién se comparten">
        <p>
          Para generar cada respuesta, el texto de tu pregunta se envía a OpenAI, que procesa la
          consulta. Los datos se almacenan en MongoDB Atlas y el sitio se aloja en Vercel. Son los
          únicos proveedores involucrados y actúan como encargados del tratamiento.
        </p>
      </Section>
      <Section title="5. Caché de respuestas">
        <p>
          Para ahorrar recursos, las respuestas a preguntas académicas generales se guardan en una
          caché compartida durante 30 días y se reutilizan si alguien vuelve a preguntar lo mismo. Se
          guarda la pregunta y la respuesta,{" "}
          <strong className="font-semibold text-[var(--text)]">nunca tu identidad</strong>, y jamás
          se cachean conversaciones con contexto previo ni con archivos adjuntos.
        </p>
      </Section>
      <Section title="6. Tus derechos">
        <p>
          Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización en
          cualquier momento. Puedes borrar tus conversaciones desde la propia aplicación. Para
          eliminar tu cuenta por completo, escribe a {CONTACT_EMAIL} y lo haremos dentro de los 15
          días hábiles siguientes.
        </p>
      </Section>
      <Section title="7. Seguridad y menores de edad">
        <p>
          La comunicación viaja cifrada por HTTPS y las contraseñas se almacenan con funciones de
          derivación de clave. Ningún sistema es infalible: evita compartir información sensible en
          el chat. Si eres menor de edad, el tratamiento de tus datos requiere la autorización de tu
          padre, madre o acudiente.
        </p>
      </Section>
    </>
  );
}

function ContactoBody() {
  return (
    <>
      <p className="text-sm leading-relaxed text-[var(--text-2)]">
        ¿Tienes dudas, encontraste un error o quieres proponer una mejora? Escríbenos por el medio
        que prefieras. Somos un equipo pequeño de estudiantes: respondemos en cuanto podemos.
      </p>

      <div className="mt-5 space-y-3">
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Consulta sobre MIMIR IA")}`}
          data-testid="contact-email"
          className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[0_8px_24px_var(--shadow-brand)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tint)]">
            <Mail size={20} className="text-[var(--brand-text)]" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-[var(--text)]">
              Correo electrónico
            </span>
            <span className="block truncate text-sm text-[var(--text-2)]">{CONTACT_EMAIL}</span>
          </span>
          <ExternalLink size={15} className="ml-auto shrink-0 text-[var(--text-3)]" />
        </a>

        <a
          href={CONTACT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="contact-whatsapp"
          className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[#25D366] hover:shadow-[0_8px_24px_rgba(37,211,102,0.18)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
            <Phone size={20} className="text-[#128C7E]" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-[var(--text)]">
              WhatsApp
            </span>
            <span className="block truncate text-sm text-[var(--text-2)]">
              {CONTACT_WHATSAPP_DISPLAY}
            </span>
          </span>
          <ExternalLink size={15} className="ml-auto shrink-0 text-[var(--text-3)]" />
        </a>

        <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tint)]">
            <MapPin size={20} className="text-[var(--brand-text)]" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-[var(--text)]">
              Dónde estamos
            </span>
            <span className="block text-sm text-[var(--text-2)]">
              I.E. Gonzalo Rivera Laguado · Cúcuta, Norte de Santander, Colombia
            </span>
          </span>
        </div>
      </div>

      <p className="mt-5 rounded-2xl bg-[var(--bg-soft)] p-4 text-xs leading-relaxed text-[var(--text-3)]">
        Para solicitudes sobre tus datos personales (conocer, actualizar, rectificar o eliminar tu
        cuenta), escribe al correo indicando tu nombre de usuario y tu ID de estudiante.
      </p>
    </>
  );
}

/* ============================================================================
   Configuración de los tres enlaces
   ========================================================================== */

const LEGAL: Record<
  LegalKey,
  {
    label: string;
    icon: ReactNode;
    summary: string;
    bullets: string[];
    title: string;
    description: string;
    body: ReactNode;
    wide?: boolean;
  }
> = {
  terminos: {
    label: "Términos y condiciones",
    icon: <FileText size={14} />,
    summary:
      "Las reglas de uso de MIMIR IA: qué puedes hacer, qué no, y hasta dónde llega la responsabilidad de una IA educativa.",
    bullets: [
      "Gratuito para estudiantes",
      "La IA puede equivocarse: verifica las fuentes",
      "No reemplaza a tu docente",
    ],
    title: "Términos y condiciones",
    description: `Última actualización: ${LAST_UPDATE}`,
    body: <TerminosBody />,
    wide: true,
  },
  privacidad: {
    label: "Política de privacidad",
    icon: <Shield size={14} />,
    summary:
      "Qué datos guardamos, para qué los usamos y cómo puedes eliminarlos. Cumplimos la Ley 1581 de 2012 de Colombia.",
    bullets: [
      "Contraseñas cifradas, nunca en texto plano",
      "No vendemos datos a terceros",
      "Puedes pedir que borremos tu cuenta",
    ],
    title: "Política de privacidad",
    description: `Última actualización: ${LAST_UPDATE}`,
    body: <PrivacidadBody />,
    wide: true,
  },
  contacto: {
    label: "Contacto",
    icon: <Mail size={14} />,
    summary:
      "Escríbenos si tienes dudas, encontraste un error o quieres proponer una mejora al proyecto.",
    bullets: [CONTACT_EMAIL, `WhatsApp ${CONTACT_WHATSAPP_DISPLAY}`, "Cúcuta, Colombia"],
    title: "Contacto",
    description: "Estamos para ayudarte",
    body: <ContactoBody />,
  },
};

/* ============================================================================
   Enlaces del pie + modal
   ========================================================================== */

export function LegalLinks() {
  const [openKey, setOpenKey] = useState<LegalKey | null>(null);
  const current = openKey ? LEGAL[openKey] : null;

  return (
    <>
      <ul className="space-y-2" data-testid="footer-legal">
        {(Object.keys(LEGAL) as LegalKey[]).map((key) => (
          <li key={key}>
            <HoverCard
              testid={key}
              label={LEGAL[key].label}
              icon={LEGAL[key].icon}
              summary={LEGAL[key].summary}
              bullets={LEGAL[key].bullets}
              onOpen={() => setOpenKey(key)}
            />
          </li>
        ))}
      </ul>

      <Dialog
        open={openKey !== null}
        onOpenChange={(o) => !o && setOpenKey(null)}
        panelClassName={current?.wide ? "sm:max-w-2xl" : undefined}
      >
        {current && (
          <DialogContent data-testid={`legal-dialog-${openKey}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl text-[var(--text)]">
                {current.icon}
                {current.title}
              </DialogTitle>
              <DialogDescription>{current.description}</DialogDescription>
            </DialogHeader>
            <div className="mt-5">{current.body}</div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

/* ============================================================================
   Botón flotante de WhatsApp
   ========================================================================== */

export function WhatsAppFab() {
  return (
    <a
      href={CONTACT_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-fab"
      aria-label={`Escribir por WhatsApp al ${CONTACT_WHATSAPP_DISPLAY}`}
      title="Escríbenos por WhatsApp"
      className="group fixed bottom-20 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_rgba(37,211,102,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1FB855] active:scale-90"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.886-9.885 9.886m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.465 3.49" />
      </svg>
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 md:block">
        Escríbenos por WhatsApp
      </span>
    </a>
  );
}
