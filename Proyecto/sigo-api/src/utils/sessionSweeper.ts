/**
 * Mantener sesiones operativas activas en segundo plano:
 * Las sesiones de patrullas reales NO se cierran automáticamente cuando el teléfono
 * se bloquea o cuando el funcionario cierra la ventana de la aplicación.
 * La sesión permanece activa y visible en el mapa hasta que el funcionario
 * cierre sesión explícitamente (POST /api/v1/auth/logout).
 */
export async function sweepStaleSessions(): Promise<void> {
  // No-op intencional: las sesiones permanecen activas en 2do plano hasta logout explícito.
}

export function startSessionSweeper(): void {
  // Desactivado para garantizar persistencia 24/7 en segundo plano hasta cierre de sesión.
}
