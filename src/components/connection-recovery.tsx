"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function ConnectionRecovery() {
  const router = useRouter();

  return <main className="connection-recovery"><section className="connection-recovery-card" role="alert" aria-labelledby="connection-recovery-title"><div className="connection-recovery-mark" aria-hidden="true">↻</div><p className="eyebrow">Research Room</p><h1 id="connection-recovery-title">No pudimos abrir esta sala.</h1><p>Hubo un problema temporal para conectar con la base de datos. Tu sesión de Google o GitHub no es el problema.</p><div className="connection-recovery-actions"><button type="button" className="primary-button" onClick={() => router.refresh()}>Reintentar conexión</button><Link className="secondary-button" href="/">Volver al inicio</Link></div><p className="connection-recovery-help">Esperá unos segundos y tocá “Reintentar”. Si el problema persiste, avisale al equipo.</p></section></main>;
}
