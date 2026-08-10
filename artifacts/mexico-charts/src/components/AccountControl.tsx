import { Link } from "wouter";
import { LogIn, UserRound } from "lucide-react";
import { useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AccountControl({ mobile = false }: { mobile?: boolean }) {
  const auth = useMexicoAuth();
  const { pick } = useLanguage();

  if (!auth.configured) return null;
  if (!auth.isLoaded) {
    return <span className="h-9 w-9 animate-pulse rounded-full bg-white/[0.06]" aria-label={pick("Cargando cuenta", "Loading account")} />;
  }
  if (auth.isSignedIn) {
    return (
      <Link href="/cuenta" className={mobile ? "flex items-center gap-3 py-4" : "flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2"}>
        {auth.imageUrl ? (
          <img src={auth.imageUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : <UserRound className="h-4 w-4 text-[#39FF14]" />}
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/60">{pick("Mi cuenta", "My account")}</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={auth.openSignIn}
      className={mobile ? "flex w-full items-center gap-3 py-4 text-left" : "flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2"}
    >
      <LogIn className="h-4 w-4 text-[#39FF14]" />
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/60">{pick("Ingresar", "Sign in")}</span>
    </button>
  );
}
