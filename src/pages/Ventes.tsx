import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  TrendingUp, 
  UserCheck,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, Client, SaleRecord, SectorId } from '../types/index.js';
import { DocumentExportModal } from '../components/DocumentExportModal.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';

export const VentesPage: React.FC = () => {
  const { user, allowedSectors, isAdmin, isManager } = useAuth();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('TOUS');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSaleForExport, setSelectedSaleForExport] = useState<SaleRecord | null>(null);
  const [deleteSaleTarget, setDeleteSaleTarget] = useState<SaleRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    clientName: '',
    sector: (allowedSectors[0] || 'CENTRAL') as SectorId | 'CENTRAL',
    itemType: 'Plateaux d\'œufs (30/pl.)',
    quantity: '',
    unitPrice: '',
    status: 'validee' as 'validee' | 'en_attente',
  });

  const handleOpenAddModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      clientId: '',
      clientName: '',
      sector: (allowedSectors[0] || 'CENTRAL') as SectorId | 'CENTRAL',
      itemType: 'Plateaux d\'œufs (30/pl.)',
      quantity: '',
      unitPrice: '',
      status: 'validee',
    });
    setShowAddModal(true);
  };

  const visibleSectors: (SectorId | 'CENTRAL')[] = isAdmin || isManager
    ? [...ALL_SECTORS, 'CENTRAL']
    : ALL_SECTORS.filter(s => allowedSectors.includes(s));

  const loadData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [salesData, clientsData] = await Promise.all([
        api.getSales(selectedSector !== 'TOUS' ? (selectedSector as any) : undefined),
        api.getClients(),
      ]);
      setSales(salesData);
      setClients(clientsData);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur chargement ventes' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSector, user?.id]);

  const handleClientSelect = (clientId: string) => {
    const clt = clients.find(c => c.id === clientId);
    if (clt) {
      setFormData(prev => ({
        ...prev,
        clientId: clt.id,
        clientName: clt.name,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(formData.quantity, 10);
    const price = parseInt(formData.unitPrice, 10);

    if (!qty || qty <= 0 || !price || price <= 0) {
      setFeedback({ type: 'error', message: 'Veuillez saisir une quantité et un prix valides.' });
      return;
    }

    try {
      await api.addSale({
        date: formData.date,
        clientId: formData.clientId || 'clt_direct',
        clientName: formData.clientName,
        sector: formData.sector,
        itemType: formData.itemType,
        quantity: qty,
        unitPrice: price,
        totalAmount: qty * price,
        status: formData.status,
      });

      setFeedback({ type: 'success', message: 'Vente enregistrée avec déduction automatique du stock.' });
      setShowAddModal(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        clientId: '',
        clientName: '',
        sector: allowedSectors[0] || 'CENTRAL',
        itemType: 'Plateaux d\'œufs (30/pl.)',
        quantity: '',
        unitPrice: '2200',
        status: 'validee',
      });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'enregistrement de la vente' });
    }
  };

  const handleDeleteSale = async (reason: string, opPass?: string) => {
    if (!deleteSaleTarget) return;
    try {
      await api.deleteSale(deleteSaleTarget.id, reason, opPass);
      setFeedback({
        type: 'success',
        message: `Vente client ${deleteSaleTarget.clientName} supprimée avec succès par l'Administrateur principal.`,
      });
      setDeleteSaleTarget(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la suppression de la vente' });
    }
  };

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTraysSold = sales.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestion Commerciale & Ventes
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Expéditions
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enregistrement des sorties pour les grossistes, pâtisseries et supermarchés avec traçabilité par secteur.
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
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer une vente</span>
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

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Chiffre d'Affaires Réalisé</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-2">
            {totalRevenue.toLocaleString('fr-FR')} <span className="text-sm font-semibold text-slate-500">FCFA</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Secteurs autorisés uniquement</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Volume Total Écoulé</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {totalTraysSold.toLocaleString('fr-FR')} <span className="text-sm font-semibold text-slate-500">plateaux</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">({(totalTraysSold * 30).toLocaleString('fr-FR')} œufs)</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Prix Moyen du Plateau</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 mt-2">
            {totalTraysSold > 0 ? Math.round(totalRevenue / totalTraysSold).toLocaleString('fr-FR') : '2 200'} <span className="text-sm font-semibold text-slate-500">FCFA</span>
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">Calibre A Standard</div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-700" />
            <span>Historique des Ventes</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filtrer secteur :</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TOUS">Tous les secteurs autorisés</option>
              {visibleSectors.map(s => (
                <option key={s} value={s}>{s === 'CENTRAL' ? 'Magasin Central' : `Secteur ${s}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-100/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">Origine</th>
                <th className="py-3 px-3">Volume</th>
                <th className="py-3 px-3">Prix Unit.</th>
                <th className="py-3 px-3">Montant Total</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Vendeur</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Aucune vente enregistrée sur cette sélection.
                  </td>
                </tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-700 whitespace-nowrap">{s.date}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{s.clientName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-extrabold">
                        {s.sector}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-black text-slate-900">
                      {s.quantity} plateaux
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {s.unitPrice.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="py-3 px-3 font-black text-emerald-800 text-sm">
                      {s.totalAmount.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {s.recordedByName || 'Opérateur'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSaleForExport(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] transition shadow-xs"
                          title="Télécharger le bon de vente individuel en PDF, PNG ou JPG"
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          <span>Exporter</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteSaleTarget(s)}
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                            title="Supprimer cette vente (Admin Boubacar Sene)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Enregistrer une sortie pour vente</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date :</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bâtiment / Stock source :</label>
                  <select
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                  >
                    {visibleSectors.map(s => (
                      <option key={s} value={s}>{s === 'CENTRAL' ? 'Magasin Central' : `Secteur ${s}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Sélectionner un client existant :</label>
                <select
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-medium"
                >
                  <option value="">Sélectionner dans le carnet client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du client :</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Grossiste Marché Sandaga"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantité (plateaux de 30) :</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ex: 50"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Prix unitaire du plateau (FCFA) :</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-emerald-800 text-sm"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold flex justify-between items-center">
                <span>Total à encaisser :</span>
                <span className="text-base font-black text-emerald-800">
                  {((parseInt(formData.quantity, 10) || 0) * (parseInt(formData.unitPrice, 10) || 0)).toLocaleString('fr-FR')} FCFA
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition"
                >
                  Valider la vente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Voucher Individual Export Modal (PDF, PNG, JPG) */}
      {selectedSaleForExport && (
        <DocumentExportModal
          isOpen={Boolean(selectedSaleForExport)}
          onClose={() => setSelectedSaleForExport(null)}
          documentTitle="BON DE VENTE / REÇU COMMERCIAL"
          documentReference={`VTE-${selectedSaleForExport.id}`}
          date={selectedSaleForExport.date}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Date de la vente :</span>{' '}
                <strong className="text-slate-900">{selectedSaleForExport.date}</strong>
              </div>
              <div>
                <span className="text-slate-500">Client :</span>{' '}
                <strong className="text-slate-900">{selectedSaleForExport.clientName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Origine :</span>{' '}
                <strong className="text-slate-900">{selectedSaleForExport.sector === 'CENTRAL' ? 'Magasin Central' : `Secteur ${selectedSaleForExport.sector}`}</strong>
              </div>
            </div>

            {/* Sales Specs Table */}
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-extrabold text-[11px] uppercase">
                  <th className="p-2.5 border border-slate-300 text-left">Désignation</th>
                  <th className="p-2.5 border border-slate-300 text-center">Quantité</th>
                  <th className="p-2.5 border border-slate-300 text-right">Prix Unitaire</th>
                  <th className="p-2.5 border border-slate-300 text-right bg-emerald-50 text-emerald-950">Montant Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border border-slate-300">
                  <td className="p-3 border border-slate-300 font-bold text-slate-900">
                    {selectedSaleForExport.itemType}
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Provenance : Bâtiment {selectedSaleForExport.sector} ({selectedSaleForExport.quantity * 30} œufs au total)
                    </div>
                  </td>
                  <td className="p-3 border border-slate-300 text-center font-extrabold text-slate-900">
                    {selectedSaleForExport.quantity} plateaux
                  </td>
                  <td className="p-3 border border-slate-300 text-right font-medium text-slate-700">
                    {(Number(selectedSaleForExport.unitPrice) || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="p-3 border border-slate-300 text-right font-black text-emerald-800 bg-emerald-50/50 text-sm">
                    {(Number(selectedSaleForExport.totalAmount) || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold text-xs">
                  <td colSpan={3} className="p-3 border border-slate-800 text-left uppercase">
                    NET TOTAL ENCAISSÉ
                  </td>
                  <td className="p-3 border border-slate-800 text-right text-emerald-300 text-sm font-black">
                    {(Number(selectedSaleForExport.totalAmount) || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Operator and Status */}
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                Opérateur / Vendeur : <strong className="text-slate-800">{selectedSaleForExport.recordedByName || 'Opérateur'}</strong>
              </div>
              <div>
                Statut : <span className="font-bold text-emerald-700 uppercase">{selectedSaleForExport.status}</span>
              </div>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-slate-500">
              <div className="border-t border-slate-300 pt-2 text-center">
                Signature du Caissier / Vendeur
              </div>
              <div className="border-t border-slate-300 pt-2 text-center">
                Émargement du Client / Réceptionnaire
              </div>
            </div>
          </div>
        </DocumentExportModal>
      )}

      {deleteSaleTarget && (
        <DeleteConfirmModal
          isOpen={!!deleteSaleTarget}
          onClose={() => setDeleteSaleTarget(null)}
          onConfirm={handleDeleteSale}
          title={`Supprimer la vente client ${deleteSaleTarget.clientName}`}
          itemDetails={[
            { label: 'Date', value: deleteSaleTarget.date },
            { label: 'Client', value: deleteSaleTarget.clientName },
            { label: 'Secteur source', value: deleteSaleTarget.sector },
            { label: 'Quantité vendue', value: `${deleteSaleTarget.quantity} plateaux` },
            { label: 'Montant total', value: `${deleteSaleTarget.totalAmount.toLocaleString('fr-FR')} FCFA` },
          ]}
          warningMessage="Attention : La suppression de cette vente réintégrera la quantité vendue et ajustera les rapports financiers. Archivage automatique dans la corbeille."
        />
      )}

    </div>
  );
};
