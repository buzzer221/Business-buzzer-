import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  SlidersHorizontal,
  History,
  ShieldCheck,
  Download,
  Eye,
  FileText,
  Trash2
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, MovementType, SectorId, StockItemType, StockMovement } from '../types/index.js';
import { DocumentExportModal } from '../components/DocumentExportModal.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';

export const StocksPage: React.FC = () => {
  const { user, allowedSectors, isAdmin, isManager, isEmployee } = useAuth();

  const [balances, setBalances] = useState<any>({});
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('TOUS');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteMovementTarget, setDeleteMovementTarget] = useState<StockMovement | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form for new movement
  const [formData, setFormData] = useState({
    sector: allowedSectors[0] || 'G3',
    itemType: 'OEFS_STANDARDS' as StockItemType,
    quantity: '',
    movementType: 'ENTREE' as MovementType,
    reason: '',
    notes: '',
  });

  const [selectedMovementForExport, setSelectedMovementForExport] = useState<StockMovement | null>(null);
  const [showInventoryExportModal, setShowInventoryExportModal] = useState(false);

  const handleOpenAddModal = () => {
    setFormData({
      sector: allowedSectors[0] || 'G3',
      itemType: 'OEFS_STANDARDS',
      quantity: '',
      movementType: 'ENTREE',
      reason: '',
      notes: '',
    });
    setShowAddModal(true);
  };

  const visibleSectors: (SectorId | 'CENTRAL')[] = isAdmin || isManager
    ? [...ALL_SECTORS, 'CENTRAL']
    : ALL_SECTORS.filter(s => allowedSectors.includes(s));

  const loadStockData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [bal, mov] = await Promise.all([
        api.getStockBalances(),
        api.getStockMovements(selectedSector !== 'TOUS' ? (selectedSector as any) : undefined),
      ]);
      setBalances(bal);
      setMovements(mov);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur chargement stocks' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();

    const unsub = api.onSyncEvent((event) => {
      if (event.type === 'stock' || event.type === 'collection') {
        loadStockData();
      }
    });

    return () => {
      unsub();
    };
  }, [selectedSector, user?.id]);

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(formData.quantity, 10);
    if (!qty || qty <= 0) {
      setFeedback({ type: 'error', message: 'Veuillez saisir une quantité positive.' });
      return;
    }

    try {
      await api.addStockMovement({
        sector: formData.sector,
        itemType: formData.itemType,
        quantity: qty,
        movementType: formData.movementType,
        reason: formData.reason || 'Mouvement manuel contrôlé',
        notes: formData.notes,
      });

      setFeedback({ type: 'success', message: 'Mouvement de stock enregistré avec succès.' });
      setShowAddModal(false);
      setFormData({
        sector: allowedSectors[0] || 'G3',
        itemType: 'OEFS_STANDARDS',
        quantity: '',
        movementType: 'ENTREE',
        reason: '',
        notes: '',
      });
      loadStockData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'enregistrement' });
    }
  };

  const handleDeleteMovement = async (reason: string, opPass?: string) => {
    if (!deleteMovementTarget) return;
    try {
      await api.deleteStockMovement(deleteMovementTarget.id, reason, opPass);
      setFeedback({
        type: 'success',
        message: 'Ligne de stock supprimée avec succès par l\'Administrateur principal.',
      });
      setDeleteMovementTarget(null);
      await loadStockData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la suppression du stock' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestion Sectorisée des Stocks
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Traçabilité
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inventaire des œufs calibrés, plateaux alvéolés et sacs d'aliments par bâtiment de production.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadStockData()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowInventoryExportModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
            title="Télécharger l'état complet des stocks en PDF, PNG ou JPG"
          >
            <FileText className="w-4 h-4" />
            <span>Fiche d'inventaire (PDF/PNG/JPG)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau mouvement</span>
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

      {/* Sector Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleSectors.map(sec => {
          const bal = balances[sec] || { oefsStandards: 0, oefsFeles: 0, plateauxVides: 0, alimentKg: 0 };
          const trays = Math.floor(bal.oefsStandards / 30);
          const rem = bal.oefsStandards % 30;

          return (
            <div key={sec} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-emerald-300 transition">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center">
                    {sec}
                  </span>
                  <span className="font-bold text-slate-900">
                    {sec === 'CENTRAL' ? 'Magasin Central' : `Secteur ${sec}`}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                  Stock
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Œufs Standards (Calibre A)</div>
                  <div className="text-2xl font-black text-slate-900">
                    {trays.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-slate-500">plateaux</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    ({bal.oefsStandards.toLocaleString('fr-FR')} œufs {rem > 0 ? `+ ${rem}` : ''})
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Fêlés / Déclassés</span>
                    <span className="font-bold text-rose-600">{bal.oefsFeles.toLocaleString('fr-FR')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase">Plateaux Vides</span>
                    <span className="font-bold text-slate-800">{bal.plateauxVides.toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Journal des Mouvements & Traçabilité
            </h3>
          </div>

          {/* Sector filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filtrer :</span>
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
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-3">Secteur</th>
                <th className="py-3 px-3">Article</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Quantité</th>
                <th className="py-3 px-4">Motif / Justification</th>
                <th className="py-3 px-4">Responsable</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Aucun mouvement enregistré pour ce filtre.
                  </td>
                </tr>
              ) : (
                movements.map(m => {
                  const isPositive = m.movementType === 'ENTREE' || m.movementType === 'DEPOT_RAMASSAGE';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(m.timestamp).toLocaleDateString('fr-FR')} {new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-extrabold">
                          {m.sector}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {m.itemType === 'OEFS_STANDARDS' ? 'Œufs standards' :
                         m.itemType === 'OEFS_FELES' ? 'Œufs fêlés' :
                         m.itemType === 'PLATEAUX_VIDES' ? 'Plateaux vides' : 'Aliment'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {isPositive ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-slate-600" />}
                          <span>{m.movementType}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-extrabold text-slate-900">
                        <span className={isPositive ? 'text-emerald-700' : 'text-slate-800'}>
                          {isPositive ? '+' : '-'}{(Number(m.quantity) || 0).toLocaleString('fr-FR')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={m.reason}>
                        {m.reason}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                        {m.performedByName || 'Opérateur'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedMovementForExport(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition shadow-xs"
                            title="Télécharger la fiche de mouvement en PDF, PNG ou JPG"
                          >
                            <Download className="w-3 h-3" />
                            <span>Exporter</span>
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteMovementTarget(m)}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                              title="Supprimer cette ligne de stock (Admin Boubacar Sene)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Movement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Enregistrer un mouvement de stock</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 text-base font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Secteur concerné :</label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {visibleSectors.map(s => (
                    <option key={s} value={s}>{s === 'CENTRAL' ? 'Magasin Central' : `Secteur ${s}`}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Type de produit :</label>
                  <select
                    value={formData.itemType}
                    onChange={(e) => setFormData({ ...formData, itemType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="OEFS_STANDARDS">Œufs Standards (unités)</option>
                    <option value="OEFS_FELES">Œufs Fêlés</option>
                    <option value="PLATEAUX_VIDES">Plateaux vides</option>
                    <option value="ALIMENT">Aliment (kg)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sens du flux :</label>
                  <select
                    value={formData.movementType}
                    onChange={(e) => setFormData({ ...formData, movementType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ENTREE">Entrée (+) </option>
                    <option value="SORTIE">Sortie (-)</option>
                    <option value="AJUSTEMENT">Ajustement inventaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Quantité (unités ou kg) :</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ex: 300"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motif / Justification :</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Réception livraison plateaux, don, casse accidentelle"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
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
                  Valider le mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Voucher Export Modal (PDF, PNG, JPG) */}
      {selectedMovementForExport && (
        <DocumentExportModal
          isOpen={Boolean(selectedMovementForExport)}
          onClose={() => setSelectedMovementForExport(null)}
          documentTitle="BON DE MOUVEMENT DE STOCK / DÉPÔT"
          documentReference={`STK-${selectedMovementForExport.id}`}
          date={selectedMovementForExport.date}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Date d'opération :</span>{' '}
                <strong className="text-slate-900">{selectedMovementForExport.date}</strong>
              </div>
              <div>
                <span className="text-slate-500">Heure :</span>{' '}
                <strong className="text-slate-900">
                  {new Date(selectedMovementForExport.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Responsable :</span>{' '}
                <strong className="text-slate-900">{selectedMovementForExport.performedByName || 'Opérateur'}</strong>
              </div>
            </div>

            {/* Main Movement Specs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-400 uppercase text-[10px] block font-bold">Nature du flux</span>
                <span className="font-extrabold text-sm text-slate-900 block">
                  {selectedMovementForExport.movementType}
                </span>
                <span className="text-slate-500 text-[11px]">
                  Bâtiment : <strong>{selectedMovementForExport.sector === 'CENTRAL' ? 'Magasin Central' : `Secteur ${selectedMovementForExport.sector}`}</strong>
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                <span className="text-emerald-800 uppercase text-[10px] block font-bold">Quantité Enregistrée</span>
                <span className="font-black text-xl text-emerald-950 block">
                  {(Number(selectedMovementForExport.quantity) || 0).toLocaleString('fr-FR')} {selectedMovementForExport.itemType === 'OEFS_STANDARDS' ? 'œufs' : 'unités'}
                </span>
                {selectedMovementForExport.itemType === 'OEFS_STANDARDS' && (
                  <span className="text-emerald-700 text-[11px] font-semibold">
                    ≈ {Math.floor(selectedMovementForExport.quantity / 30)} plateaux de 30
                  </span>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Article & Désignation :
              </div>
              <div className="text-sm font-extrabold text-slate-800">
                {selectedMovementForExport.itemType === 'OEFS_STANDARDS' ? 'Œufs standards frais (Calibre A)' :
                 selectedMovementForExport.itemType === 'OEFS_FELES' ? 'Œufs déclassés / Fêlés' :
                 selectedMovementForExport.itemType === 'PLATEAUX_VIDES' ? 'Plateaux alvéolés vides (Consignes)' :
                 'Aliment pondeuses (kg)'}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Justification / Motif :
                </div>
                <div className="text-xs text-slate-700 font-medium mt-0.5">
                  {selectedMovementForExport.reason}
                </div>
              </div>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-slate-500">
              <div className="border-t border-slate-300 pt-2 text-center">
                Visa de l'Opérateur / Magasinier
              </div>
              <div className="border-t border-slate-300 pt-2 text-center">
                Visa Contrôle Qualité / Gérant
              </div>
            </div>
          </div>
        </DocumentExportModal>
      )}

      {deleteMovementTarget && (
        <DeleteConfirmModal
          isOpen={!!deleteMovementTarget}
          onClose={() => setDeleteMovementTarget(null)}
          onConfirm={handleDeleteMovement}
          title={`Supprimer la ligne de stock ${deleteMovementTarget.movementType}`}
          itemDetails={[
            { label: 'Date', value: new Date(deleteMovementTarget.timestamp).toLocaleDateString('fr-FR') },
            { label: 'Secteur', value: deleteMovementTarget.sector },
            { label: 'Type article', value: deleteMovementTarget.itemType },
            { label: 'Quantité', value: `${deleteMovementTarget.quantity}` },
            { label: 'Motif initial', value: deleteMovementTarget.reason },
          ]}
          warningMessage="Attention : La suppression de cette ligne de stock recalculera immédiatement le solde théorique. Archivage automatique dans la corbeille."
        />
      )}

    </div>
  );
};
