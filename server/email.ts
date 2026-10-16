import nodemailer from 'nodemailer';
import { ALL_SECTORS, CollectionRecord, DailySummary, Invoice, SLOTS } from '../src/types/index.js';
import { db } from './db.js';

interface SendDailyReportOptions {
  date: string;
  recipient?: string;
  collections: CollectionRecord[];
  summary: DailySummary;
  operatorName?: string;
  forceSend?: boolean;
}

export function generateDailyReportHtml(
  date: string,
  collections: CollectionRecord[],
  summary: DailySummary,
  farmName: string,
  operatorName?: string
): string {
  // Format date readable
  const [year, month, day] = date.split('-');
  const dateFormatted = `${day}/${month}/${year}`;

  // Map collections for quick lookup: [sector][slot] = { trays, broken, doubleYolk, depositTrays }
  const matrix: Record<string, Record<string, { trays: number; broken: number; doubleYolk: number; depositTrays: number }>> = {};
  for (const s of ALL_SECTORS) {
    matrix[s] = {};
    for (const slot of SLOTS) {
      matrix[s][slot] = { trays: 0, broken: 0, doubleYolk: 0, depositTrays: 0 };
    }
  }

  for (const c of collections) {
    if (matrix[c.sector] && matrix[c.sector][c.slot]) {
      const tr = c.trays !== undefined ? c.trays : (c.quantity || 0);
      const brk = c.brokenEggs !== undefined ? c.brokenEggs : (c.cracked || 0);
      const dbl = c.doubleYolkEggs !== undefined ? c.doubleYolkEggs : 0;
      const dep = c.depositTrays !== undefined ? c.depositTrays : (c.deposit !== undefined ? c.deposit : tr);
      matrix[c.sector][c.slot] = {
        trays: tr,
        broken: brk,
        doubleYolk: dbl,
        depositTrays: dep,
      };
    }
  }

  const rowsHtml = ALL_SECTORS.map(sec => {
    const q10 = matrix[sec]['10H'].trays;
    const q13 = matrix[sec]['13H'].trays;
    const q16 = matrix[sec]['16H'].trays;
    const secData = summary.bySector[sec];
    const totalTraysSector = secData?.trays ?? secData?.total ?? (q10 + q13 + q16);
    const brokenSector = secData?.brokenEggs ?? secData?.cracked ?? 0;
    const doubleYolkSector = secData?.doubleYolkEggs ?? 0;
    const depositTraysSector = secData?.depositTrays ?? secData?.deposit ?? totalTraysSector;

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; text-align: center;">
        <td style="padding: 12px 16px; font-weight: bold; color: #065f46; text-align: left; background-color: #f0fdf4;">Secteur ${sec}</td>
        <td style="padding: 12px 16px; color: #1e293b;">${q10 > 0 ? `${q10.toLocaleString('fr-FR')} pl.` : '-'}</td>
        <td style="padding: 12px 16px; color: #1e293b;">${q13 > 0 ? `${q13.toLocaleString('fr-FR')} pl.` : '-'}</td>
        <td style="padding: 12px 16px; color: #1e293b;">${q16 > 0 ? `${q16.toLocaleString('fr-FR')} pl.` : '-'}</td>
        <td style="padding: 12px 16px; font-weight: 700; color: #0f172a; background-color: #f8fafc;">
          ${totalTraysSector.toLocaleString('fr-FR')} pl.
          <span style="display: block; font-size: 10px; color: #64748b; font-weight: normal;">(${(totalTraysSector * 30).toLocaleString('fr-FR')} œufs)</span>
        </td>
        <td style="padding: 12px 16px; color: #dc2626; font-weight: 600;">${brokenSector > 0 ? `${brokenSector.toLocaleString('fr-FR')} œufs` : '0'}</td>
        <td style="padding: 12px 16px; color: #d97706; font-weight: 600;">${doubleYolkSector > 0 ? `${doubleYolkSector.toLocaleString('fr-FR')} œufs` : '0'}</td>
        <td style="padding: 12px 16px; font-weight: 700; color: #047857; background-color: #ecfdf5;">
          ${depositTraysSector.toLocaleString('fr-FR')} pl.
        </td>
      </tr>
    `;
  }).join('');

  const totalTrays10 = typeof summary.bySlot['10H'] === 'number' ? summary.bySlot['10H'] : (summary.bySlot['10H']?.trays || 0);
  const totalTrays13 = typeof summary.bySlot['13H'] === 'number' ? summary.bySlot['13H'] : (summary.bySlot['13H']?.trays || 0);
  const totalTrays16 = typeof summary.bySlot['16H'] === 'number' ? summary.bySlot['16H'] : (summary.bySlot['16H']?.trays || 0);
  
  const grandTotalTrays = summary.totalTrays ?? summary.totalEggs ?? 0;
  const grandBroken = summary.totalBrokenEggs ?? summary.totalCracked ?? 0;
  const grandDouble = summary.totalDoubleYolkEggs ?? 0;
  const grandDepositedTrays = summary.totalDepositedTrays ?? summary.totalDeposited ?? grandTotalTrays;
  const equivalentTotalEggs = grandTotalTrays * 30;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport de Ramassage — ${dateFormatted}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 760px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 24px 32px; color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">POULAILLER CAMPEMENT</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Exploitation Avicole • Suivi Quotidien de Production (Plateaux)</p>
            </div>
          </div>
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 14px;">
            <strong>Journée du :</strong> ${dateFormatted} &nbsp;|&nbsp; <strong>Statut :</strong> Journée Complète (10H + 13H + 16H)
            ${operatorName ? `&nbsp;|&nbsp; <strong>Validé par :</strong> ${operatorName}` : ''}
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 24px 32px;">
          <p style="font-size: 14px; line-height: 1.5; color: #475569; margin-top: 0;">
            Bonjour M. Sène,<br><br>
            Voici le récapitulatif complet de la production et des dépôts pour l'ensemble des secteurs (<strong>G3, G4, G5, G6</strong>) comptabilisé en <strong>nombre de plateaux</strong> après finalisation du dernier créneau de 16H :
          </p>

          <!-- Metrics summary cards -->
          <table style="width: 100%; margin-bottom: 24px; border-collapse: collapse;">
            <tr>
              <td style="width: 24%; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: 700;">Total Récolté</div>
                <div style="font-size: 22px; font-weight: 800; color: #065f46; margin-top: 4px;">${grandTotalTrays.toLocaleString('fr-FR')} pl.</div>
                <div style="font-size: 11px; color: #15803d;">(${equivalentTotalEggs.toLocaleString('fr-FR')} œufs)</div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 24%; padding: 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; text-transform: uppercase; color: #1e40af; font-weight: 700;">Dépôt Stock</div>
                <div style="font-size: 22px; font-weight: 800; color: #1d4ed8; margin-top: 4px;">${grandDepositedTrays.toLocaleString('fr-FR')} pl.</div>
                <div style="font-size: 11px; color: #2563eb;">dépôt direct</div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 24%; padding: 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; text-transform: uppercase; color: #991b1b; font-weight: 700;">Œufs Cassés</div>
                <div style="font-size: 22px; font-weight: 800; color: #b91c1c; margin-top: 4px;">${grandBroken.toLocaleString('fr-FR')}</div>
                <div style="font-size: 11px; color: #dc2626;">œufs déclassés</div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 24%; padding: 12px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; text-transform: uppercase; color: #92400e; font-weight: 700;">Double Jaune</div>
                <div style="font-size: 22px; font-weight: 800; color: #b45309; margin-top: 4px;">${grandDouble.toLocaleString('fr-FR')}</div>
                <div style="font-size: 11px; color: #d97706;">œufs individuels</div>
              </td>
            </tr>
          </table>

          <!-- Main Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                <th style="padding: 10px 14px; text-align: left;">Secteur</th>
                <th style="padding: 10px 12px; text-align: center;">10H (pl.)</th>
                <th style="padding: 10px 12px; text-align: center;">13H (pl.)</th>
                <th style="padding: 10px 12px; text-align: center;">16H (pl.)</th>
                <th style="padding: 10px 14px; text-align: center; background-color: #e2e8f0;">Total (pl.)</th>
                <th style="padding: 10px 12px; text-align: center;">Cassés (œufs)</th>
                <th style="padding: 10px 12px; text-align: center;">Dbl Jaune (œufs)</th>
                <th style="padding: 10px 14px; text-align: center; background-color: #d1fae5; color: #065f46;">Dépôt (pl.)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #0f172a; color: #ffffff; font-weight: 800; text-align: center;">
                <td style="padding: 14px 16px; text-align: left;">TOTAL GÉNÉRAL</td>
                <td style="padding: 14px 12px;">${totalTrays10.toLocaleString('fr-FR')} pl.</td>
                <td style="padding: 14px 12px;">${totalTrays13.toLocaleString('fr-FR')} pl.</td>
                <td style="padding: 14px 12px;">${totalTrays16.toLocaleString('fr-FR')} pl.</td>
                <td style="padding: 14px 14px; background-color: #1e293b;">
                  ${grandTotalTrays.toLocaleString('fr-FR')} pl.
                  <span style="display: block; font-size: 10px; color: #94a3b8; font-weight: normal;">(${equivalentTotalEggs.toLocaleString('fr-FR')} œufs)</span>
                </td>
                <td style="padding: 14px 12px; color: #fca5a5;">${grandBroken.toLocaleString('fr-FR')} œufs</td>
                <td style="padding: 14px 12px; color: #fde68a;">${grandDouble.toLocaleString('fr-FR')} œufs</td>
                <td style="padding: 14px 14px; background-color: #047857;">${grandDepositedTrays.toLocaleString('fr-FR')} pl.</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: 24px; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 4px; font-size: 12px; color: #64748b;">
            Ce rapport automatique est généré par le système <strong>POULAILLER CAMPEMENT</strong> après saisie et validation des trois créneaux horaires réglementaires (10H, 13H, 16H). Les quantités sont comptabilisées en <strong>plateaux</strong> et les dépôts ont été automatiquement incrémentés dans le stock de l'exploitation. Règle confirmée : 1 plateau standard = 30 œufs.
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
          ${farmName} • Système d'Information & Traçabilité Avicole • Contact : boubacarsene8@gmail.com
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateInvoiceHtml(invoice: Invoice, farmSettings: any): string {
  const itemsRows = invoice.items.map(item => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 12px; font-size: 13px; color: #1e293b;">${item.description}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #1e293b;">${item.quantity}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; color: #1e293b;">${item.unitPrice.toLocaleString('fr-FR')} ${farmSettings.currency}</td>
      <td style="padding: 10px 12px; font-size: 13px; text-align: right; font-weight: 600; color: #0f172a;">${item.total.toLocaleString('fr-FR')} ${farmSettings.currency}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8"><title>Facture ${invoice.number}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px; margin: 0; color: #1e293b;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #065f46; padding-bottom: 16px;">
          <div>
            <h2 style="margin: 0; color: #065f46; font-size: 20px;">${farmSettings.farmName}</h2>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${farmSettings.address} • ${farmSettings.phone}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold; color: #0f172a;">FACTURE</div>
            <div style="font-family: monospace; font-size: 14px; color: #065f46; font-weight: bold;">${invoice.number}</div>
            <div style="font-size: 12px; color: #64748b;">Date : ${invoice.date}</div>
          </div>
        </div>

        <div style="margin: 20px 0; padding: 14px; background: #f8fafc; border-radius: 6px; font-size: 13px;">
          <div style="font-weight: bold; color: #475569; margin-bottom: 4px; text-transform: uppercase; font-size: 11px;">Client Destinataire :</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${invoice.clientName}</div>
          ${invoice.clientPhone ? `<div style="color: #64748b;">Tél : ${invoice.clientPhone}</div>` : ''}
          ${invoice.clientAddress ? `<div style="color: #64748b;">Adresse : ${invoice.clientAddress}</div>` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 11px; color: #64748b;">
              <th style="padding: 8px 12px; text-align: left;">Désignation</th>
              <th style="padding: 8px 12px; text-align: center;">Qté</th>
              <th style="padding: 8px 12px; text-align: right;">Prix Unitaire</th>
              <th style="padding: 8px 12px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="margin-left: auto; width: 280px; font-size: 13px; line-height: 1.8;">
          <div style="display: flex; justify-content: space-between; color: #64748b;">
            <span>Sous-total :</span> <span>${invoice.subtotal.toLocaleString('fr-FR')} ${farmSettings.currency}</span>
          </div>
          ${invoice.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; color: #dc2626;">
            <span>Remise :</span> <span>-${invoice.discount.toLocaleString('fr-FR')} ${farmSettings.currency}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; color: #065f46; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 4px;">
            <span>TOTAL :</span> <span>${invoice.total.toLocaleString('fr-FR')} ${farmSettings.currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #16a34a; font-weight: 600;">
            <span>Montant payé :</span> <span>${invoice.amountPaid.toLocaleString('fr-FR')} ${farmSettings.currency}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: 700; color: ${invoice.balanceDue > 0 ? '#b91c1c' : '#16a34a'};">
            <span>Reste à payer :</span> <span>${invoice.balanceDue.toLocaleString('fr-FR')} ${farmSettings.currency}</span>
          </div>
        </div>

        <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
          Merci pour votre confiance. • Document généré par POULAILLER CAMPEMENT
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendDailyReportEmail(options: SendDailyReportOptions): Promise<{ success: boolean; messageId?: string; notConfigured?: boolean; error?: string }> {
  const { date, collections, summary, operatorName, forceSend } = options;
  const settings = db.getSettings();
  const recipient = options.recipient || settings.managerEmail || 'boubacarsene8@gmail.com';

  // Rule verification:
  // Must NOT send partial email unless explicitly forced
  if (!summary.isComplete && !forceSend) {
    return { success: false, error: 'Journée incomplète. E-mail réservé aux journées complètes (10H + 13H + 16H).' };
  }

  // Must NOT send if already sent for this day unless forceSend
  if (summary.emailSent && !forceSend) {
    return { success: true, messageId: summary.emailMessageId || 'already_sent' };
  }

  // Must NOT send empty email or filled only with zeros
  if (summary.totalEggs <= 0) {
    return { success: false, error: 'Impossible d\'envoyer un tableau vide ou composé uniquement de zéros.' };
  }

  const subject = `POULAILLER CAMPEMENT — Tableau complet du ramassage du ${date}`;
  const html = generateDailyReportHtml(date, collections, summary, settings.farmName, operatorName);

  // Check if SMTP is configured
  const hasSmtp = Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPass);

  if (!hasSmtp) {
    // Honest: do NOT claim email was sent or simulated!
    const notice = 'Envoi e-mail ignoré : Identifiants SMTP non configurés dans les paramètres.';
    
    db.logEmail({
      recipient,
      subject,
      type: 'ramassage_quotidien',
      status: 'non_configure',
      previewHtml: html,
      error: notice,
    });

    db.updateDailySummaryEmailStatus(date, {
      emailSent: false,
      emailSentAt: null,
      emailStatus: 'non_configure',
      emailError: notice,
    });

    return { success: false, notConfigured: true, error: notice };
  }

  // Real SMTP attempt
  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: settings.smtpFrom,
      to: recipient,
      subject,
      html,
    });

    db.logEmail({
      recipient,
      subject,
      type: 'ramassage_quotidien',
      status: 'sent',
      messageId: info.messageId,
      previewHtml: html,
    });

    db.updateDailySummaryEmailStatus(date, {
      emailSent: true,
      emailSentAt: new Date().toISOString(),
      emailMessageId: info.messageId,
      emailStatus: 'sent',
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const errorMsg = err?.message || 'Erreur de connexion SMTP';
    console.error('[Email] Échec de transmission SMTP :', errorMsg);

    db.logEmail({
      recipient,
      subject,
      type: 'ramassage_quotidien',
      status: 'error',
      previewHtml: html,
      error: errorMsg,
    });

    db.updateDailySummaryEmailStatus(date, {
      emailSent: false,
      emailSentAt: null,
      emailStatus: 'error',
      emailError: errorMsg,
    });

    return { success: false, error: errorMsg };
  }
}

export async function sendInvoiceEmail(invoice: Invoice, recipient?: string): Promise<{ success: boolean; messageId?: string; notConfigured?: boolean; error?: string }> {
  const settings = db.getSettings();
  const targetRecipient = recipient || invoice.clientPhone || settings.managerEmail;
  const subject = `POULAILLER CAMPEMENT — Facture ${invoice.number}`;
  const html = generateInvoiceHtml(invoice, settings);

  const hasSmtp = Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPass);

  if (!hasSmtp) {
    const notice = 'Envoi facturation ignoré : Identifiants SMTP non configurés.';
    db.logEmail({
      recipient: targetRecipient,
      subject,
      type: 'facture',
      status: 'non_configure',
      previewHtml: html,
      error: notice,
    });
    return { success: false, notConfigured: true, error: notice };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    const info = await transporter.sendMail({
      from: settings.smtpFrom,
      to: targetRecipient,
      subject,
      html,
    });

    db.logEmail({
      recipient: targetRecipient,
      subject,
      type: 'facture',
      status: 'sent',
      messageId: info.messageId,
      previewHtml: html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const errorMsg = err?.message || 'Erreur SMTP';
    db.logEmail({
      recipient: targetRecipient,
      subject,
      type: 'facture',
      status: 'error',
      previewHtml: html,
      error: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}
