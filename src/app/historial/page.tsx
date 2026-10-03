import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isRecoverableDatabaseConnectionError } from "@/lib/db-errors";
import { ConnectionRecovery } from "@/components/connection-recovery";
import { HistorialView } from "@/components/history-list";

export default async function HistorialPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, brief: true, createdAt: true, updatedAt: true },
    });
    return (
      <main className="app-shell-wide min-h-screen px-4 py-6 lg:px-8">
        <HistorialView projects={projects.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() }))} />
      </main>
    );
  } catch (error) {
    if (isRecoverableDatabaseConnectionError(error)) return <ConnectionRecovery />;
    throw error;
  }
}
