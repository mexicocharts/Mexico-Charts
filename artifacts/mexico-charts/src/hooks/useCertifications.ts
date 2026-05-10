import { useState, useEffect } from "react";

export type CertRow = {
  artista: string;
  titulo: string;
  disquera: string;
  formato: string;
  certificacion: string;
  nivel: string;
  fechaISO: string;
  year: number;
  diamante: number;
  platino: number;
  oro: number;
  totalLevels: number;
};

let _cache: CertRow[] | null = null;
let _promise: Promise<CertRow[]> | null = null;

function load(): Promise<CertRow[]> {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = fetch(`${import.meta.env.BASE_URL}certifications.json`)
    .then(r => r.json())
    .then((d: { rows: CertRow[] }) => { _cache = d.rows ?? []; return _cache!; })
    .catch(() => { _cache = []; return _cache!; });
  return _promise;
}

export function useCertifications() {
  const [rows, setRows] = useState<CertRow[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setRows(_cache); setLoading(false); return; }
    load().then(r => { setRows(r); setLoading(false); });
  }, []);

  return { rows, loading };
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"()]/g, "")
    .trim();
}

export function artistMatches(field: string, target: string): boolean {
  const normField = normalize(field);
  const normTarget = normalize(target);
  if (!normTarget || normTarget.length < 2) return false;
  const escaped = normTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[,&/\\s])${escaped}($|[,&/\\s])`, "i");
  return pattern.test(` ${normField} `);
}
