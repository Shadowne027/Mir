import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Compass, ExternalLink, Globe, Loader2, LogOut, Menu,
  Plus, Send, Sparkles, Trash2, X, MessageSquare, Wifi, WifiOff, RefreshCw, AlertTriangle,
  Paperclip, FileText, FileSpreadsheet, Presentation, File as FileIcon, Zap,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { LOGO } from "../lib/assets";
import {
  getConversations,
  createConversation,
  deleteConversation,
  sendMessage,
  getHealth,
  formatApiError,
} from "../lib/api";
import {
  extensionOf,
  fileRejectionReason,
  formatBytes,
  isImageFile,
  MAX_FILE_BYTES,
  MAX_IMAGES,
  MAX_DOCUMENTS,
} from "../lib/extract";
import type { AuthUser, ChatMessage, Conversation, HealthStatus } from "../lib/api";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ================= Mini-render de texto (negritas + saltos + cursivas) ================= */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
        return (
          <p key={i} className="leading-relaxed">
            {parts.map((p, j) => {
              if (p.startsWith("**") && p.endsWith("**"))
                return <strong key={j} className="font-semibold text-[var(--text)]">{p.slice(2, -2)}</strong>;
              if (p.startsWith("*") && p.endsWith("*")) return <em key={j}>{p.slice(1, -1)}</em>;
              return <React.Fragment key={j}>{p}</React.Fragment>;
            })}
          </p>
        );
      })}
    </>
  );
}

/* ================= Adjuntos: tipos aceptados e iconos ================= */
const ACCEPT_ATTR = [
  "image/*",
  ".pdf", ".docx", ".xlsx", ".xlsm", ".pptx",
  ".txt", ".md", ".csv", ".tsv", ".json", ".xml", ".html",
  ".js", ".ts", ".py", ".java", ".c", ".cpp", ".sql",
].join(",");

function FileTypeIcon({ name }: { name: string }) {
  const ext = extensionOf(name);
  if (["xlsx", "xlsm", "csv", "tsv"].includes(ext))
    return <FileSpreadsheet size={20} className="text-emerald-600" />;
  if (ext === "pptx") return <Presentation size={20} className="text-orange-600" />;
  if (ext === "pdf") return <FileText size={20} className="text-red-600" />;
  if (ext === "docx") return <FileText size={20} className="text-blue-600" />;
  return <FileIcon size={20} className="text-[var(--text-3)]" />;
}

/* ================= CHAT PAGE ================= */
export default function ChatPage() {
  const { user, initializing, logout } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  // null en los archivos que no son imágenes: para esos se muestra un icono.
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const streamTimer = useRef<number | null>(null);

  // Cargar diagnóstico del servidor + historial desde MongoDB
  const loadAll = async (forceHealth = false) => {
    if (!user) return;
    setLoadingHistory(true);
    const h = await getHealth(forceHealth);
    setHealth(h);
    if (h.ok) {
      try {
        const convos = await getConversations(user);
        setConversations(convos);
        setActiveId((cur) => cur ?? convos[0]?.id ?? null);
        if (forceHealth) toast.success("Conectado con MIMIR en la nube");
      } catch (e) {
        toast.error(formatApiError(e));
      }
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      await loadAll();
      if (!alive) return;
      // Si la landing envió una pregunta ("Empieza ahora"), dejarla lista en el input
      const prefill = sessionStorage.getItem("mimir_first_prompt");
      if (prefill) {
        sessionStorage.removeItem("mimir_first_prompt");
        setInput(prefill);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, thinking, activeId]);

  useEffect(() => {
    return () => {
      if (streamTimer.current) window.clearInterval(streamTimer.current);
    };
  }, []);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  if (!initializing && !user) return <Navigate to="/" replace />;

  const patchConvo = (id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  };

  const handleNew = async () => {
    if (!user) return;
    try {
      console.log('[ChatPage] Creando nueva conversación...');
      const c = await createConversation(user);
      console.log('[ChatPage] Conversación creada:', c.id);
      setConversations((prev) => [c, ...prev]);
      setActiveId(c.id);
      setSidebarOpen(false);
      setInput("");
    } catch (err) {
      console.error('[ChatPage] Error al crear conversación:', err);
      const errorMsg = formatApiError(err);
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;
    try {
      await deleteConversation(user, id);
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
      toast.success("Conversación eliminada");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const retryConnection = () => loadAll(true);

  // Manejo de archivos (imágenes, PDFs, Word, Excel)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    // Limpiar el input para poder volver a elegir el mismo archivo
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (picked.length === 0) return;

    // 1. Descartar lo que no se puede leer o pasa de 20 MB, avisando del motivo
    for (const f of picked.filter((x) => fileRejectionReason(x)).slice(0, 3)) {
      toast.error(`No puedo usar ${f.name}: ${fileRejectionReason(f)}.`);
    }
    const usable = picked.filter((f) => !fileRejectionReason(f));
    if (usable.length === 0) return;

    // 2. Respetar los cupos: 5 fotos y 5 documentos por carga
    const currentImages = selectedImages.filter(isImageFile).length;
    const currentDocs = selectedImages.length - currentImages;

    const accepted: File[] = [];
    let imageRoom = MAX_IMAGES - currentImages;
    let docRoom = MAX_DOCUMENTS - currentDocs;
    let droppedImages = 0;
    let droppedDocs = 0;

    for (const f of usable) {
      if (isImageFile(f)) {
        if (imageRoom > 0) { accepted.push(f); imageRoom--; } else droppedImages++;
      } else {
        if (docRoom > 0) { accepted.push(f); docRoom--; } else droppedDocs++;
      }
    }
    if (droppedImages > 0) toast.error(`Máximo ${MAX_IMAGES} fotos por carga.`);
    if (droppedDocs > 0) toast.error(`Máximo ${MAX_DOCUMENTS} documentos por carga.`);
    if (accepted.length === 0) return;

    // 3. Miniatura para las fotos; los documentos van con icono (null)
    const previews = await Promise.all(
      accepted.map((file) =>
        isImageFile(file)
          ? new Promise<string | null>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            })
          : Promise.resolve<string | null>(null)
      )
    );

    setSelectedImages((prev) => [...prev, ...accepted]);
    setImagePreviews((prev) => [...prev, ...previews]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => {
    setSelectedImages([]);
    setImagePreviews([]);
  };

  const typewriter = (convoId: string, msgId: string, full: string, meta: Partial<ChatMessage>) => {
    const words = full.split(/(\s+)/);
    let i = 0;
    let acc = "";
    // Si quedaba una animación en curso, detenerla antes de arrancar otra.
    if (streamTimer.current) {
      window.clearInterval(streamTimer.current);
      streamTimer.current = null;
    }
    setStreamingId(msgId);
    streamTimer.current = window.setInterval(() => {
      for (let k = 0; k < 4; k++) {
        if (i < words.length) {
          acc += words[i];
          i++;
        }
      }
      patchConvo(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === msgId ? { ...m, content: acc } : m)),
      }));
      if (i >= words.length) {
        if (streamTimer.current) window.clearInterval(streamTimer.current);
        streamTimer.current = null;
        patchConvo(convoId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === msgId ? { ...m, content: full, ...meta } : m)),
        }));
        setStreamingId(null);
      }
    }, 26);
  };

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if ((!text && selectedImages.length === 0) || thinking || !user) return;
    setInput("");

    let convoId = activeId;
    if (!convoId) {
      try {
        console.log('[ChatPage] No hay conversación activa, creando una...');
        const c = await createConversation(user);
        console.log('[ChatPage] Conversación creada automáticamente:', c.id);
        setConversations((prev) => [c, ...prev]);
        convoId = c.id;
        setActiveId(c.id);
      } catch (err) {
        console.error('[ChatPage] Error al crear conversación automática:', err);
        const errorMsg = formatApiError(err);
        toast.error(`No se pudo iniciar la conversación: ${errorMsg}`);
        return;
      }
    }
    const targetId = convoId;

    // Capturar imágenes antes de limpiar
    const imagesToSend = [...selectedImages];
    clearImages();

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      at: Date.now(),
      ...(imagesToSend.length
        ? { files: imagesToSend.map((f) => ({ name: f.name, type: f.type })) }
        : {}),
    };
    const asstId = uid();
    patchConvo(targetId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 48) + (text.length > 48 ? "…" : "") : c.title,
      updatedAt: Date.now(),
      messages: [...c.messages, userMsg, { role: "assistant", content: "", at: Date.now() } as ChatMessage],
    }));
    // Marcador temporal con id para el typewriter
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== targetId) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1] as ChatMessage & { id?: string };
        msgs[msgs.length - 1] = { ...last, id: asstId };
        return { ...c, messages: msgs };
      })
    );

    setThinking(true);
    try {
      console.log('[ChatPage] Enviando mensaje a la API...');
      const reply = await sendMessage(user, targetId, text, imagesToSend.length > 0 ? imagesToSend : undefined);
      console.log('[ChatPage] Respuesta recibida de la API:', {
        textLength: reply.text?.length,
        sourcesCount: reply.sources?.length,
        followUpsCount: reply.followUps?.length,
        fromCache: reply.fromCache
      });
      setThinking(false);
      for (const a of (reply.attachments || []).filter((x) => !x.ok).slice(0, 3)) {
        toast.error(`${a.name}: ${a.error}`);
      }
      typewriter(targetId, asstId, reply.text, {
        sources: reply.sources,
        followUps: reply.followUps,
        fromCache: reply.fromCache,
        model: reply.model,
      });
    } catch (err) {
      setThinking(false);
      let detalle = "Ups, algo salió mal al consultar. Inténtalo de nuevo en unos segundos.";
      
      if (err instanceof Error) {
        detalle = err.message;
        
        // Intentar extraer información adicional del error
        try {
          const errData = JSON.parse(err.message);
          if (errData.error) detalle = errData.error;
          if (errData.suggestion) detalle += `\n\n💡 ${errData.suggestion}`;
          if (errData.model) detalle += `\n\nModelo usado: ${errData.model}`;
        } catch {
          // No es JSON, usar el mensaje tal cual
        }
      }
      
      patchConvo(targetId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          (m as ChatMessage & { id?: string }).id === asstId ? { ...m, content: `⚠️ ${detalle}` } : m
        ),
      }));
      setStreamingId(null);
      toast.error("No se pudo obtener la respuesta");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const busy = thinking || streamingId !== null;

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] font-body text-[var(--text)]">
      {/* ===== Barra superior ===== */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text)] md:hidden"
            aria-label="Menú"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]">
              <img src={LOGO} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">
              MIMIR <span className="text-[var(--brand-text)]">IA</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 text-sm text-[var(--text-2)] md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold uppercase text-white">
              {user?.username?.slice(0, 1)}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-[var(--text)]">{user?.username}</span>
              <span className="font-mono text-[10px] text-[var(--amber)]">{user?.id}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== Sidebar ===== */}
        <aside
          className={`absolute inset-y-0 left-0 z-40 w-72 transform border-r border-[var(--border)] bg-[var(--bg)] transition-transform duration-300 md:relative md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--border)] p-4">
              <button
                onClick={handleNew}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--brand-hover)] active:scale-95"
              >
                <Plus size={16} /> Nueva conversación
              </button>
            </div>
            <div className="flex-1 overflow-y-auto chat-scroll p-3">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8 text-sm text-[var(--text-3)]">
                  <Loader2 size={16} className="animate-spin" /> Cargando…
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-[var(--text-3)]">
                  <MessageSquare size={24} className="opacity-40" />
                  <p>Sin conversaciones aún</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className={`group flex w-full items-center gap-2 rounded-lg px-1 text-sm transition-colors ${
                        activeId === c.id
                          ? "bg-[var(--bg-soft)] text-[var(--text)]"
                          : "text-[var(--text-2)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(c.id);
                          setSidebarOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left"
                      >
                        <MessageSquare size={14} className="shrink-0 opacity-60" />
                        <span className="flex-1 truncate">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(c.id, e)}
                        className="mr-1 shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-[var(--bg)] focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Eliminar ${c.title}`}
                      >
                        <Trash2 size={12} className="text-[var(--text-3)] hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-[var(--border)] p-3 text-xs text-[var(--text-3)]">
              <div className="flex items-center gap-2">
                {health?.ok ? (
                  <>
                    <Wifi size={12} className="text-[var(--brand-text)]" />
                    <span>Conectado · GPT-5 + MongoDB</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={12} className="text-red-500" />
                    <span>Sin conexión al servidor</span>
                  </>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Sparkles size={11} className="text-[var(--amber)]" />
                <span>Estudiante {user?.id}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ===== Área de chat ===== */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              {health && !health.ok ? (
                <>
                  <AlertTriangle size={48} className="text-red-500" />
                  <h1 className="font-display text-2xl font-semibold tracking-tight">
                    MIMIR no está en línea
                  </h1>
                  <p className="max-w-md text-sm text-[var(--text-2)]">
                    {health.mongoError || "No se pudo conectar con el servidor."}
                  </p>
                  <button
                    onClick={retryConnection}
                    className="flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--brand-hover)] active:scale-95"
                  >
                    <RefreshCw size={15} className={loadingHistory ? "animate-spin" : ""} /> Reintentar
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)] shadow-[0_10px_30px_var(--shadow-brand)]">
                    <img src={LOGO} alt="" className="h-full w-full object-cover" />
                  </span>
                  <h1 className="font-display text-2xl font-semibold tracking-tight">
                    Bienvenido a MIMIR IA
                  </h1>
                  <p className="max-w-md text-sm text-[var(--text-2)]">
                    Tu tutor personal con fuentes verificadas. Haz una pregunta para comenzar.
                  </p>
                  <button
                    onClick={handleNew}
                    className="flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--brand-hover)] active:scale-95"
                  >
                    <Plus size={15} /> Nueva conversación
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Header de conversación */}
              <div className="border-b border-[var(--border)] px-4 py-3 md:px-6">
                <h2 className="truncate text-sm font-medium text-[var(--text)]">{active.title}</h2>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto chat-scroll">
                {active.messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]">
                      <img src={LOGO} alt="" className="h-full w-full object-cover" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold tracking-tight">
                        ¿En qué te ayudo hoy?
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-2)]">
                        Pregúntame lo que necesites entender.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8">
                    {active.messages.map((m, i) =>
                      m.role === "user" ? (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-[var(--brand)] px-4 py-2.5 text-sm text-white">
                            {m.files && m.files.length > 0 && (
                              <div className="mb-1.5 flex flex-wrap gap-1">
                                {m.files.map((f, k) => (
                                  <span
                                    key={k}
                                    className="flex max-w-[180px] items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]"
                                  >
                                    <Paperclip size={10} className="shrink-0" />
                                    <span className="truncate">{f.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {m.content}
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="flex gap-3">
                          <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]">
                            <img src={LOGO} alt="" className="h-full w-full object-cover" />
                          </span>
                          <div className="max-w-[90%] min-w-0">
                            <div className="rounded-2xl rounded-tl-md border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-2)]">
                              {m.content ? (
                                <RichText text={m.content} />
                              ) : (
                                <span className="flex items-center gap-1.5 py-1">
                                  <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--brand)]" />
                                  <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--brand)]" />
                                  <span className="thinking-dot h-2 w-2 rounded-full bg-[var(--brand)]" />
                                </span>
                              )}
                              {m.sources && m.sources.length > 0 && m.content && (
                                <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
                                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--brand-text)]">
                                    <Globe size={11} /> Fuentes citadas
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {m.sources.map((s, j) => (
                                      <a
                                        key={j}
                                        href={s.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
                                      >
                                        {s.label} <ExternalLink size={10} />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {m.fromCache && m.content && streamingId === null && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                                <Zap size={10} className="text-[var(--amber)]" />
                                Respuesta guardada en caché · no se gastaron tokens
                              </div>
                            )}
                            {m.followUps && m.followUps.length > 0 && streamingId === null && i === active.messages.length - 1 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {m.followUps.map((f, j) => (
                                  <button
                                    key={j}
                                    onClick={() => handleSend(f)}
                                    disabled={busy}
                                    className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand-text)] disabled:opacity-50"
                                  >
                                    <Compass size={11} className="text-[var(--amber)]" /> {f}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                    {thinking && (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]">
                          <img src={LOGO} alt="" className="h-full w-full object-cover" />
                        </span>
                        <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-3)]">
                          <Loader2 size={13} className="animate-spin text-[var(--brand-text)]" />
                          MIMIR está consultando fuentes…
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* ===== Input ===== */}
              <div className="relative border-t border-[var(--border)] bg-[var(--bg)]/90 p-3 backdrop-blur md:p-4">
                {/* Input file oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Adjuntos: miniatura si es foto, icono con su nombre si es documento */}
                {selectedImages.length > 0 && (
                  <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
                    {selectedImages.map((file, index) => {
                      const preview = imagePreviews[index];
                      return (
                        <div key={`${file.name}-${index}`} className="group relative">
                          {preview ? (
                            <img
                              src={preview}
                              alt={file.name}
                              title={`${file.name} · ${formatBytes(file.size)}`}
                              className="h-20 w-20 rounded-lg border border-[var(--border)] object-cover"
                            />
                          ) : (
                            <div
                              title={`${file.name} · ${formatBytes(file.size)}`}
                              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] p-1.5 text-[var(--text-2)]"
                            >
                              <FileTypeIcon name={file.name} />
                              <span className="w-full truncate text-center text-[9px] leading-tight">{file.name}</span>
                              <span className="text-[8px] text-[var(--text-3)]">{formatBytes(file.size)}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-110"
                            aria-label={`Quitar ${file.name}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {selectedImages.length > 1 && (
                      <button
                        type="button"
                        onClick={clearImages}
                        className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-3)] transition-colors hover:border-red-400 hover:text-red-400"
                      >
                        Limpiar todo
                      </button>
                    )}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 transition-colors focus-within:border-[var(--brand)]"
                >
                  {/* Botón de adjuntar archivos */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || selectedImages.length >= MAX_IMAGES + MAX_DOCUMENTS}
                    aria-label="Adjuntar archivo"
                    title={`Adjuntar fotos, PDF, Word, Excel o PowerPoint (máx. ${MAX_IMAGES} fotos y ${MAX_DOCUMENTS} documentos, ${formatBytes(MAX_FILE_BYTES)} c/u)`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--brand-text)] disabled:opacity-40"
                  >
                    <Paperclip size={18} />
                  </button>

                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={selectedImages.length > 0 ? "Agrega un mensaje o envía los archivos…" : "Escribe tu pregunta… (ej. ¿Qué es la fotosíntesis?)"}
                    data-testid="chat-input"
                    className="h-10 min-w-0 flex-1 bg-transparent px-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
                  />
                  <button
                    type="submit"
                    disabled={busy || (!input.trim() && selectedImages.length === 0)}
                    data-testid="chat-send"
                    aria-label="Enviar"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white transition-all hover:bg-[var(--brand-hover)] active:scale-90 disabled:opacity-40"
                  >
                    {thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>
                <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-[var(--text-3)]">
                  MIMIR puede analizar fotos, PDF, Word, Excel y PowerPoint (hasta 20 MB y 5 fotos por carga). Verifica siempre las fuentes citadas.
                </p>
              </div>
            </>
          )}
        </main>
      </div>

      <Toaster position="top-center" richColors />
    </div>
  );
}
