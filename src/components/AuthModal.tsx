import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Fingerprint, Loader2, Lock, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "./ui";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";
import { LOGO } from "../lib/assets";
import { toast } from "sonner";

function LogoCircle({ size = 48 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-full bg-[var(--brand)]"
      style={{ width: size, height: size }}
    >
      <img src={LOGO} alt="" className="h-full w-full object-cover" />
    </span>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  testid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  testid: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </Label>
      <div className="relative">
        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <Input
          id={id}
          data-testid={testid}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          minLength={6}
          className="h-11 rounded-full border-[var(--border)] pl-9 pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          data-testid={`${testid}-toggle`}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] transition-colors hover:text-[var(--brand-text)]"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

export function AuthModal({
  open,
  onOpenChange,
  defaultMode = "login",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "login" | "register";
}) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setUsername("");
      setPassword("");
      setConfirm("");
      setShowPass(false);
      setShowConfirm(false);
      setError("");
      setLoading(false);
    }
  }, [open, defaultMode]);

  const isLogin = mode === "login";

  const resetFields = () => {
    setPassword("");
    setConfirm("");
    setError("");
    setShowPass(false);
    setShowConfirm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin) {
      if (password !== confirm) {
        setError("Las contraseñas no coinciden. Verifica que escribiste la misma en ambos campos.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const u = await login(username, password);
        toast.success(`Bienvenido de nuevo, ${u.username}`, {
          description: `Sesión iniciada · ID ${u.id}`,
        });
      } else {
        const u = await register(username, password);
        toast.success(`Cuenta creada · Tu ID es ${u.id}`, {
          description: "Este ID vincula todo tu historial de chats con MIMIR.",
        });
      }
      onOpenChange(false);
      navigate("/chat");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="auth-modal" className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-3 flex justify-center">
            <LogoCircle size={52} />
          </div>
          <DialogTitle className="text-center font-display text-2xl">
            {isLogin ? "Inicia sesión" : "Crea tu cuenta"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isLogin ? "Accede con tu nombre de usuario" : "Únete a MIMIR IA. Es gratis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs uppercase tracking-wider text-[var(--text-3)]">
              Nombre de usuario
            </Label>
            <div className="relative">
              <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <Input
                id="username"
                data-testid="auth-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre"
                required
                minLength={2}
                className="h-11 rounded-full border-[var(--border)] pl-9"
              />
            </div>
          </div>

          <PasswordField
            id="password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            placeholder={isLogin ? "Tu contraseña" : "Mínimo 6 caracteres"}
            visible={showPass}
            onToggle={() => setShowPass((v) => !v)}
            testid="auth-password-input"
          />

          {!isLogin && (
            <>
              <PasswordField
                id="confirm-password"
                label="Repite tu contraseña"
                value={confirm}
                onChange={setConfirm}
                placeholder="Escríbela otra vez"
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
                testid="auth-confirm-input"
              />
              <div className="flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-soft)] p-3 text-xs leading-relaxed text-[var(--text-2)]">
                <Fingerprint size={15} className="mt-0.5 shrink-0 text-[var(--brand-text)]" />
                <span>
                  Al crear tu cuenta se te asignará un <strong className="font-mono text-[var(--brand-text)]">ID único (ej. #001)</strong>{" "}
                  guardado en la base de datos. Ese ID vincula todo tu historial de conversaciones con MIMIR.
                </span>
              </div>
            </>
          )}

          {error && (
            <div
              data-testid="auth-error"
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            data-testid="auth-submit-button"
            disabled={loading}
            className="mt-2 h-11 w-full rounded-full bg-[var(--brand)] font-medium text-white hover:bg-[var(--brand-hover)]"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isLogin ? (
              "Iniciar sesión"
            ) : (
              "Crear cuenta"
            )}
          </Button>
        </form>

        <div className="pt-2 text-center text-sm text-[var(--text-3)]">
          {isLogin ? (
            <>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                data-testid="auth-switch-register"
                onClick={() => {
                  resetFields();
                  setMode("register");
                }}
                className="font-medium text-[var(--brand-text)] hover:underline"
              >
                Regístrate
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                data-testid="auth-switch-login"
                onClick={() => {
                  resetFields();
                  setMode("login");
                }}
                className="font-medium text-[var(--brand-text)] hover:underline"
              >
                Inicia sesión
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
