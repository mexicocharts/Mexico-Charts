import { Component, type ReactNode } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

type RouteErrorBoundaryProps = { children: ReactNode; fallback: ReactNode };

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function RouteRecoveryState() {
  const { pick } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white" role="alert" aria-labelledby="route-recovery-heading">
      <div className="max-w-md text-center">
        <p className="text-sm font-black uppercase tracking-widest text-[#39FF14]">Mexico Charts</p>
        <h1 id="route-recovery-heading" className="mt-6 text-2xl font-bold">
          {pick("No se pudo mostrar esta página.", "This page couldn’t be displayed.")}
        </h1>
        <p className="mt-4 text-sm text-zinc-300">
          {pick("Vuelve a cargarla para intentarlo de nuevo. Los cambios sin guardar podrían perderse.", "Reload the page to try again. Unsaved changes may be lost.")}
        </p>
        <button type="button" className="mt-6 rounded-md bg-[#39FF14] px-5 py-3 font-bold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" onClick={() => window.location.reload()}>
          {pick("Recargar la página", "Reload page")}
        </button>
      </div>
    </main>
  );
}
