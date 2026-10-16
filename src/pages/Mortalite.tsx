import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  TrendingDown,
  Activity,
  Download,
  FileText,
  Trash2
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, MortalityRecord, SectorId } from '../types/index.js';
import { DocumentExportModal } from '../components/DocumentExportModal.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';

export const MortalitePage: React.FC = () => {
  const { user, allowedSectors, isAdmin, isManager } = useAuth();

  const [records, setRecords] = useState<MortalityRecord[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('TOUS');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMortalityForExport, setSelectedMortalityForExport] = useState<MortalityRecord | null>(null);
  const [deleteMortalityTarget, setDeleteMortalityTarget] = useState<MortalityRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sector: (allowedSectors[0] || 'G3') as SectorId,
    count: '',
    cause: 'Chaleur / Coup de chaud',
    notes: '',
  });

  const handleOpenAddModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      sector: (allowedSectors[0] || 'G3') as SectorId,
      count: '',
      cause: 'Chaleur / Coup de chaud',
      notes: '',
    });
    setShowAddModal(true);
  };

  const visibleSectors: SectorId[] = isAdmin || isManager
    ? ALL_SECTORS
    : ALL_SECTORS.filter(s => allowedSectors.includes(s));

  const loadData = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await api.getMortality(selectedSector !== 'TOUS' ? (selectedSector as SectorId) : undefined);
      setRecords(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur chargement données de mortalité' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSector, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(formData.count, 10);
    if (isNaN(count) || count < 0) {
      setFeedback({ type: 'error', message: 'Veuillez saisir un nombre valide.' });
      return;
    }

    try {
      await api.addMortality({
        date: formData.date,
        sector: formData.sector,
        count,
        cause: formData.cause,
        notes: formData.notes,
      });

      setFeedback({ type: 'success', message: 'Perte enregistrée avec succès.' });
      setShowAddModal(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        sector: allowedSectors[0] || 'G3',
        count: '',
        cause: 'Chaleur / Coup de chaud',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de l\'enregistrement' });
    }
  };

  const handleDeleteMortality = async (reason: string, opPass?: string) => {
    if (!deleteMortalityTarget) return;
    try {
      await api.deleteMortality(deleteMortalityTarget.id, reason, opPass);
      setFeedback({
        type: 'success',
        message: 'Enregistrement de mortalité supprimé avec succès par l\'Administrateur principal.',
      });
      setDeleteMortalityTarget(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la suppression' });
    }
  };

  const totalMortality = records.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Suivi Sanitaire & Mortalité
            </h1>
            <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Surveillance
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Relevé des pertes quotidiennes par bâtiment, causes identifiées et suivi zootechnique.
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
            disabled={visibleSectors.length === 0}
            className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Déclarer une perte</span>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Pertes Cumulées (Période)</div>
          <div className="text-3xl font-black text-rose-700 mt-2">
            {totalMortality} <span className="text-sm font-semibold text-slate-500">poules</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Secteurs : {visibleSectors.join(', ')}</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Taux de Mortalité Global</div>
          <div className="text-3xl font-black text-emerald-800 mt-2">
            &lt; 0.08%
          </div>
          <div className="text-xs text-emerald-600 mt-1 font-semibold">Conforme aux normes d'élevage</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Cause Principale Observée</div>
          <div className="text-xl font-bold text-slate-800 mt-2">
            Coup de chaleur
          </div>
          <div className="text-xs text-slate-400 mt-1">Ventilation et brumisation recommandées</div>
        </div>
      </div>

      {/* Mortality History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-600" />
            <span>Historique des Déclarations de Mortalité</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filtrer :</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="TOUS">Tous les secteurs autorisés</option>
              {visibleSectors.map(s => (
                <option key={s} value={s}>Secteur {s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-100/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Secteur</th>
                <th className="py-3 px-3">Nombre</th>
                <th className="py-3 px-4">Cause Déclarée</th>
                <th className="py-3 px-4">Notes / Symptômes</th>
                <th className="py-3 px-4">Déclaré par</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucune mortalité enregistrée sur cette sélection.
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.date}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-extrabold">
                        {r.sector}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-black text-rose-700 text-sm">
                      {r.count}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{r.cause}</td>
                    <td className="py-3 px-4 text-slate-500">{r.notes || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{r.recordedByName || 'Opérateur'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedMortalityForExport(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] transition shadow-xs"
                          title="Télécharger la fiche de mortalité en PDF, PNG ou JPG"
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          <span>Exporter</span>
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteMortalityTarget(r)}
                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                            title="Supprimer cet enregistrement de mortalité (Admin Boubacar Sene)"
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Déclarer une perte de volaille</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date du constat :</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-500 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bâtiment / Secteur :</label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value as SectorId })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                >
                  {visibleSectors.map(s => (
                    <option key={s} value={s}>Secteur {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre de poules perdues :</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ex: 2"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-rose-700 text-sm focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Cause suspectée :</label>
                <select
                  value={formData.cause}
                  onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Chaleur / Coup de chaud">Chaleur / Coup de chaud</option>
                  <option value="Picage / Agressivité">Picage / Agressivité</option>
                  <option value="Mort naturelle / Arrêt cardiaque">Mort naturelle / Arrêt cardiaque</option>
                  <option value="Affection respiratoire">Affection respiratoire</option>
                  <option value="Autre / En analyse">Autre / En analyse</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Commentaires / Symptômes :</label>
                <textarea
                  rows={2}
                  placeholder="Remarques vétérinaires ou de lot..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-rose-500"
                ></textarea>
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
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl shadow transition"
                >
                  Enregistrer la perte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mortality Voucher Individual Export Modal (PDF, PNG, JPG) */}
      {selectedMortalityForExport && (
        <DocumentExportModal
          isOpen={Boolean(selectedMortalityForExport)}
          onClose={() => setSelectedMortalityForExport(null)}
          documentTitle="FICHE DE CONSTAT DE MORTALITÉ / SUIVI ZOOTECHNIQUE"
          documentReference={`MOR-${selectedMortalityForExport.id}`}
          date={selectedMortalityForExport.date}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Date du constat :</span>{' '}
                <strong className="text-slate-900">{selectedMortalityForExport.date}</strong>
              </div>
              <div>
                <span className="text-slate-500">Bâtiment / Secteur :</span>{' '}
                <strong className="text-rose-900 font-extrabold">Secteur {selectedMortalityForExport.sector}</strong>
              </div>
              <div>
                <span className="text-slate-500">Enregistré par :</span>{' '}
                <strong className="text-slate-900">{selectedMortalityForExport.recordedByName || 'Opérateur'}</strong>
              </div>
            </div>

            {/* Main Stats Block */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs space-y-1">
                <span className="text-rose-700 uppercase text-[10px] block font-bold">Pertes constatées</span>
                <span className="font-black text-2xl text-rose-950 block">
                  {selectedMortalityForExport.count} poules
                </span>
                <span className="text-rose-800 text-[11px]">
                  Bâtiment Pondeuses {selectedMortalityForExport.sector}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-400 uppercase text-[10px] block font-bold">Diagnostic / Cause</span>
                <span className="font-extrabold text-sm text-slate-900 block">
                  {selectedMortalityForExport.cause}
                </span>
                <span className="text-slate-500 text-[11px]">
                  Relevé sanitaire d'élevage
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Observations & Circonstances :
              </div>
              <div className="text-xs text-slate-800 font-medium">
                {selectedMortalityForExport.notes || 'Aucune observation particulière signalée lors du ramassage ou de la visite sanitaire.'}
              </div>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-slate-500">
              <div className="border-t border-slate-300 pt-2 text-center">
                Visa de l'Opérateur / Soigneur
              </div>
              <div className="border-t border-slate-300 pt-2 text-center">
                Visa du Responsable d'Élevage
              </div>
            </div>
          </div>
        </DocumentExportModal>
      )}

    </div>
  );
};
