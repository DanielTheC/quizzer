export function AdminAccessDenied() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-2xl uppercase text-quizzer-black">Access denied</h1>
        <p className="mt-4 text-sm text-quizzer-black/75">
          You don&apos;t have access to this area. If you think this is a mistake, contact your organisation administrator.
        </p>
      </div>
    </main>
  );
}
