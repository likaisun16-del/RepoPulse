export default function Loading() {
  return (
    <main className="loading-page shell" aria-label="页面加载中">
      <div className="skeleton wide" />
      <div className="skeleton medium" />
      <div className="skeleton panel" />
    </main>
  );
}

