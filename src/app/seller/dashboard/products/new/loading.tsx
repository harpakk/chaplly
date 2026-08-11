export default function NewProductLoading(){
  return <div className="product-wizard-page product-wizard-loading" aria-busy="true" aria-label="در حال آماده‌سازی ساخت محصول">
    <header className="wizard-head">
      <div>
        <span>ساخت محصول جدید / مرحله ۱</span>
        <h1>انتخاب محصول پایه</h1>
        <p>دسته‌ها و محصولات قابل طراحی در حال آماده‌شدن هستند.</p>
      </div>
    </header>
    <main className="wizard-main" aria-hidden="true">
      <section className="wizard-section">
        <span className="wizard-skeleton-line short"/>
        <div className="wizard-skeleton-line title"/>
        <div className="category-cards">
          {[0,1,2].map(item=><i className="wizard-skeleton-card" key={item}/>)}
        </div>
      </section>
      <section className="wizard-section">
        <span className="wizard-skeleton-line short"/>
        <div className="wizard-skeleton-line title"/>
        <div className="raw-choice-grid">
          {[0,1,2,3].map(item=><i className="wizard-skeleton-product" key={item}/>)}
        </div>
      </section>
    </main>
  </div>;
}
