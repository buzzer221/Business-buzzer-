import React, { useState } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, operatorPassword?: string) => Promise<void>;
  title: string;
  itemDetails: Array<{ label: string; value: string | number }>;
  warningMessage?: string;
  isPermanentAction?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemDetails,
  warningMessage,
  isPermanentAction = true,
}) => {
  const [reason, setReason] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Un motif explicite est obligatoire pour valider cette opération.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim(), operatorPassword.trim() || undefined);
      setReason('');
      setOperatorPassword('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-600">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
              {title}
            </h3>
            <div className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Contrôle Administrateur Boubacar Sene</span>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 mb-4 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {warningMessage || (
              <>
                <strong>Attention :</strong> Cette action supprimera définitivement cet enregistrement. Une copie de sécurité sera conservée dans la corbeille d'audit pour traçabilité et récupération éventuelle.
              </>
            )}
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4 text-xs space-y-1.5">
          <div className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
            Élément ciblé pour suppression :
          </div>
          <div className="grid grid-cols-2 gap-2">
            {itemDetails.map((detail, idx) => (
              <div key={idx} className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold block">{detail.label}</span>
                <span className="font-bold text-slate-900 text-xs">{detail.value}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-extrabold text-slate-800 block mb-1">
              Motif obligatoire de la suppression <span className="text-rose-600">*</span> :
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Erreur de saisie opérateur, doublon de ramassage, rectification..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="text-[10px] text-slate-400 mt-1">
              Ce motif sera consigné dans le journal d'audit central avec votre identité et la date.
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Mot de passe administrateur (confirmation de sécurité) :
            </label>
            <input
              type="password"
              value={operatorPassword}
              onChange={(e) => setOperatorPassword(e.target.value)}
              placeholder="Entrez votre mot de passe pour valider"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="text-[10px] text-slate-400 mt-0.5">
              Requis si l'option de ré-authentification pour opérations sensibles est activée.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-700 transition"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-lg shadow-rose-900/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Suppression en cours...' : 'Confirmer la suppression'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
