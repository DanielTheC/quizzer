/**
 * Studio is shown full-viewport so it isn't cramped by the site nav/footer.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-white" style={{ minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
