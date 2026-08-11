import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/react";
import { useLanguage } from "@/i18n/LanguageContext";

type MexicoAuth = {
  configured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  displayName: string | null;
  imageUrl: string | null;
  openSignIn: () => void;
  openSignUp: () => void;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const disabledAuth: MexicoAuth = {
  configured: false,
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  displayName: null,
  imageUrl: null,
  openSignIn: () => undefined,
  openSignUp: () => undefined,
  signOut: async () => undefined,
  getToken: async () => null,
};

const AuthContext = createContext<MexicoAuth>(disabledAuth);

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const { openSignIn, openSignUp, signOut } = useClerk();
  const value: MexicoAuth = {
    configured: true,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    userId: userId ?? null,
    displayName: user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? null,
    imageUrl: user?.imageUrl ?? null,
    openSignIn: () => openSignIn({}),
    openSignUp: () => openSignUp({}),
    signOut: async () => { await signOut(); },
    getToken: async () => getToken(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
  const { language } = useLanguage();
  const localization = useMemo(() => {
    const emailCodeSubtitle = language === "es"
      ? "Enviamos un código a tu correo. Si no lo ves, revisa Spam, Correo no deseado o Promociones."
      : "We sent a code to your email. If you don't see it, check Spam, Junk, or Promotions.";

    return {
      signIn: { emailCode: { subtitle: emailCodeSubtitle } },
      signUp: { emailCode: { subtitle: emailCodeSubtitle } },
    };
  }, [language]);

  if (!publishableKey) {
    return <AuthContext.Provider value={disabledAuth}>{children}</AuthContext.Provider>;
  }
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      localization={localization}
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function useMexicoAuth() {
  return useContext(AuthContext);
}

export async function authenticatedFetch(
  getToken: MexicoAuth["getToken"],
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
