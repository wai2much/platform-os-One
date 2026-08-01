import { useState } from 'react';
import { useStore } from '@/core/store';

/**
 * Suppliers — workshop pack. Simple directory table, backed by the store's
 * real suppliers table (see supabase/schema.sql Phase 3).
 */
const COLS = '2fr 1.2fr 1.2fr 1.4fr 1fr';
const inp = { background: 'var(--panel-bg)', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'Zen Kaku Gothic New, sans-serif', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' };

function NewSupplierModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', suburb: '', phone: '', website: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="fold fold-lg" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 0, padding: 26, width: 380 }}>
        <div className="cap" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 16 }}>New supplier</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input autoFocus value={form.name} onChange={set('name')} placeholder="Supplier name" style={inp} />
          <input value={form.suburb} onChange={set('suburb')} placeholder="Suburb" style={inp} />
          <input value={form.phone} onChange={set('phone')} placeholder="Phone" style={inp} />
          <input value={form.website} onChange={set('website')} placeholder="Website" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <span className="fg" onClick={() => form.name.trim() && onCreate(form)}
            style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: form.name.trim() ? 'var(--vermillion)' : 'var(--panel-bg)', borderRadius: 999, padding: '9px 18px', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>
            Add supplier
          </span>
          <span className="fg" onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)', border: '1.5px solid var(--border-c)', borderRadius: 999, padding: '9px 18px', cursor: 'pointer' }}>Cancel</span>
        </div>
      </div>
    </div>
  );
}

export function Suppliers() {
  const { suppliers, addSupplier } = useStore();
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ padding: '6px 30px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16 }}>
        <span className="fg" style={{ color: 'var(--text-mute)', fontSize: 13, fontWeight: 500 }}>{suppliers.length} suppliers</span>
        <span style={{ flex: 1 }} />
        <span onClick={() => setCreating(true)} className="fg" style={{ fontSize: 12, fontWeight: 700, background: 'var(--vermillion)', color: '#fff', borderRadius: 999, padding: '8px 18px', cursor: 'pointer' }}>+ New supplier</span>
      </div>
      <div className="fold" style={{ background: 'var(--card-bg)', borderRadius: 0, overflowX: 'auto', boxShadow: '0 1px 3px rgba(32,30,29,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 20px', minWidth: 640 }}>
          {['SUPPLIER', 'SUBURB', 'PHONE', 'WEBSITE', ''].map((h) => <span key={h} className="fg" style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--text-mute2)', fontWeight: 700 }}>{h}</span>)}
        </div>
        {suppliers.map((sp) => (
          <div key={sp.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '13px 20px', borderTop: '1px solid var(--border-c)', alignItems: 'center', minWidth: 640 }}>
            <span className="fg" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{sp.name}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{sp.suburb}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{sp.phone}</span>
            <span className="fg" style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>{sp.website}</span>
            <span className="fg" style={{ fontSize: 11, fontWeight: 700, color: 'var(--vermillion)', cursor: 'pointer', justifySelf: 'end' }}>Call</span>
          </div>
        ))}
      </div>

      {creating && <NewSupplierModal onClose={() => setCreating(false)} onCreate={(form) => { addSupplier(form); setCreating(false); }} />}
    </div>
  );
}
