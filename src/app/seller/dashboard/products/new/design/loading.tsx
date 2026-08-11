export default function DesignLoading(){
  return <main className="design-loading" aria-busy="true" aria-label="در حال آماده‌سازی استودیو طراحی">
    <header><i/><span/><span/><b/></header>
    <aside>{[0,1,2,3,4,5].map(item=><i key={item}/>)}</aside>
    <section><div><i/><span>استودیو طراحی در حال آماده‌شدن است…</span></div></section>
    <footer><i/><i/><i/></footer>
  </main>;
}
