export function DashboardLoading({tone="seller"}:{tone?:"seller"|"supplier"|"admin"|"account"}){
  return <div className={`dashboard-loading dashboard-loading-${tone}`} aria-busy="true" aria-label="در حال آماده‌سازی صفحه">
    <div className="dashboard-loading-head"><i/><div><span/><b/></div></div>
    <div className="dashboard-loading-kpis">{[0,1,2,3].map(item=><i key={item}/>)}</div>
    <div className="dashboard-loading-grid"><section>{[0,1,2,3,4].map(item=><i key={item}/>)}</section><aside/></div>
  </div>;
}
