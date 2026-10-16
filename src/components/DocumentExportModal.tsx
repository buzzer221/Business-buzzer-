import React, { useRef, useState } from 'react';
import { 
  FileText, 
  Image, 
  Download, 
  X, 
  Check, 
  Loader2, 
  Printer, 
  Share2 
} from 'lucide-react';
import { exportElementToImage, exportElementToPdf } from '../utils/exportDocument.js';

export interface DocumentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentReference: string;
  date: string;
  children: React.ReactNode;
}

export const DocumentExportModal: React.FC<DocumentExportModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentReference,
  date,
  children,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseFilename = `CAMPEMENT_${documentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${documentReference.replace(/[^a-zA-Z0-9]/g, '_')}_${date}`;

  const handleExport = async (format: 'pdf' | 'png' | 'jpg') => {
    if (!printContentRef.current) return;
    setIsExporting(format);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (format === 'pdf') {
        await exportElementToPdf(printContentRef.current, baseFilename, documentTitle);
        setSuccessMessage('Fichier PDF téléchargé avec succès.');
      } else {
        await exportElementToImage(printContentRef.current, baseFilename, format);
        setSuccessMessage(`Image ${format.toUpperCase()} téléchargée avec succès.`);
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'export:', err);
      setErrorMessage(err?.message || 'Erreur lors de la génération du document. Veuillez réessayer.');
    } finally {
      setIsExporting(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
        
        {/* Modal Top Bar */}
        <div className="p-4 bg-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-900">
          <div>
            <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
              Export Individuel de Document
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
              <span>{documentTitle}</span>
              <span className="font-mono text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-md font-bold">
                {documentReference}
              </span>
            </h3>
          </div>

          <button
            onClick={onClose}
            className="self-end sm:self-auto p-1.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-slate-300 hover:text-white transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons Toolbar: PDF, PNG, JPG */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={Boolean(isExporting)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition shadow-sm disabled:opacity-50"
            >
              {isExporting === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Télécharger en PDF</span>
            </button>

            <button
              onClick={() => handleExport('png')}
              disabled={Boolean(isExporting)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold transition shadow-sm disabled:opacity-50"
            >
              {isExporting === 'png' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
              <span>Télécharger en image PNG</span>
            </button>

            <button
              onClick={() => handleExport('jpg')}
              disabled={Boolean(isExporting)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition shadow-sm disabled:opacity-50"
            >
              {isExporting === 'jpg' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
              <span>Télécharger en image JPG</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Format adapté impression & partage WhatsApp
          </div>
        </div>

        {successMessage && (
          <div className="px-4 py-2 bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-2 border-b border-emerald-200">
            <Check className="w-4 h-4 text-emerald-700" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="px-4 py-2 bg-red-100 text-red-900 text-xs font-bold flex items-center justify-between gap-2 border-b border-red-200">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-700" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900 font-normal underline text-[11px]"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Printable & Exportable Sheet Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          <div
            ref={printContentRef}
            className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto font-sans text-slate-900"
          >
            {/* Standard Official Header */}
            <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-black text-emerald-950 tracking-tight">
                  POULAILLER CAMPEMENT
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Exploitation Avicole & Bâtiments Pondeuses (G3 • G4 • G5 • G6)
                </p>
                <p className="text-[10px] text-slate-400">
                  Zone Agro-Industrielle, Pout, Sénégal • Tél : +221 77 123 45 67
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                  DOCUMENT OFFICIEL
                </span>
                <div className="font-mono text-xs font-bold text-slate-800 mt-1">
                  Réf : {documentReference}
                </div>
                <div className="text-[11px] text-slate-500">
                  Date : <strong>{date}</strong>
                </div>
              </div>
            </div>

            {/* Document Content */}
            <div className="space-y-4">
              {children}
            </div>

            {/* Document Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2">
              <div>
                Document généré pour consultation et archivage • Système POULAILLER CAMPEMENT
              </div>
              <div className="font-mono">
                Certifié conforme
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            Fermer l'aperçu
          </button>
        </div>

      </div>
    </div>
  );
};
