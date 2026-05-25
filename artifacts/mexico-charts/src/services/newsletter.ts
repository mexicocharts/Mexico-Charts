export type NewsletterSource = "home" | "touring" | "site";

interface SubscribeResponse {
  ok?: boolean;
  error?: string;
}

export async function subscribeToNewsletter(email: string, source: NewsletterSource) {
  const res = await fetch("/api/newsletter/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source }),
  });

  const data = await res.json().catch(() => ({})) as SubscribeResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo guardar el correo");
  }
}

