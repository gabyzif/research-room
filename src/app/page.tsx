import { ProjectForm } from "@/components/project-form";
import { auth } from "@/auth";
import { listConnectedProviders } from "@/lib/models/credentials";
import { type ProviderId } from "@/components/api-credentials-settings";

export default async function HomePage() {
  const session = await auth();
  const connectedProviders: ProviderId[] = session?.user?.id
    ? ((await listConnectedProviders(session.user.id)) as ProviderId[])
    : [];
  return (
    <main className="app-shell min-h-screen px-6 py-16">
      <section className="mx-auto max-w-6xl">
        <ProjectForm
          authenticated={Boolean(session?.user)}
          userEmail={session?.user?.email ?? undefined}
          connectedProviders={connectedProviders}
        />
      </section>
    </main>
  );
}
