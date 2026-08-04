import { STATE_LABELS } from '../lib/constants.js';

export function Status({ value }) { return <span className={`badge ${value}`}>{STATE_LABELS[value] || value}</span>; }
export function Stat({ label, value }) { return <section className="stat"><span>{label}</span><strong>{value}</strong></section>; }
export function Chart({ title, data, label }) { const max = Math.max(1, ...data.map((x) => Number(x.so_luong))); return <section className="panel chart"><h3>{title}</h3>{data.length ? data.map((x) => <div className="bar-row" key={x[label]}><span title={x[label]}>{STATE_LABELS[x[label]] || x[label]}</span><i><b style={{ width: `${(Number(x.so_luong) / max) * 100}%` }} /></i><em>{x.so_luong}</em></div>) : <p className="empty">Chưa có dữ liệu.</p>}</section>; }
