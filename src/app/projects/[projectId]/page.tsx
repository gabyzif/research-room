import { ModelWorkbench } from "@/components/model-workbench";
import { ConnectionRecovery } from "@/components/connection-recovery";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isRecoverableDatabaseConnectionError } from "@/lib/db-errors";
import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) redirect("/");
    const { projectId } = await params;
    const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id } });
    const rawModelIds = Array.isArray(project?.selectedModelIds) ? project.selectedModelIds.filter((v): v is string => typeof v === "string") : [];
    const selectedModelIds = [...new Set(rawModelIds)];
    const rawCompanions = Array.isArray(project?.companions) ? project.companions : [];
    if (!project) redirect("/historial");
    return <ModelWorkbench projectId={projectId} initialTitle={project.title} selectedModelIds={selectedModelIds.length >= 2 ? selectedModelIds.slice(0, 2) : ["openai/gpt-4o-mini", "anthropic/claude-sonnet-5"]} initialInstructions={typeof project?.instructions === "string" ? project.instructions : ""} initialCompanions={rawCompanions} userEmail={session.user.email ?? ""} userImage={session.user.image ?? null} />;
  } catch (error) {
    if (isRecoverableDatabaseConnectionError(error)) return <ConnectionRecovery />;
    throw error;
  }
}
