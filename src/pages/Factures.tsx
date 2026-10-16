import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Printer, 
  Mail, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  RefreshCw,
  Clock,
  ArrowRight,
  Filter,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  Trash2,
  XCircle
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Client, Invoice, InvoiceItem, InvoiceStatus, SectorId } from '../types/index.js';
import { exportElementToImage, exportElementToPdf } from '../utils/exportDocument.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';

export const FacturesPage: React.FC = () => {
  const { user, allowedSectors, isAdmin, isManager } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<{ inv: Invoice; permanent: boolean } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSendingMail, setIsSendingMail] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Invoice creation form state - empty by default
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    clientName: '',
    clientPhone: '',
    clientAddress: '',
    sector: 'CENTRAL' as SectorId | 'CENTRAL',
    items: [
      { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 },
    ],
    discount: 0,
    amountPaid: 0,
    status: 'brouillon' as InvoiceStatus,
    notes: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invs, clts, sett] = await Promise.all([
        api.getInvoices(),
        api.getClients(),
        api.getSettings(),
      ]);
      setInvoices(invs);
      setClients(clts);
      setSettings(sett);
      if (invs.length > 0 && !selectedInvoice) {
        setSelectedInvoice(invs[0]);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur chargement factures' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsub = api.onSyncEvent((event) => {
      if (event.type === 'invoice' || event.type === 'sale') {
        loadData();
      }
    });

    return () => {
      unsub();
    };
  }, [user?.id]);

  const handleClientSelect = (clientId: string) => {
    const clt = clients.find(c => c.id === clientId);
    if (clt) {
      setFormData(prev => ({
        ...prev,
        clientId: clt.id,
        clientName: clt.name,
        clientPhone: clt.phone,
        clientAddress: clt.address || '',
      }));
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { id: String(Date.now()), description: 'Plateaux d\'œufs frais', quantity: 10, unitPrice: 2200, total: 22000 },
      ],
    }));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const it = { ...newItems[index], [field]: val };
      it.total = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      newItems[index] = it;
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientName) {
      setFeedback({ type: 'error', message: 'Veuillez sélectionner ou renseigner un client.' });
      return;
    }

    try {
      const created = await api.createInvoice(formData);
      setFeedback({ type: 'success', message: `Facture ${created.number} générée avec succès.` });
      setShowCreateModal(false);
      await loadData();
      setSelectedInvoice(created);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur création facture' });
    }
  };

  const handleDeleteOrCancelInvoice = async (reason: string, opPass?: string) => {
    if (!deleteInvoiceTarget) return;
    try {
      await api.deleteInvoice(deleteInvoiceTarget.inv.id, reason, deleteInvoiceTarget.permanent, opPass);
      setFeedback({
        type: 'success',
        message: deleteInvoiceTarget.permanent
          ? `Facture ${deleteInvoiceTarget.inv.number} supprimée définitivement avec archivage sécurisé.`
          : `Facture ${deleteInvoiceTarget.inv.number} annulée avec succès et traçabilité d'audit.`,
      });
      setDeleteInvoiceTarget(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'opération' });
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      clientId: '',
      clientName: '',
      clientPhone: '',
      clientAddress: '',
      sector: 'CENTRAL',
      items: [
        { id: String(Date.now()), description: '', quantity: 1, unitPrice: 0, total: 0 },
      ],
      discount: 0,
      amountPaid: 0,
      status: 'payee',
      notes: '',
    });
    setShowCreateModal(true);
  };

  const [isExportingInvoice, setIsExportingInvoice] = useState<string | null>(null);

  const handleExportInvoice = async (format: 'pdf' | 'png' | 'jpg') => {
    if (!printAreaRef.current || !selectedInvoice) return;
    setIsExportingInvoice(format);
    try {
      const baseFilename = `CAMPEMENT_FACTURE_${selectedInvoice.number}_${selectedInvoice.date}`;
      if (format === 'pdf') {
        await exportElementToPdf(printAreaRef.current, baseFilename, `Facture ${selectedInvoice.number}`);
        setFeedback({ type: 'success', message: `Facture ${selectedInvoice.number} téléchargée en PDF avec succès.` });
      } else {
        await exportElementToImage(printAreaRef.current, baseFilename, format);
        setFeedback({ type: 'success', message: `Facture ${selectedInvoice.number} téléchargée en image ${format.toUpperCase()} avec succès.` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'exportation de la facture' });
    } finally {
      setIsExportingInvoice(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendInvoiceEmail = async (inv: Invoice) => {
    setIsSendingMail(true);
    setFeedback(null);
    try {
      const res = await api.sendInvoiceEmail(inv.id, settings?.managerEmail || 'boubacarsene8@gmail.com');
      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: `Facture ${inv.number} transmise par e-mail avec succès à ${settings?.managerEmail || 'boubacarsene8@gmail.com'}.` 
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Identifiants SMTP non configurés.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'envoi e-mail de la facture' });
    } finally {
      setIsSendingMail(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Facturation & Règlements
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Format A4 Professionnel
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Génération conforme FAC-YYYY-XXXX, calcul des soldes dus, impression directe et transmission mail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Facture</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <div className="flex-1 font-medium">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">
            Fermer
          </button>
        </div>
      )}

      {/* Main Layout: List on Left, Printable Viewer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Invoices List */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher par n° ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="payee">Payée</option>
              <option value="partiellement_payee">Partiellement payée</option>
              <option value="brouillon">Brouillon</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>

          {/* Cards */}
          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {filteredInvoices.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
                Aucune facture trouvée.
              </div>
            ) : (
              filteredInvoices.map(inv => {
                const isSelected = selectedInvoice?.id === inv.id;
                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`p-4 rounded-2xl border transition cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-black text-sm text-slate-900">{inv.number}</div>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        inv.status === 'payee' ? 'bg-emerald-100 text-emerald-800' :
                        inv.status === 'partiellement_payee' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.status === 'payee' ? 'Payée' :
                         inv.status === 'partiellement_payee' ? 'Partielle' :
                         inv.status === 'brouillon' ? 'Brouillon' : inv.status}
                      </span>
                    </div>

                    <div className="mt-1 font-bold text-slate-800 text-sm">{inv.clientName}</div>
                    
                    <div className="mt-2 flex items-center justify-between text-slate-500 border-t border-slate-100 pt-2">
                      <span>{inv.date}</span>
                      <span className="font-black text-slate-900 text-sm">
                        {(Number(inv.total) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}
                      </span>
                    </div>

                    {(Number(inv.balanceDue) || 0) > 0 && (
                      <div className="mt-1 text-right text-[11px] font-bold text-rose-600">
                        Reste dû : {(Number(inv.balanceDue) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Printable A4 Invoice Preview */}
        <div className="lg:col-span-7">
          {selectedInvoice ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Action Toolbar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {selectedInvoice.number}
                  </span>
                  <span className="text-slate-400 text-xs">• A4 Conforme</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleExportInvoice('pdf')}
                    disabled={Boolean(isExportingInvoice)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition shadow disabled:opacity-50"
                    title="Télécharger la facture en PDF"
                  >
                    {isExportingInvoice === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    <span>Télécharger en PDF</span>
                  </button>

                  <button
                    onClick={() => handleExportInvoice('png')}
                    disabled={Boolean(isExportingInvoice)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition shadow disabled:opacity-50"
                    title="Télécharger en image PNG"
                  >
                    {isExportingInvoice === 'png' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    <span>Télécharger en image PNG</span>
                  </button>

                  <button
                    onClick={() => handleExportInvoice('jpg')}
                    disabled={Boolean(isExportingInvoice)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition shadow disabled:opacity-50"
                    title="Télécharger en image JPG"
                  >
                    {isExportingInvoice === 'jpg' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    <span>Télécharger en image JPG</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimer</span>
                  </button>

                  <button
                    onClick={() => handleSendInvoiceEmail(selectedInvoice)}
                    disabled={isSendingMail}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-200"
                    title="Transmettre par e-mail si SMTP configuré"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isSendingMail ? '...' : 'E-mail'}</span>
                  </button>

                  {isAdmin && (
                    <>
                      {selectedInvoice.status !== 'annulee' && (
                        <button
                          onClick={() => setDeleteInvoiceTarget({ inv: selectedInvoice, permanent: false })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition"
                          title="Annuler la facture avec traçabilité d'audit (Correction recommandée)"
                        >
                          <XCircle className="w-3.5 h-3.5 text-amber-700" />
                          <span>Annuler facture</span>
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteInvoiceTarget({ inv: selectedInvoice, permanent: true })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition"
                        title="Supprimer définitivement la facture avec motif d'audit"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Supprimer</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Printable Invoice Sheet */}
              <div ref={printAreaRef} className="p-6 sm:p-10 font-sans text-slate-800 bg-white">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-emerald-950 tracking-tight">
                      {settings?.farmName || 'POULAILLER CAMPEMENT'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      {settings?.address || 'Zone Agro-Industrielle, Pout, Sénégal'}<br />
                      Tél : {settings?.phone || '+221 77 123 45 67'} • E-mail : boubacarsene8@gmail.com
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md inline-block">
                      FACTURE COMMERCIALE
                    </div>
                    <div className="font-mono text-xl font-black text-slate-900 mt-2">
                      {selectedInvoice.number}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Date : <strong>{selectedInvoice.date}</strong>
                    </div>
                  </div>
                </div>

                {/* Client Block */}
                <div className="grid grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 block mb-1">
                      Facturé à :
                    </span>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {selectedInvoice.clientName}
                    </div>
                    <div className="text-slate-600 mt-0.5">{selectedInvoice.clientPhone}</div>
                    {selectedInvoice.clientAddress && (
                      <div className="text-slate-500 mt-0.5">{selectedInvoice.clientAddress}</div>
                    )}
                  </div>

                  <div>
                    <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 block mb-1">
                      Détails règlement :
                    </span>
                    <div className="text-slate-700">
                      Statut : <strong className="capitalize">{selectedInvoice.status}</strong>
                    </div>
                    <div className="text-slate-700 mt-0.5">
                      Émis par : {selectedInvoice.createdByName || 'Direction Commerciale'}
                    </div>
                  </div>
                </div>

                {/* Items Table with responsive scroll wrapper */}
                <div className="overflow-x-auto my-6">
                  <table className="w-full text-left border-collapse text-xs min-w-[480px]">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-2.5 px-3">Désignation</th>
                        <th className="py-2.5 px-3 text-center">Quantité</th>
                        <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedInvoice.items || []).map((item, idx) => {
                        const qty = Number(item.quantity) || 0;
                        const uPrice = Number(item.unitPrice) || 0;
                        const lineTotal = Number(item.total !== undefined ? item.total : qty * uPrice) || 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-semibold text-slate-800">{item.description}</td>
                            <td className="py-3 px-3 text-center font-bold text-slate-900">{qty}</td>
                            <td className="py-3 px-3 text-right text-slate-600">
                              {uPrice.toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900">
                              {lineTotal.toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary & Totals */}
                <div className="border-t-2 border-slate-200 pt-4 flex justify-end">
                  <div className="w-64 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Sous-total :</span>
                      <span>{(Number(selectedInvoice.subtotal) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}</span>
                    </div>

                    {(Number(selectedInvoice.discount) || 0) > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Remise accordée :</span>
                        <span>-{(Number(selectedInvoice.discount) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-black text-base text-emerald-950 border-t border-slate-200 pt-2">
                      <span>TOTAL FACTURE :</span>
                      <span>{(Number(selectedInvoice.total) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}</span>
                    </div>

                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Montant Encaissé :</span>
                      <span>{(Number(selectedInvoice.amountPaid) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}</span>
                    </div>

                    <div className={`flex justify-between font-black text-sm pt-1 border-t border-slate-100 ${
                      (Number(selectedInvoice.balanceDue) || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      <span>Reste à payer :</span>
                      <span>{(Number(selectedInvoice.balanceDue) || 0).toLocaleString('fr-FR')} {settings?.currency || 'FCFA'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-500 text-center">
                  {selectedInvoice.notes || 'Marchandise vérifiée et livrée conforme. Merci de votre confiance.'}
                  <div className="mt-1 font-mono text-[9px] text-slate-400">
                    POULAILLER CAMPEMENT ERP • Logiciel de Gestion Avicole Intégrée
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
              Sélectionnez une facture pour afficher son aperçu.
            </div>
          )}
        </div>

      </div>

      {/* New Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Nouvelle Facture Commerciale</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date d'émission :</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Client enregistré :</label>
                  <select
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  >
                    <option value="">Sélectionner ou saisir manuellement...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nom du client :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Supermarché Dakar Frais"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Téléphone client :</label>
                  <input
                    type="text"
                    placeholder="+221 77 000 00 00"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Articles facturés</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-emerald-700 font-bold hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                </div>

                {formData.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Désignation..."
                      value={it.description}
                      onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                      className="col-span-6 bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qté"
                      value={it.quantity}
                      onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                      className="col-span-2 bg-white border border-slate-300 rounded-lg p-2 text-center font-bold"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Prix unit."
                      value={it.unitPrice}
                      onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                      className="col-span-3 bg-white border border-slate-300 rounded-lg p-2 text-right font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="col-span-1 text-rose-500 hover:text-rose-700 font-bold text-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Montant encaissé immédiatement :</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.amountPaid}
                    onChange={(e) => setFormData({ ...formData, amountPaid: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Statut initial :</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as InvoiceStatus })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  >
                    <option value="payee">Payée</option>
                    <option value="partiellement_payee">Partiellement payée</option>
                    <option value="brouillon">Brouillon</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition"
                >
                  Enregistrer et générer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteInvoiceTarget && (
        <DeleteConfirmModal
          isOpen={!!deleteInvoiceTarget}
          onClose={() => setDeleteInvoiceTarget(null)}
          onConfirm={handleDeleteOrCancelInvoice}
          title={deleteInvoiceTarget.permanent
            ? `Supprimer définitivement la facture ${deleteInvoiceTarget.inv.number}`
            : `Annuler la facture ${deleteInvoiceTarget.inv.number}`}
          itemDetails={[
            { label: 'Numéro', value: deleteInvoiceTarget.inv.number },
            { label: 'Client', value: deleteInvoiceTarget.inv.clientName },
            { label: 'Date', value: deleteInvoiceTarget.inv.date },
            { label: 'Montant Total', value: `${deleteInvoiceTarget.inv.total.toLocaleString('fr-FR')} FCFA` },
            { label: 'Statut actuel', value: deleteInvoiceTarget.inv.status },
          ]}
          warningMessage={deleteInvoiceTarget.permanent
            ? "Attention : La suppression définitive effacera la facture de la liste active et l'archivera dans la corbeille sécurisée avec justificatif."
            : "L'annulation traçable préserve l'historique comptable et comptabilise la facture comme annulée avec justification."}
        />
      )}

    </div>
  );
};
