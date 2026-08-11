export default function Loading(){
  return <main className="route-loading" aria-busy="true" aria-label="در حال آماده‌سازی صفحه">
    <div className="route-progress" aria-hidden="true"><i/></div>
    <section className="route-skeleton" aria-hidden="true">
      <div><span/><strong/><p/><p/><b/></div>
      <aside/>
    </section>
    <span className="sr-only">در حال آماده‌سازی صفحه…</span>
  </main>;
}
