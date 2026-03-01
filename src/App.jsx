import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const COOPERATIVE = [
  "Coop. Friuli",
  "Coop. Bologna",
  "Coop. Pesaro",
  "Coop. Frosinone",
  "Coop. Pescara",
];

const SERVIZI = [
  "Assistenza domiciliare",
  "Supporto educativo",
  "Consulenza psicologica",
  "Formazione sicurezza",
  "Altro",
];

const STATI = ["Nuova", "In carico", "In lavorazione", "Chiusa", "Sospesa"];

const STATO_COLORS = {
  Nuova: { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  "In carico": { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  "In lavorazione": { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  Chiusa: { bg: "#F3F4F6", text: "#374151", dot: "#9CA3AF" },
  Sospesa: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

const oggi = () => new Date().toISOString().split("T")[0];

const DRIVE_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzvg0Yk8xxHqwlIzq_1ReWfjhsBAWtec2eyQIKhUSovGN3fU9lTSEkptp7J1oKad7II/exec";
const DRIVE_WEBAPP_PATH =
  "/macros/s/AKfycbzvg0Yk8xxHqwlIzq_1ReWfjhsBAWtec2eyQIKhUSovGN3fU9lTSEkptp7J1oKad7II/exec";
const DRIVE_ENDPOINT = import.meta.env.DEV
  ? `/gas${DRIVE_WEBAPP_PATH}`
  : DRIVE_WEBAPP_URL;

function normalizeRichiesta(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: String(item.id ?? ""),
    cliente: String(item.cliente ?? ""),
    telefono: String(item.telefono ?? ""),
    email: String(item.email ?? ""),
    servizio: String(item.servizio ?? ""),
    cooperativa: String(item.cooperativa ?? ""),
    stato: String(item.stato ?? "Nuova"),
    data_ingaggio: String(item.data_ingaggio ?? oggi()),
    data_aggiornamento: String(item.data_aggiornamento ?? ""),
    note: String(item.note ?? ""),
    note_avanzamento: String(item.note_avanzamento ?? ""),
    data_creazione: String(item.data_creazione ?? ""),
  };
}

async function loadRichiesteFromDrive() {
  const response = await fetch(DRIVE_ENDPOINT, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Errore caricamento: HTTP ${response.status}`);

  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload
    .map(normalizeRichiesta)
    .filter((item) => item && item.id);
}

async function postRichiestaAction(action, body) {
  const response = await fetch(DRIVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ action, ...body }),
  });
  if (!response.ok) throw new Error(`Errore ${action}: HTTP ${response.status}`);
}

function createRichiestaOnDrive(data) {
  return postRichiestaAction("create", { data });
}

function updateRichiestaOnDrive(data) {
  return postRichiestaAction("update", { data });
}

function deleteRichiestaOnDrive(id) {
  return postRichiestaAction("delete", { id });
}

function generateId() {
  return "RQ-" + Date.now().toString(36).toUpperCase();
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = new Date() - new Date(dateStr);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function App() {
  const [richieste, setRichieste] = useState([]);
  const [view, setView] = useState("lista"); // lista | nuova | email | dettaglio
  const [selected, setSelected] = useState(null);
  const [filterCoop, setFilterCoop] = useState("Tutte");
  const [filterStato, setFilterStato] = useState("Tutti");
  const [emailCoop, setEmailCoop] = useState(COOPERATIVE[0]);
  const [emailText, setEmailText] = useState("");
  const [form, setForm] = useState({
    cliente: "",
    telefono: "",
    email: "",
    servizio: SERVIZI[0],
    cooperativa: COOPERATIVE[0],
    note: "",
    stato: "Nuova",
    data_ingaggio: oggi(),
    data_aggiornamento: "",
    note_avanzamento: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState(null);

  // Load from Google Drive (Apps Script endpoint)
  useEffect(() => {
    async function load() {
      try {
        const data = await loadRichiesteFromDrive();
        setRichieste(data);
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleSubmit = async () => {
    if (!form.cliente.trim()) return showToast("Inserisci il nome del cliente", "err");
    try {
      if (editMode && selected) {
        const updatedRichiesta = { ...selected, ...form, data_aggiornamento: oggi() };
        await updateRichiestaOnDrive(updatedRichiesta);
        const updated = richieste.map((r) => (r.id === selected.id ? updatedRichiesta : r));
        setRichieste(updated);
        showToast("Richiesta aggiornata su Drive");
      } else {
        const nuova = { ...form, id: generateId(), data_creazione: oggi(), data_aggiornamento: oggi() };
        await createRichiestaOnDrive(nuova);
        setRichieste([nuova, ...richieste]);
        showToast("Richiesta registrata su Drive: " + nuova.id);
      }
      setView("lista");
      setEditMode(false);
      setSelected(null);
      setForm({ cliente: "", telefono: "", email: "", servizio: SERVIZI[0], cooperativa: COOPERATIVE[0], note: "", stato: "Nuova", data_ingaggio: oggi(), data_aggiornamento: "", note_avanzamento: "" });
    } catch (e) {
      showToast("Errore nel salvataggio su Drive", "err");
    }
  };

  const openEdit = (r) => {
    setSelected(r);
    setForm({ ...r });
    setEditMode(true);
    setView("nuova");
  };

  const handleDelete = async (id) => {
    try {
      await deleteRichiestaOnDrive(id);
      const updated = richieste.filter((r) => r.id !== id);
      setRichieste(updated);
      showToast("Richiesta eliminata su Drive");
      setView("lista");
    } catch (e) {
      showToast("Errore eliminazione su Drive", "err");
    }
  };

  const aperte = (coop) =>
    richieste.filter(
      (r) => r.cooperativa === coop && r.stato !== "Chiusa"
    );

  const generateEmail = () => {
    const items = aperte(emailCoop);
    if (items.length === 0) {
      setEmailText(`Buongiorno,\n\nnon risultano situazioni aperte per ${emailCoop}.\n\nGrazie.`);
      return;
    }
    const righe = items.map((r, i) => {
      const gg = daysSince(r.data_ingaggio);
      return `  ${i + 1}. ${r.cliente} — ${r.servizio} (${r.stato}, in carico da ${gg} giorni, ID: ${r.id})`;
    }).join("\n");
    setEmailText(
      `Gentile ${emailCoop},\n\ncome da nostra consueta verifica risultano ancora in carico le seguenti ${items.length} situazioni:\n\n${righe}\n\nLa preghiamo di aggiornarci sullo stato di avanzamento di ciascuna.\n\nRestiamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nCustomer Service — Consorzio Parsifal`
    );
  };

  const exportExcel = () => {
    const data = richieste.map((r) => ({
      ID: r.id,
      Cliente: r.cliente,
      Telefono: r.telefono,
      Email: r.email,
      Servizio: r.servizio,
      Cooperativa: r.cooperativa,
      Stato: r.stato,
      "Data ingaggio": r.data_ingaggio,
      "Data aggiornamento": r.data_aggiornamento,
      "Giorni apertura": r.stato !== "Chiusa" ? daysSince(r.data_ingaggio) : "",
      Note: r.note,
      "Note avanzamento": r.note_avanzamento,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = [10, 22, 14, 24, 24, 16, 14, 14, 16, 14, 30, 30];
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Richieste");
    XLSX.writeFile(wb, `Parsifal_Richieste_${oggi()}.xlsx`);
    showToast("Excel esportato con successo");
  };

  const filtered = richieste.filter((r) => {
    const c = filterCoop === "Tutte" || r.cooperativa === filterCoop;
    const s = filterStato === "Tutti" || r.stato === filterStato;
    return c && s;
  });

  const stats = {
    totale: richieste.length,
    aperte: richieste.filter((r) => r.stato !== "Chiusa").length,
    nuove: richieste.filter((r) => r.stato === "Nuova").length,
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "#F8F7F4", color: "#1A1A2E" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; }
        textarea { resize: vertical; }
        input, select, textarea { outline: none; }
        input:focus, select:focus, textarea:focus { border-color: #2D5BE3 !important; box-shadow: 0 0 0 3px rgba(45,91,227,0.12); }
        .row-hover:hover { background: #F0F4FF !important; }
        .btn-primary { background: #2D5BE3; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: inherit; transition: all 0.15s; }
        .btn-primary:hover { background: #1E42C0; transform: translateY(-1px); }
        .btn-ghost { background: transparent; border: 1.5px solid #D1D5DB; color: #374151; padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; font-family: inherit; transition: all 0.15s; }
        .btn-ghost:hover { border-color: #2D5BE3; color: #2D5BE3; background: #F0F4FF; }
        .btn-danger { background: transparent; border: 1.5px solid #FCA5A5; color: #DC2626; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-family: inherit; transition: all 0.15s; }
        .btn-danger:hover { background: #FEF2F2; }
        .chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; display: block; }
        .input { width: 100%; border: 1.5px solid #E5E7EB; border-radius: 8px; padding: 9px 13px; font-size: 14px; font-family: inherit; background: white; color: #1A1A2E; transition: border-color 0.15s; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "err" ? "#DC2626" : "#10B981", color: "white", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "fadeIn 0.2s" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#1A1A2E", color: "white", padding: "0 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 34, height: 34, background: "#2D5BE3", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>Consorzio Parsifal</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>Customer Service — Area Privati</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ id: "lista", label: "📋 Richieste" }, { id: "email", label: "✉️ Email Coop" }].map((v) => (
              <button key={v.id} onClick={() => setView(v.id)} className="btn-ghost" style={{ fontSize: 13, borderColor: view === v.id ? "#2D5BE3" : "rgba(255,255,255,0.2)", color: view === v.id ? "#93C5FD" : "#D1D5DB", background: view === v.id ? "rgba(45,91,227,0.2)" : "transparent" }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* LISTA */}
        {view === "lista" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Totale richieste", val: stats.totale, icon: "📁" },
                { label: "Ancora aperte", val: stats.aperte, icon: "⏳", warn: stats.aperte > 0 },
                { label: "Nuove (non assegnate)", val: stats.nuove, icon: "🆕", warn: stats.nuove > 0 },
              ].map((s) => (
                <div key={s.label} style={{ background: "white", borderRadius: 12, padding: "18px 22px", border: s.warn && s.val > 0 ? "1.5px solid #FCA5A5" : "1.5px solid #E5E7EB", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 28 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: s.warn && s.val > 0 ? "#DC2626" : "#1A1A2E", lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn-primary" onClick={() => { setEditMode(false); setForm({ cliente: "", telefono: "", email: "", servizio: SERVIZI[0], cooperativa: COOPERATIVE[0], note: "", stato: "Nuova", data_ingaggio: oggi(), data_aggiornamento: "", note_avanzamento: "" }); setView("nuova"); }}>
                + Nuova richiesta
              </button>
              <button className="btn-ghost" onClick={exportExcel}>⬇ Esporta Excel</button>
              <div style={{ flex: 1 }} />
              <select className="input" style={{ width: "auto", minWidth: 160 }} value={filterCoop} onChange={(e) => setFilterCoop(e.target.value)}>
                <option>Tutte</option>
                {COOPERATIVE.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select className="input" style={{ width: "auto", minWidth: 140 }} value={filterStato} onChange={(e) => setFilterStato(e.target.value)}>
                <option>Tutti</option>
                {STATI.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Table */}
            <div style={{ background: "white", borderRadius: 12, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1.5px solid #E5E7EB" }}>
                    {["ID", "Cliente", "Servizio", "Cooperativa", "Stato", "Ingaggio", "Giorni", ""].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#6B7280", letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Nessuna richiesta trovata</td></tr>
                  )}
                  {filtered.map((r) => {
                    const gg = daysSince(r.data_ingaggio);
                    const sc = STATO_COLORS[r.stato] || STATO_COLORS["Nuova"];
                    return (
                      <tr key={r.id} className="row-hover" style={{ borderBottom: "1px solid #F3F4F6", transition: "background 0.1s" }}>
                        <td style={{ padding: "10px 14px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6B7280" }}>{r.id}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14 }}>{r.cliente}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "#374151" }}>{r.servizio}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>{r.cooperativa}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span className="chip" style={{ background: sc.bg, color: sc.text }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />
                            {r.stato}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "#6B7280" }}>{r.data_ingaggio}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {r.stato !== "Chiusa" && gg !== null && (
                            <span style={{ fontSize: 13, fontWeight: 600, color: gg > 7 ? "#DC2626" : gg > 3 ? "#D97706" : "#059669" }}>
                              {gg}gg
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => openEdit(r)}>✏️ Gestisci</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* FORM NUOVA/EDIT */}
        {view === "nuova" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button className="btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }} onClick={() => { setView("lista"); setEditMode(false); }}>← Torna</button>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editMode ? `Modifica ${selected?.id}` : "Nuova richiesta"}</h2>
            </div>
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #E5E7EB", padding: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label className="label">Nome cliente *</label>
                  <input className="input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Mario Rossi" />
                </div>
                <div>
                  <label className="label">Telefono</label>
                  <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+39 ..." />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@email.it" />
                </div>
                <div>
                  <label className="label">Servizio richiesto</label>
                  <select className="input" value={form.servizio} onChange={(e) => setForm({ ...form, servizio: e.target.value })}>
                    {SERVIZI.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cooperativa assegnataria</label>
                  <select className="input" value={form.cooperativa} onChange={(e) => setForm({ ...form, cooperativa: e.target.value })}>
                    {COOPERATIVE.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Data ingaggio</label>
                  <input className="input" type="date" value={form.data_ingaggio} onChange={(e) => setForm({ ...form, data_ingaggio: e.target.value })} />
                </div>
                <div>
                  <label className="label">Stato</label>
                  <select className="input" value={form.stato} onChange={(e) => setForm({ ...form, stato: e.target.value })}>
                    {STATI.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label className="label">Note iniziali</label>
                  <textarea className="input" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Dettagli della richiesta..." />
                </div>
                {editMode && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <label className="label">Aggiornamento avanzamento</label>
                    <textarea className="input" rows={3} value={form.note_avanzamento} onChange={(e) => setForm({ ...form, note_avanzamento: e.target.value })} placeholder="Aggiornamento ricevuto dalla cooperativa..." />
                  </div>
                )}
              </div>
              <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "space-between" }}>
                <div>
                  {editMode && <button className="btn-danger" onClick={() => { if (confirm("Eliminare questa richiesta?")) handleDelete(selected.id); }}>🗑 Elimina</button>}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-ghost" onClick={() => { setView("lista"); setEditMode(false); }}>Annulla</button>
                  <button className="btn-primary" onClick={handleSubmit}>{editMode ? "Salva modifiche" : "Registra richiesta"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EMAIL */}
        {view === "email" && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700 }}>✉️ Genera email di sollecito</h2>
            <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #E5E7EB", padding: 28 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 20, alignItems: "end" }}>
                <div>
                  <label className="label">Seleziona cooperativa</label>
                  <select className="input" value={emailCoop} onChange={(e) => setEmailCoop(e.target.value)}>
                    {COOPERATIVE.map((c) => {
                      const n = aperte(c).length;
                      return <option key={c} value={c}>{c} ({n} aperte)</option>;
                    })}
                  </select>
                </div>
                <button className="btn-primary" onClick={generateEmail}>Genera email</button>
              </div>

              {/* Riepilogo situazioni aperte */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Situazioni aperte per {emailCoop}: <span style={{ color: "#DC2626" }}>{aperte(emailCoop).length}</span>
                </div>
                {aperte(emailCoop).length > 0 && (
                  <div style={{ background: "#FEF3C7", borderRadius: 8, padding: "10px 14px", border: "1px solid #FDE68A" }}>
                    {aperte(emailCoop).map((r) => (
                      <div key={r.id} style={{ fontSize: 13, padding: "3px 0", borderBottom: "1px solid #FDE68A", display: "flex", justifyContent: "space-between" }}>
                        <span><b>{r.cliente}</b> — {r.servizio}</span>
                        <span style={{ color: "#92400E" }}>{r.stato} · {daysSince(r.data_ingaggio)}gg</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {emailText && (
                <>
                  <label className="label">Testo email (modificabile)</label>
                  <textarea
                    className="input"
                    rows={14}
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, lineHeight: 1.7 }}
                  />
                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                    <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(emailText); showToast("Email copiata negli appunti"); }}>
                      📋 Copia negli appunti
                    </button>
                    <button className="btn-ghost" onClick={() => {
                      const subject = encodeURIComponent(`Sollecito situazioni in carico — ${emailCoop}`);
                      const body = encodeURIComponent(emailText);
                      window.open(`mailto:?subject=${subject}&body=${body}`);
                    }}>
                      📨 Apri in Mail
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
