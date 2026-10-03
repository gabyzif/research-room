export function isRecoverableDatabaseConnectionError(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  const message = [String(error), error instanceof Error ? error.name : "", error instanceof Error ? error.message : "", String(cause ?? "")].join(" ");
  return /P1001|P1002|P1008|P1017|ECONNREFUSED|ETIMEDOUT|Connection terminated|database server/i.test(message);
}
