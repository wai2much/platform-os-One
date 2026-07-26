import { createContext, useContext, useState } from 'react';

/**
 * App store — a lightweight in-memory data layer shared across screens. This is
 * the seam the real backend (v2.5's Supabase engine) plugs into later; for now
 * it wires the front-office → workshop → invoice hand-off end to end.
 */
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const SEED_INVOICES = [
  { id: 'INV-1042', customer: 'T. Nguyen', job: 'Job #J-0412', terms: 'Net 14', dueBy: '26 Jun', status: 'Overdue', amount: 1364, creditHold: true, fromJob: true },
  { id: 'INV-1039', customer: 'M. Petrakis', job: 'Job #J-0409', terms: 'Net 7', dueBy: '22 Jul', status: 'Overdue', amount: 594 },
  { id: 'INV-1051', customer: 'A. Costa', job: 'Job #J-0418', terms: 'Net 30', dueBy: '17 Aug', status: 'Sent', amount: 759, fromJob: true },
  { id: 'INV-1053', customer: 'L. Farrow', job: 'Fleet · Baxter', terms: 'On account', dueBy: '—', status: 'On account', amount: 1232, onAccount: true },
  { id: 'INV-1055', customer: 'S. Bianchi', job: 'Job #J-0421', terms: 'Due on receipt', dueBy: '26 Jul', status: 'Paid', amount: 462 },
];

export const blankJobCard = () => ({
  customer: '', vehicle: '', workTypes: {},
  parts: Array.from({ length: 8 }, () => ({ qty: '', desc: '', partNo: '', unit: '' })),
  labour: '', sundries: '',
});

export const jobCardNet = (jc) => {
  const partsTotal = jc.parts.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unit) || 0), 0);
  return partsTotal + (parseFloat(jc.labour) || 0) + (parseFloat(jc.sundries) || 0);
};

export function StoreProvider({ children }) {
  const [active, setActive] = useState('dashboard');
  const [invoices, setInvoices] = useState(SEED_INVOICES);
  const [jobCard, setJobCard] = useState(blankJobCard());
  const [flash, setFlash] = useState(null); // id of a just-created invoice to highlight

  const updateJobCard = (patch) => setJobCard((jc) => ({ ...jc, ...patch }));

  // Booking/customer → job card (pre-fills the front page, jumps to Inspections).
  const startJobCard = (prefill) => { setJobCard({ ...blankJobCard(), ...prefill }); setActive('inspections'); };

  // Filled job card → invoice (carries parts & labour + GST into Invoices, no re-keying).
  const generateInvoice = () => {
    const net = jobCardNet(jobCard);
    if (net <= 0) return null;
    const amount = Math.round(net * 1.1 * 100) / 100;
    const maxNum = invoices.reduce((m, i) => Math.max(m, parseInt((i.id.match(/\d+/) || ['1055'])[0], 10)), 1055);
    const inv = { id: 'INV-' + (maxNum + 1), customer: jobCard.customer || 'Walk-in', job: 'From job card', terms: 'Due on receipt', dueBy: 'Today', status: 'Sent', amount, fromJob: true };
    setInvoices((list) => [inv, ...list]);
    setFlash(inv.id);
    setJobCard(blankJobCard());
    setActive('invoices');
    return inv;
  };

  return (
    <Ctx.Provider value={{ active, setActive, invoices, setInvoices, jobCard, updateJobCard, startJobCard, generateInvoice, flash, setFlash }}>
      {children}
    </Ctx.Provider>
  );
}
