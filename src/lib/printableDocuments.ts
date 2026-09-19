import { formatCurrency, formatDate } from './utils';
import type { School } from '../types';

interface PrintablePayment {
  receipt_number: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  notes?: string;
}

interface PrintableStudent {
  first_name: string;
  last_name: string;
  matricule: string;
  photo_url?: string;
}

interface PaymentReceiptTemplateInput {
  school: School;
  payment: PrintablePayment;
  student: PrintableStudent;
  academicYearName?: string;
  className?: string;
  parentName?: string;
  feeLabel?: string;
  processedByName?: string;
  compositions?: { item_name: string; amount: number }[];
  qrCodeHash?: string;
  digitalSignature?: string;
  stampUrl?: string;
  totalExpected?: number;
  totalPaid?: number;
  remaining?: number;
  installments?: { installment_number: number; label: string; amount: number; due_date: string }[];
  paymentHistory?: { receipt_number: string; payment_date: string; payment_method: string; amount: number; is_canteen: boolean }[];
}

interface StudentCardTemplateInput {
  school: School;
  student: PrintableStudent;
  academicYearName?: string;
  className?: string;
  primaryGuardian?: string;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeDocumentName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function printableShell(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, "Segoe UI", sans-serif;
      color: #14253d;
      background: #eef3f8;
    }
    .page {
      min-height: 100vh;
      padding: 32px;
    }
    .sheet {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      border-radius: 28px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
      overflow: hidden;
    }
    .muted { color: #5d6a7b; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(255,255,255,0.18);
      color: white;
    }
    .logo {
      width: 68px;
      height: 68px;
      border-radius: 20px;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.32);
      background: rgba(255,255,255,0.15);
    }
    .placeholder-logo,
    .placeholder-photo {
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,0.92);
      font-weight: 700;
      letter-spacing: 0.08em;
    }
    @page {
      size: A4;
      margin: 10mm;
    }
    @media print {
      body {
        background: white;
      }
      .page {
        padding: 0;
      }
      .sheet {
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export function buildPaymentReceiptHtml({
  school,
  payment,
  student,
  academicYearName,
  className,
  parentName,
  feeLabel,
  processedByName,
  compositions,
  qrCodeHash,
  digitalSignature,
  totalExpected,
  totalPaid,
  remaining,
  installments,
  paymentHistory,
}: PaymentReceiptTemplateInput) {
  const receiptTitle = `Recu ${payment.receipt_number}`;
  const note = payment.notes?.trim() || 'Aucune note particuliere.';

  return printableShell(
    receiptTitle,
    `
    <div class="page">
      <section class="sheet">
        <div style="padding: 32px; background: linear-gradient(135deg, #0f3f57 0%, #155e75 55%, #1d4ed8 100%); color: white;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:24px;">
            <div style="display:flex; align-items:center; gap:18px;">
              ${
                school.logo_url
                  ? `<img class="logo" src="${escapeHtml(school.logo_url)}" alt="${escapeHtml(school.name)}" />`
                  : `<div class="logo placeholder-logo">ECOLE</div>`
              }
              <div>
                <div class="chip">Recu de paiement</div>
                <h1 style="margin:16px 0 8px; font-size:34px; line-height:1.05;">${escapeHtml(school.name)}</h1>
                <p style="margin:0; font-size:14px; opacity:0.84;">${escapeHtml(school.address || school.city || 'Etablissement scolaire')}</p>
                <p style="margin:6px 0 0; font-size:13px; opacity:0.72;">${escapeHtml(school.phone || '')} ${school.email ? `• ${escapeHtml(school.email)}` : ''}</p>
              </div>
            </div>
            <div style="text-align:right;">
              <p style="margin:0; font-size:13px; opacity:0.78;">Numero de recu</p>
              <p style="margin:8px 0 0; font-size:24px; font-weight:800;">${escapeHtml(payment.receipt_number)}</p>
              <p style="margin:12px 0 0; font-size:13px; opacity:0.78;">Date</p>
              <p style="margin:6px 0 0; font-size:16px; font-weight:700;">${escapeHtml(formatDate(payment.payment_date))}</p>
            </div>
          </div>
        </div>

        <div style="padding: 30px 32px 18px;">
          <div style="display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:18px;">
            <div style="padding:18px; border:1px solid #dce5ef; border-radius:22px; background:#f8fbfd;">
              <p class="muted" style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.14em;">Eleve</p>
              <p style="margin:0; font-size:22px; font-weight:800;">${escapeHtml(`${student.first_name} ${student.last_name}`)}</p>
              <p style="margin:10px 0 0; font-size:14px;">Matricule: <strong>${escapeHtml(student.matricule)}</strong></p>
              <p style="margin:6px 0 0; font-size:14px;">Classe: <strong>${escapeHtml(className || 'Non affectee')}</strong></p>
              <p style="margin:6px 0 0; font-size:14px;">Annee scolaire: <strong>${escapeHtml(academicYearName || 'En cours')}</strong></p>
            </div>
            <div style="padding:18px; border:1px solid #dce5ef; border-radius:22px; background:#f8fbfd;">
              <p class="muted" style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.14em;">Responsable financier</p>
              <p style="margin:0; font-size:22px; font-weight:800;">${escapeHtml(parentName || 'Non renseigne')}</p>
              <p style="margin:10px 0 0; font-size:14px;">Mode de paiement: <strong>${escapeHtml(payment.payment_method)}</strong></p>
              <p style="margin:6px 0 0; font-size:14px;">Statut: <strong>${escapeHtml(payment.status)}</strong></p>
              <p style="margin:6px 0 0; font-size:14px;">Enregistre par: <strong>${escapeHtml(processedByName || 'Equipe administrative')}</strong></p>
            </div>
          </div>

          <div style="margin-top:22px; padding:22px; border-radius:24px; background:linear-gradient(135deg, #f8fafc 0%, #eef7f4 100%); border:1px solid #dce5ef;">
            <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap;">
              <div>
                <p class="muted" style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.14em;">Objet</p>
                <p style="margin:0; font-size:24px; font-weight:800;">${escapeHtml(feeLabel || 'Paiement scolaire')}</p>
              </div>
              <div style="text-align:right;">
                <p class="muted" style="margin:0 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:0.14em;">Montant encaisse</p>
                <p style="margin:0; font-size:34px; font-weight:900; color:#047857;">${escapeHtml(formatCurrency(Number(payment.amount)))}</p>
              </div>
            </div>
          </div>

          ${
            totalExpected !== undefined || totalPaid !== undefined || remaining !== undefined
              ? (() => {
                  // Allocate totalPaid chronologically across installments
                  let runningPaid = totalPaid || 0;
                  const enrichedInstallments = (installments || []).map(inst => {
                    const amt = Number(inst.amount) || 0;
                    const paidForThisInst = Math.min(amt, runningPaid);
                    const remainingForThisInst = Math.max(0, amt - paidForThisInst);
                    runningPaid -= paidForThisInst;

                    let statusLabel = 'Impayé';
                    let statusColor = '#dc2626'; // red
                    if (paidForThisInst >= amt) {
                      statusLabel = 'Soldé';
                      statusColor = '#16a34a'; // green
                    } else if (paidForThisInst > 0) {
                      statusLabel = 'Partiel';
                      statusColor = '#ca8a04'; // orange
                    }

                    return {
                      ...inst,
                      paid: paidForThisInst,
                      remaining: remainingForThisInst,
                      statusLabel,
                      statusColor,
                    };
                  });

                  return `
                  <div style="margin-top:16px; padding:15px; border:1px solid #dce5ef; border-radius:20px; background:#f8fafc; font-family:sans-serif;">
                    <h3 style="margin:0 0 10px; font-size:13px; font-weight:800; color:#0f3f57; text-transform:uppercase; letter-spacing:0.05em;">État financier de l'élève</h3>
                    <div style="display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:10px; text-align:center; margin-bottom:12px;">
                      <div style="padding:6px 10px; background:white; border:1px solid #e2e8f0; border-radius:10px;">
                        <p style="margin:0 0 2px; font-size:9px; color:#64748b; text-transform:uppercase;">Total Scolarité</p>
                        <p style="margin:0; font-size:14px; font-weight:700; color:#1e293b;">${escapeHtml(formatCurrency(totalExpected || 0))}</p>
                      </div>
                      <div style="padding:6px 10px; background:white; border:1px solid #e2e8f0; border-radius:10px;">
                        <p style="margin:0 0 2px; font-size:9px; color:#64748b; text-transform:uppercase;">Déjà Encaissé</p>
                        <p style="margin:0; font-size:14px; font-weight:700; color:#047857;">${escapeHtml(formatCurrency(totalPaid || 0))}</p>
                      </div>
                      <div style="padding:6px 10px; background:white; border:1px solid #e2e8f0; border-radius:10px;">
                        <p style="margin:0 0 2px; font-size:9px; color:#64748b; text-transform:uppercase;">Reste à Payer</p>
                        <p style="margin:0; font-size:14px; font-weight:700; color:#b91c1c;">${escapeHtml(formatCurrency(remaining || 0))}</p>
                      </div>
                    </div>
                    
                    ${
                      enrichedInstallments.length > 0
                        ? `
                        <div>
                          <p style="margin:0 0 6px; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Détails de l'échéancier des tranches</p>
                          <table style="width:100%; border-collapse:collapse; font-size:10px; background:white; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
                            <thead>
                              <tr style="background:#f1f5f9; text-align:left; color:#475569;">
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0;">Tranche</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0; text-align:center;">Date d'échéance</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0; text-align:right;">Montant</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0; text-align:right;">Versé</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0; text-align:right;">Reste</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0; text-align:center; width:60px;">Statut</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${enrichedInstallments
                                .map(
                                  inst => `
                                <tr style="color:#334155;">
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9;">${escapeHtml(inst.label)}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${escapeHtml(formatDate(inst.due_date))}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:600;">${escapeHtml(formatCurrency(inst.amount))}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-align:right; color:#047857; font-weight:600;">${escapeHtml(formatCurrency(inst.paid))}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-align:right; color:#b91c1c; font-weight:600;">${escapeHtml(formatCurrency(inst.remaining))}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                                    <span style="display:inline-block; font-size:9px; font-weight:700; padding:2px 6px; border-radius:10px; background:${inst.statusColor}22; color:${inst.statusColor}; text-transform:uppercase;">
                                      ${inst.statusLabel}
                                    </span>
                                  </td>
                                </tr>
                              `
                                )
                                .join('')}
                            </tbody>
                          </table>
                        </div>
                        `
                        : ''
                    }

                    ${
                      paymentHistory && paymentHistory.length > 0
                        ? `
                        <div style="margin-top:14px;">
                          <p style="margin:0 0 6px; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Historique des versements effectués</p>
                          <table style="width:100%; border-collapse:collapse; font-size:9px; background:white; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
                            <thead>
                              <tr style="background:#f1f5f9; text-align:left; color:#475569;">
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0;">Date du versement</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0;">N° Reçu / Référence</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0;">Mode de paiement</th>
                                <th style="padding:5px 8px; border-bottom:1px solid #e2e8f0; text-align:right;">Montant versé</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${paymentHistory
                                .map(
                                  ph => `
                                <tr style="color:#334155;">
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9;">${escapeHtml(formatDate(ph.payment_date))}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; font-family:monospace; font-weight:600;">${escapeHtml(ph.receipt_number)}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-transform:capitalize;">${escapeHtml(ph.payment_method)}</td>
                                  <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:700; color:#047857;">${escapeHtml(formatCurrency(ph.amount))}</td>
                                </tr>
                              `
                                )
                                .join('')}
                            </tbody>
                          </table>
                        </div>
                        `
                        : ''
                    }
                  </div>
                  `;
                })()
              : ''
          }

          ${
            compositions && compositions.length > 0
              ? `
              <div style="margin-top: 18px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: sans-serif;">
                  <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                      <th style="padding: 8px 12px; border: 1px solid #e2e8f0;">Détail du versement</th>
                      <th style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: right;">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${compositions
                      .map(
                        c => `
                      <tr>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${escapeHtml(c.item_name)}</td>
                        <td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${escapeHtml(formatCurrency(c.amount))}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
              `
              : ''
          }

          <div style="margin-top:22px; display:grid; grid-template-columns: 1.2fr 0.8fr; gap:18px;">
            <div style="padding:18px; border:1px solid #dce5ef; border-radius:22px;">
              <p class="muted" style="margin:0 0 10px; font-size:12px; text-transform:uppercase; letter-spacing:0.14em;">Notes</p>
              <p style="margin:0; line-height:1.7;">${escapeHtml(note)}</p>
            </div>
            
            <div style="padding:18px; border:1px solid #dce5ef; border-radius:22px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <p class="muted" style="margin:0 0 6px; font-size:10px; text-transform:uppercase; letter-spacing:0.12em; color: #64748b;">Visa & Sécurité</p>
                ${
                  digitalSignature
                    ? `<p style="margin:0; font-size:9px; font-family:monospace; color:#94a3b8; word-break:break-all;">SIG: ${escapeHtml(digitalSignature)}</p>`
                    : ''
                }
                <div style="margin-top:8px; border: 2px dashed #047857; color: #047857; border-radius: 50%; padding: 8px; width: 62px; height: 62px; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:bold; text-align:center; transform: rotate(-8deg);">
                  HARPE DE DAVID
                </div>
              </div>
              ${
                qrCodeHash
                  ? `<img src="https://chart.googleapis.com/chart?cht=qr&chs=70x70&chl=${encodeURIComponent(qrCodeHash)}" alt="QR Code" style="width:70px; height:70px;" />`
                  : ''
              }
            </div>
          </div>
        </div>
      </section>
    </div>
    `
  );
}

export function buildStudentCardHtml({
  school,
  student,
  academicYearName = '2026-2027',
  className,
  primaryGuardian,
}: StudentCardTemplateInput) {
  const guardianPhone = (student as any).parent_phone || school.phone || '0707877285';
  const dobStr = (student as any).date_of_birth || (student as any).birth_date;
  const dobFormatted = dobStr ? new Date(dobStr).toLocaleDateString('fr-FR') : 'Non renseignée';

  return printableShell(
    `Carte scolaire ${student.matricule}`,
    `
    <div class="page" style="display:flex; align-items:center; justify-content:center; padding: 20px;">
      <section class="sheet" style="max-width: 320mm; padding: 20px; background: transparent; box-shadow: none;">
        
        <div style="display:flex; flex-wrap:wrap; gap:20mm; justify-content:center; align-items:center;">
          
          <!-- RECTO (FACE AVANT) -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <span style="font-size:10px; font-weight:800; color:#64748b; uppercase; tracking:0.1em;">RECTO (FACE AVANT)</span>
            
            <div style="width: 86mm; height: 54mm; border-radius: 14px; overflow: hidden; position: relative; box-shadow: 0 14px 40px rgba(15,23,42,0.22); background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #d97706 100%); color: white; box-sizing: border-box; border: 1.5px solid rgba(255,255,255,0.4);">
              <!-- Background Radial Pattern -->
              <div style="position:absolute; inset:0; background: radial-gradient(circle at top right, rgba(255,255,255,0.25), transparent 45%), radial-gradient(circle at bottom left, rgba(245,158,11,0.3), transparent 35%);"></div>
              
              <div style="position:relative; z-index:1; height:100%; padding:10px 12px; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                
                <!-- Top Header: Logo & School Name -->
                <div style="display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.25); padding-bottom: 5px;">
                  <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                    ${
                      school.logo_url
                        ? `<div style="width:24px; height:24px; border-radius:50%; background:white; display:flex; align-items:center; justify-content:center; padding:1px; flex-shrink:0;">
                            <img src="${escapeHtml(school.logo_url)}" alt="${escapeHtml(school.name)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />
                          </div>`
                        : `<div style="width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:9px;">★</div>`
                    }
                    <div style="min-width:0;">
                      <p style="margin:0; font-size:5.5px; letter-spacing:0.12em; text-transform:uppercase; font-weight:800; color:#fef08a;">CARTE ÉLÈVE OFFICIELLE</p>
                      <p style="margin:1px 0 0; font-size:8px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#ffffff;">${escapeHtml(school.name)}</p>
                    </div>
                  </div>
                  <span style="padding:2px 6px; border-radius:999px; background:rgba(255,255,255,0.25); font-size:6px; font-weight:800; white-space:nowrap; border:1px solid rgba(255,255,255,0.3);">${escapeHtml(academicYearName)}</span>
                </div>

                <!-- Body: Student Name + Photo -->
                <div style="display:flex; items-center; justify-content:space-between; gap:8px; margin: 3px 0;">
                  <div style="min-width:0; flex:1;">
                    <p style="margin:0; font-size:5.5px; text-transform:uppercase; opacity:0.85; letter-spacing:0.08em;">Nom & Prénoms</p>
                    <p style="margin:2px 0 0; font-size:11px; line-height:1.15; font-weight:900; color:#ffffff; font-family: system-ui, sans-serif;">
                      ${escapeHtml(student.last_name.toUpperCase())}<br />
                      <span style="font-weight:700; color:#f8fafc;">${escapeHtml(student.first_name)}</span>
                    </p>
                    
                    <div style="display:flex; align-items:center; gap:5px; margin-top:5px;">
                      <span style="padding:2px 6px; border-radius:4px; background:#ffffff; color:#1e3a8a; font-size:7px; font-weight:900; text-transform:uppercase;">${escapeHtml(className || 'CLASSE')}</span>
                      <span style="font-size:7px; font-weight:800; font-family:monospace; color:#fef08a;">${escapeHtml(student.matricule)}</span>
                    </div>
                  </div>

                  <!-- Photo Box -->
                  <div style="flex-shrink:0;">
                    ${
                      student.photo_url
                        ? `<img src="${escapeHtml(student.photo_url)}" alt="${escapeHtml(`${student.first_name} ${student.last_name}`)}" style="width:50px; height:56px; border-radius:10px; object-fit:cover; border:2px solid #ffffff; box-shadow:0 3px 8px rgba(0,0,0,0.25);" />`
                        : `<div style="width:50px; height:56px; border-radius:10px; background:rgba(255,255,255,0.2); border:1.5px dashed rgba(255,255,255,0.5); font-size:7px; font-weight:800; display:flex; align-items:center; justify-content:center; color:white;">PHOTO</div>`
                    }
                  </div>
                </div>

                <!-- Bottom Footer: Validity Date -->
                <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.2); padding-top:3px; font-size:6px;">
                  <span style="opacity:0.9;">Matricule: <strong style="color:#ffffff;">${escapeHtml(student.matricule)}</strong></span>
                  <span style="color:#fef08a; font-weight:800;">Valable jusqu'au 30 Juin 2027</span>
                </div>

              </div>
            </div>
          </div>

          <!-- VERSO (FACE ARRIÈRE) -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <span style="font-size:10px; font-weight:800; color:#64748b; uppercase; tracking:0.1em;">VERSO (FACE ARRIÈRE)</span>

            <div style="width: 86mm; height: 54mm; border-radius: 14px; overflow: hidden; position: relative; box-shadow: 0 14px 40px rgba(15,23,42,0.18); background: #ffffff; color: #1e293b; box-sizing: border-box; border: 1.5px solid #cbd5e1; display:flex; flex-direction:column; justify-content:space-between; padding:10px 12px;">

              <!-- Header Banner -->
              <div style="display:flex; align-items:center; justify-content:space-between; border-bottom: 2px solid #2563eb; padding-bottom: 4px;">
                <div>
                  <p style="margin:0; font-size:6px; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:0.1em;">Renseignements Complémentaires</p>
                  <p style="margin:1px 0 0; font-size:8px; font-weight:800; color:#0f172a;">${escapeHtml(school.name)}</p>
                </div>
                <span style="font-size:6px; font-weight:800; background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px; border:1px solid #bfdbfe;">VERSO</span>
              </div>

              <!-- Content Grid -->
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin:3px 0; font-size:7px;">
                <div style="background:#f8fafc; padding:4px 6px; border-radius:6px; border:1px solid #e2e8f0;">
                  <span style="color:#64748b; font-size:5.5px; text-transform:uppercase; display:block;">Né(e) le</span>
                  <strong style="color:#0f172a; font-size:7px;">${escapeHtml(dobFormatted)}</strong>
                </div>
                <div style="background:#f8fafc; padding:4px 6px; border-radius:6px; border:1px solid #e2e8f0;">
                  <span style="color:#64748b; font-size:5.5px; text-transform:uppercase; display:block;">Sexe / Nationalité</span>
                  <strong style="color:#0f172a; font-size:7px;">${(student as any).sex === 'F' ? 'Féminin' : 'Masculin'}</strong>
                </div>
                <div style="grid-column: span 2; background:#f8fafc; padding:4px 6px; border-radius:6px; border:1px solid #e2e8f0;">
                  <span style="color:#64748b; font-size:5.5px; text-transform:uppercase; display:block;">Responsable Légal & Contact</span>
                  <strong style="color:#0f172a; font-size:7.5px;">${escapeHtml(primaryGuardian || 'Administration')} ${guardianPhone ? `(${escapeHtml(guardianPhone)})` : ''}</strong>
                </div>
              </div>

              <!-- Notice & Validity -->
              <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:4px 6px; text-align:center;">
                <p style="margin:0; font-size:5.5px; color:#1e40af; line-height:1.2;">
                  Carte strictement personnelle. En cas de perte, merci de la rapporter à la direction de l'établissement.
                </p>
                <p style="margin:2px 0 0; font-size:6.5px; font-weight:900; color:#1e3a8a;">
                  Année Scolaire 2026-2027 — Valable jusqu'au 30 Juin 2027
                </p>
              </div>

              <!-- Footer Signatures -->
              <div style="display:flex; justify-content:space-between; align-items:flex-end; font-size:5.5px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:3px;">
                <span>Matricule : <strong>${escapeHtml(student.matricule)}</strong></span>
                <span style="font-weight:800; color:#0f172a; text-decoration:underline;">Le Directeur de l'Établissement</span>
              </div>

            </div>
          </div>

        </div>

      </section>
    </div>
    `,
  );
}

export function openPrintPreview(html: string) {
  // Find or create a hidden iframe for print preview to bypass browser popup blockers
  let iframe = document.getElementById('print-preview-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-preview-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return false;

  doc.open();
  doc.write(html);
  doc.close();

  window.setTimeout(() => {
    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  }, 450);

  return true;
}

export function downloadTextDocument(content: string, fileName: string, mimeType = 'text/html;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
}

export function buildPayslipHtml({
  school,
  payroll,
  person,
}: {
  school: School;
  payroll: any;
  person: any;
}) {
  const details = payroll.details || {};
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const monthName = monthNames[(payroll.month - 1) % 12];
  
  // Calculate periods
  const year = payroll.year;
  const daysInMonth = new Date(year, payroll.month, 0).getDate();
  const periodText = `DU 01 ${monthName.toUpperCase()} ${year} AU ${daysInMonth} ${monthName.toUpperCase()} ${year}`;

  const baseSalary = Number(payroll.base_salary) || 0;
  const sursalaire = Number(details.sursalaire) || 0;
  const transport = Number(details.transport) || 0;
  const anciennete = Number(details.anciennete) || 0;
  const autresPrimes = Number(details.autres_primes) || 0;
  const gratification = Number(details.gratification) || 0;
  const congesPayes = Number(details.conges_payes) || 0;

  const baseImposable = baseSalary + sursalaire + anciennete + autresPrimes;

  let cr = Number(details.cr) || 0;
  let its = Number(details.its) || 0;

  // Self-healing: if rates were entered instead of absolute FCFA amounts, compute them
  if (cr > 0 && cr <= 10) {
    cr = Math.round(baseImposable * (cr / 100));
  }
  if (its > 0 && its <= 5) {
    its = Math.round(baseImposable * (its / 100));
  }

  const solidarite = Number(details.solidarite) || 0;
  const pharmacie = Number(details.pharmacie) || 0;

  const totalGains = baseSalary + sursalaire + transport + anciennete + autresPrimes + gratification + congesPayes;
  const totalRetenues = cr + its + solidarite + pharmacie;
  const netPay = totalGains - totalRetenues;

  const title = `Bulletin de paie - ${person.first_name} ${person.last_name}`;

  return printableShell(
    title,
    `
    <div class="page">
      <section class="sheet" style="padding: 24px; border: 2px solid #1e3a8a; border-radius: 12px;">
        <!-- Header Section -->
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 15px;">
          
          <!-- Employer Details -->
          <div style="border-right: 2px solid #1e3a8a; padding-right: 15px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1e3a8a;">Employeur</p>
              <h2 style="margin: 5px 0 2px 0; font-size: 16px; font-weight: 800; color: #1e3a8a;">${escapeHtml(school.name)}</h2>
              <p style="margin: 0; font-size: 11px; font-weight: bold;">BONOUA</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; text-decoration: underline;">BP 506 BONOUA</p>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: center; margin-top: 10px;">
              ${
                school.logo_url
                  ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 76px; height: 76px; border-radius: 50%; border: 2px solid #1e3a8a; object-fit: cover;" />`
                  : `<div style="width: 76px; height: 76px; border-radius: 50%; border: 2px dashed #1e3a8a; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #1e3a8a;">LOGO</div>`
              }
            </div>
          </div>

          <!-- Payslip Header -->
          <div style="display: flex; flex-direction: column; justify-content: space-between;">
            <div style="border: 2px solid #1e3a8a; border-radius: 8px; padding: 10px; text-align: center; background: #f8fafc;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.05em;">BULLETIN DE PAIE</h1>
            </div>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-top: 10px; border: 2px solid #1e3a8a; border-radius: 8px; overflow: hidden;">
              <div style="padding: 6px; border-right: 2px solid #1e3a8a; background: #fff;">
                <p style="margin: 0; font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Période de Paie</p>
                <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: bold; text-align: center;">${escapeHtml(periodText)}</p>
              </div>
              <div style="padding: 6px; background: #fff; text-align: center;">
                <p style="margin: 0; font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Mois de Paie</p>
                <p style="margin: 4px 0 0 0; font-size: 10px; font-weight: bold;">${escapeHtml(monthName.substring(0, 3))} ${year}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Info Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; margin-bottom: 15px;">
          <!-- Renseignements Divers -->
          <div style="border: 2px solid #1e3a8a; border-radius: 8px; padding: 8px; font-size: 10px; line-height: 1.5;">
            <p style="margin: 0 0 5px 0; font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #1e3a8a; padding-bottom: 2px;">Renseignements Divers</p>
            <div style="display: flex; justify-content: space-between;"><span>Matricule:</span><strong>${escapeHtml(person.matricule || '-')}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Statut:</span><strong>${payroll.person_type === 'teacher' ? 'ENSEIGNANT' : 'EMPLOYE'}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Catégorie:</span><strong>${escapeHtml(person.position || '-')}</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Nombre de parts:</span><strong>1</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Nationalité:</span><strong>R C I</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Date d'entrée:</span><strong>${escapeHtml(formatDate(person.hire_date) || '-')}</strong></div>
          </div>

          <!-- Employee Name & Address -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="border: 2px solid #1e3a8a; border-radius: 8px; padding: 12px; height: 100%; display: flex; flex-direction: column; justify-content: center; background: #f8fafc;">
              <p style="margin: 0 0 6px 0; font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Nom et Adresse de l'employé</p>
              <p style="margin: 0; font-size: 18px; font-weight: 800; color: #111827;">${escapeHtml(person.last_name.toUpperCase())} ${escapeHtml(person.first_name)}</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280;">${escapeHtml(person.address || 'Bonoua, Côte d\'Ivoire')}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px; border: 2px solid #1e3a8a; border-radius: 8px; overflow: hidden; font-size: 10px;">
              <div style="padding: 6px; border-right: 2px solid #1e3a8a; background: #fff;">
                <span style="font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Service</span><br/>
                <strong>${escapeHtml(person.department || 'GENERAL')}</strong>
              </div>
              <div style="padding: 6px; background: #fff;">
                <span style="font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Emploi / Poste</span><br/>
                <strong>${escapeHtml(person.position || 'Collaborateur')}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Payslip Lines Table -->
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #1e3a8a; font-size: 11px; margin-bottom: 15px;">
          <thead>
            <tr style="background: #1e3a8a; color: white; text-align: left; font-weight: bold;">
              <th style="padding: 6px 8px; border: 1px solid #1e3a8a; width: 60px;">CODES</th>
              <th style="padding: 6px 8px; border: 1px solid #1e3a8a;">LIBELLES</th>
              <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: right; width: 100px;">BASES</th>
              <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 70px;">TAUX / TX</th>
              <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: right; width: 100px;">GAINS</th>
              <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: right; width: 100px;">RETENUES</th>
            </tr>
          </thead>
          <tbody>
            <!-- Salaire de base -->
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">10</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">SALAIRE DE BASE</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(baseSalary)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;">${formatCurrency(baseSalary)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>
            <!-- Sursalaire -->
            ${sursalaire > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">20</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">SURSALAIRE</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(sursalaire)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(sursalaire)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>` : ''}
            <!-- Indemnité de transport -->
            ${transport > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">30</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">INDEMNITE DE TRANSPORT</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(transport)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(transport)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>` : ''}
            <!-- Ancienneté -->
            ${anciennete > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">40</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">ANCIENNETE</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(anciennete)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(anciennete)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>` : ''}
            <!-- Autres primes -->
            ${autresPrimes > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">50</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">AUTRES PRIMES</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(autresPrimes)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(autresPrimes)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>` : ''}
            <!-- Gratification -->
            ${gratification > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">60</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">GRATIFICATION</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(gratification)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(gratification)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>` : ''}
            <!-- Congés payés -->
            ${congesPayes > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">70</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">CONGES PAYES</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(congesPayes)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(congesPayes)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
            </tr>` : ''}

            <!-- ITS Retenue -->
            ${its > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">80</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">ITS (IMPOT SUR LE REVENU)</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(baseImposable)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">1,20%</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold; color: #dc2626;">${formatCurrency(its)}</td>
            </tr>` : ''}
            <!-- CNPS / CR Retenue -->
            ${cr > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">110</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">CR (CNPS RETRAITE SALARIE)</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(baseImposable)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">6,30%</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold; color: #dc2626;">${formatCurrency(cr)}</td>
            </tr>` : ''}
            <!-- Solidarite Retenue -->
            ${solidarite > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">120</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">IMPOT DE SOLIDARITE</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(baseImposable)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold; color: #dc2626;">${formatCurrency(solidarite)}</td>
            </tr>` : ''}
            <!-- Pharmacie Retenue -->
            ${pharmacie > 0 ? `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; font-weight: bold;">130</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db;">CREDIT PHARMACIE</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">${formatCurrency(pharmacie)}</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: center;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right;">-</td>
              <td style="padding: 6px 8px; border: 1px solid #d1d5db; text-align: right; font-weight: bold; color: #dc2626;">${formatCurrency(pharmacie)}</td>
            </tr>` : ''}

            <!-- Spacing lines to make table uniform -->
            <tr>
              <td style="padding: 10px; border: 1px solid #d1d5db;">&nbsp;</td>
              <td style="padding: 10px; border: 1px solid #d1d5db;">&nbsp;</td>
              <td style="padding: 10px; border: 1px solid #d1d5db;">&nbsp;</td>
              <td style="padding: 10px; border: 1px solid #d1d5db;">&nbsp;</td>
              <td style="padding: 10px; border: 1px solid #d1d5db;">&nbsp;</td>
              <td style="padding: 10px; border: 1px solid #d1d5db;">&nbsp;</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals & Pay Section -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border: 2px solid #1e3a8a; border-radius: 8px; overflow: hidden; margin-bottom: 15px; font-size: 11px; text-align: center;">
          <div style="padding: 8px; border-right: 2px solid #1e3a8a; background: #f8fafc;">
            <span style="font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Total Imposable</span><br/>
            <strong style="font-size: 13px;">${formatCurrency(baseImposable)}</strong>
          </div>
          <div style="padding: 8px; border-right: 2px solid #1e3a8a; background: #f8fafc;">
            <span style="font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Total Gains</span><br/>
            <strong style="font-size: 13px; color: #047857;">${formatCurrency(totalGains)}</strong>
          </div>
          <div style="padding: 8px; border-right: 2px solid #1e3a8a; background: #f8fafc;">
            <span style="font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Total Retenues</span><br/>
            <strong style="font-size: 13px; color: #dc2626;">${formatCurrency(totalRetenues)}</strong>
          </div>
          <div style="padding: 8px; background: #1e3a8a; color: white;">
            <span style="font-weight: 800; text-transform: uppercase; color: #fef08a;">Net à Payer</span><br/>
            <strong style="font-size: 14px; font-weight: 900;">${formatCurrency(netPay)}</strong>
          </div>
        </div>

        <!-- Cumuls and payment method -->
        <div style="border: 2px solid #1e3a8a; border-radius: 8px; padding: 10px; font-size: 10px;">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
            <div>
              <p style="margin: 0 0 6px 0; font-weight: 800; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #1e3a8a; padding-bottom: 2px;">CUMULS & BASES FISCALES</p>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>Jours Imposables: <strong>30 / 31</strong></div>
                <div>Base CNPS: <strong>${formatCurrency(baseImposable)}</strong></div>
                <div>Base Congés: <strong>${formatCurrency(baseSalary)}</strong></div>
                <div>Cumul Retenues: <strong>${formatCurrency(totalRetenues)}</strong></div>
              </div>
            </div>
            
            <div style="display: flex; flex-direction: column; justify-content: center; border-left: 2px solid #1e3a8a; padding-left: 15px;">
              <span style="font-weight: 800; color: #1e3a8a; text-transform: uppercase; font-size: 9px;">Mode de paiement</span>
              <strong style="font-size: 13px; color: #111827; margin-top: 4px;">${escapeHtml(details.mode_paiement || 'Virement')}</strong>
            </div>
          </div>
        </div>
        
        <!-- Stamp and signatures -->
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px;">
          <div style="text-align: center; width: 150px;">
            <p style="margin: 0 0 40px 0; text-decoration: underline; font-weight: bold;">Signature de l'employé</p>
            <p style="margin: 0; color: #9ca3af;">(Précédé de la mention lu et approuvé)</p>
          </div>
          <div style="text-align: center; width: 180px; position: relative;">
            <p style="margin: 0 0 50px 0; text-decoration: underline; font-weight: bold;">Visa de la Direction</p>
            <!-- Circular signature badge -->
            <div style="position: absolute; bottom: 5px; left: 50px; border: 2px dashed #1e3a8a; color: #1e3a8a; border-radius: 50%; padding: 8px; width: 76px; height: 76px; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:bold; text-align:center; transform: rotate(-8deg); background: rgba(255,255,255,0.85);">
              EECAD<br/>BONOUA
            </div>
          </div>
        </div>
      </section>
    </div>
    `
  );
}

export function buildContractHtml({
  school,
  contract,
  person,
}: {
  school: School;
  contract: any;
  person: any;
}) {
  const contractTypeNames: Record<string, string> = {
    stagiaire: 'DE STAGE',
    vacataire: 'DE VACATION (VACATAIRE)',
    interim: 'DE MISSION INTERIMAIRE',
    cdd: 'A DUREE DETERMINEE (CDD)',
    cdi: 'A DUREE INDETERMINEE (CDI)',
  };
  const contractTitle = `CONTRAT DE TRAVAIL ${contractTypeNames[contract.contract_type] || ''}`;
  const baseSalary = Number(contract.base_salary) || 0;
  const allowances = Number(contract.allowances) || 0;
  const totalSalary = baseSalary + allowances;

  const todayStr = formatDate(new Date().toISOString().split('T')[0]);
  const startStr = formatDate(contract.start_date);
  const endStr = contract.end_date ? formatDate(contract.end_date) : null;

  const title = `Contrat de travail - ${person.first_name} ${person.last_name}`;

  return printableShell(
    title,
    `
    <div class="page" style="background: #f1f5f9; padding: 40px 20px;">
      <section class="sheet" style="padding: 48px; border-top: 10px solid #1e3a8a; border-radius: 12px; position: relative;">
        <!-- Watermark / Logo background -->
        <div style="position: absolute; top: 35%; left: 25%; opacity: 0.03; pointer-events: none; transform: rotate(-15deg);">
          ${
            school.logo_url
              ? `<img src="${escapeHtml(school.logo_url)}" style="width: 400px; height: 400px; border-radius: 50%;" />`
              : ''
          }
        </div>

        <!-- Document Header / Letterhead -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${escapeHtml(school.name)}</h1>
            <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 700; color: #db2777;">EECAD - GROUPE LA HARPE DE DAVID</p>
            <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b;">
              BP 506 BONOUA • Tél: ${escapeHtml(school.phone || '')}<br/>
              ${school.email ? `E-mail: ${escapeHtml(school.email)}` : ''}
            </p>
          </div>
          <div>
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 70px; height: 70px; border-radius: 50%; border: 1.5px solid #1e3a8a; object-fit: cover;" />`
                : ''
            }
          </div>
        </div>

        <!-- Contract Title -->
        <div style="text-align: center; margin-bottom: 35px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.08em; border: 2px solid #1e3a8a; display: inline-block; padding: 10px 20px; border-radius: 8px; background: #f8fafc;">
            ${escapeHtml(contractTitle)}
          </h2>
        </div>

        <!-- Preamble -->
        <div style="font-size: 13px; line-height: 1.8; color: #334155; margin-bottom: 25px;">
          <p style="margin: 0 0 10px 0;"><strong>ENTRE LES SOUSSIGNÉS :</strong></p>
          
          <p style="margin: 0 0 15px 15px;">
            L'établissement scolaire <strong>${escapeHtml(school.name)}</strong>, sis à Bonoua, représenté par son Directeur,<br/>
            Ci-après désigné <strong>"L'Employeur"</strong>, d'une part,
          </p>

          <p style="margin: 0 0 10px 0;"><strong>ET :</strong></p>

          <p style="margin: 0 0 20px 15px;">
            M./Mme <strong>${escapeHtml(person.last_name.toUpperCase())} ${escapeHtml(person.first_name)}</strong>,<br/>
            Né(e) le ${escapeHtml(formatDate(person.date_of_birth) || 'Non renseigné')}, domicilié(e) à ${escapeHtml(person.address || 'Bonoua')},<br/>
            Titulaire du Matricule interne <strong>${escapeHtml(person.matricule || '-')}</strong>,<br/>
            Ci-après désigné <strong>"L'Employé"</strong>, d'autre part.
          </p>

          <p style="margin: 0; font-style: italic;">Il a été convenu et arrêté ce qui suit :</p>
        </div>

        <!-- Articles -->
        <div style="font-size: 13px; line-height: 1.8; color: #334155; space-y-15px;">
          <!-- Article 1 -->
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #1e3a8a;">ARTICLE 1 : ENGAGEMENT ET FONCTIONS</h3>
            <p style="margin: 0;">
              L'Employeur engage l'Employé sous contrat <strong>${escapeHtml(contract.contract_type.toUpperCase())}</strong> en qualité de 
              <strong>${escapeHtml(person.position || 'Collaborateur')}</strong> au sein du service <strong>${escapeHtml(person.department || 'Enseignement')}</strong>.
              L'Employé s'engage à consacrer l'intégralité de son temps professionnel aux tâches qui lui seront confiées par la Direction.
            </p>
          </div>

          <!-- Article 2 -->
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #1e3a8a;">ARTICLE 2 : DURÉE ET PÉRIODE D'ESSAI</h3>
            <p style="margin: 0;">
              Le présent contrat prend effet à compter du <strong>${escapeHtml(startStr)}</strong>. 
              ${
                endStr 
                  ? `Il est conclu pour une durée déterminée arrivant à échéance le <strong>${escapeHtml(endStr)}</strong>.` 
                  : `Il est conclu pour une durée indéterminée.`
              }
              Le contrat comporte une période d'essai réglementaire conformément à la législation du travail en Côte d'Ivoire.
            </p>
          </div>

          <!-- Article 3 -->
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #1e3a8a;">ARTICLE 3 : RÉMUNÉRATION ET AVANTAGES</h3>
            <p style="margin: 0;">
              En contrepartie de ses services, l'Employé percevra une rémunération mensuelle globale de 
              <strong>${escapeHtml(formatCurrency(totalSalary))} FCFA</strong>, ventilée comme suit :
            </p>
            <ul style="margin: 6px 0 0 20px; padding: 0; list-style-type: square;">
              <li>Salaire de base brut : <strong>${escapeHtml(formatCurrency(baseSalary))} FCFA</strong></li>
              <li>Indemnités et primes diverses : <strong>${escapeHtml(formatCurrency(allowances))} FCFA</strong></li>
            </ul>
            <p style="margin: 6px 0 0 0;">
              Cette rémunération est soumise aux cotisations sociales (CNPS) et fiscales (ITS, IGR) en vigueur.
            </p>
          </div>

          <!-- Article 4 -->
          ${
            contract.job_description
              ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #1e3a8a;">ARTICLE 4 : ATTRIBUTIONS ET MISSIONS</h3>
                <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(contract.job_description)}</p>
              </div>
              `
              : ''
          }

          <!-- Article 5 -->
          ${
            contract.terms
              ? `
              <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 800; color: #1e3a8a;">ARTICLE 5 : CLAUSES ET DISPOSITIONS PARTICULIÈRES</h3>
                <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(contract.terms)}</p>
              </div>
              `
              : ''
          }
        </div>

        <!-- Date & Location -->
        <div style="margin-top: 40px; text-align: right; font-size: 13px; color: #475569; font-style: italic;">
          Fait à Bonoua, le ${escapeHtml(todayStr)}
        </div>

        <!-- Signature Section -->
        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <div style="text-align: center; width: 200px;">
            <p style="margin: 0 0 80px 0; text-decoration: underline; color: #1e3a8a;">L'Employé</p>
            <p style="margin: 0; font-size: 11px; font-weight: normal; color: #94a3b8;">(Signature précédée de la mention manuscrite<br/>« lu et approuvé »)</p>
          </div>
          <div style="text-align: center; width: 200px;">
            <p style="margin: 0 0 80px 0; text-decoration: underline; color: #1e3a8a;">L'Employeur (Pour l'Établissement)</p>
            <p style="margin: 0; font-size: 11px; font-weight: normal; color: #94a3b8;">(Signature et Cachet)</p>
          </div>
        </div>
      </section>
    </div>
    `
  );
}

export function buildReportCardHtml({
  school,
  student,
  className,
  academicYearName,
  term,
  subjects,
  overallAverage,
  rank,
  totalStudents,
  classAverage,
  maxAverage,
  minAverage,
}: {
  school: School;
  student: PrintableStudent;
  className: string;
  academicYearName: string;
  term: string;
  subjects: {
    name: string;
    devoirsAvg: number;
    compScore: number | null;
    subjectAvg: number;
    coefficient: number;
    weightedScore: number;
  }[];
  overallAverage: number;
  rank: number;
  totalStudents: number;
  classAverage: number;
  maxAverage: number;
  minAverage: number;
}) {
  const title = `Bulletin de Notes - ${student.first_name} ${student.last_name}`;
  const termName = term === '1' ? '1er Trimestre' : term === '2' ? '2ème Trimestre' : '3ème Trimestre';

  // Determine decisions and honors
  let appreciation = 'Moyen';
  let color = '#f59e0b';
  let honor = '';

  if (overallAverage >= 16) {
    appreciation = 'Excellent';
    color = '#10b981';
    honor = 'FÉLICITATIONS';
  } else if (overallAverage >= 14) {
    appreciation = 'Très Bien';
    color = '#10b981';
    honor = 'TABLEAU D\'HONNEUR & ENCOURAGEMENTS';
  } else if (overallAverage >= 12) {
    appreciation = 'Bien';
    color = '#2563eb';
    honor = 'TABLEAU D\'HONNEUR';
  } else if (overallAverage >= 10) {
    appreciation = 'Assez Bien';
    color = '#2563eb';
  } else {
    appreciation = 'Insuffisant';
    color = '#ef4444';
  }

  const getSubjectAppreciation = (avg: number) => {
    if (avg >= 16) return 'Excellent';
    if (avg >= 14) return 'Très Bien';
    if (avg >= 12) return 'Bien';
    if (avg >= 10) return 'Assez Bien';
    return 'Insuffisant';
  };

  const totalCoeff = subjects.reduce((sum, s) => sum + s.coefficient, 0);
  const totalWeighted = subjects.reduce((sum, s) => sum + s.weightedScore, 0);

  return printableShell(
    title,
    `
    <div class="page" style="background: #f1f5f9; padding: 40px 20px;">
      <section class="sheet" style="padding: 40px; border-top: 10px solid #db2777; border-radius: 12px; position: relative;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px;">
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${escapeHtml(school.name)}</h1>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; color: #db2777;">RÉPUBLIQUE DE CÔTE D'IVOIRE • BONOUA</p>
            <p style="margin: 6px 0 0 0; font-size: 10px; color: #64748b;">BP 506 BONOUA • Devise: ${escapeHtml(school.phone || 'Avec Dieu nous ferons des exploits')}</p>
          </div>
          <div>
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 64px; height: 64px; border-radius: 50%; border: 1.5px solid #db2777; object-fit: cover;" />`
                : ''
            }
          </div>
        </div>

        <!-- Bulletin Title -->
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 3px double #db2777; display: inline-block; padding-bottom: 4px;">
            BULLETIN DE NOTES - ${escapeHtml(termName.toUpperCase())}
          </h2>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold;">Année Académique: ${escapeHtml(academicYearName)}</p>
        </div>

        <!-- Student Info Details -->
        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 20px; font-size: 12px;">
          <div style="border: 1px solid #d8e3ef; border-radius: 12px; padding: 12px; background: #f8fafc;">
            <p style="margin: 0 0 4px 0; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b;">Élève</p>
            <p style="margin: 0; font-size: 16px; font-weight: 800; color: #1e3a8a;">${escapeHtml(student.last_name.toUpperCase())} ${escapeHtml(student.first_name)}</p>
            <p style="margin: 8px 0 0 0;">Matricule: <strong>${escapeHtml(student.matricule)}</strong></p>
            <p style="margin: 4px 0 0 0;">Classe: <strong>${escapeHtml(className)}</strong></p>
          </div>
          <div style="border: 1px solid #d8e3ef; border-radius: 12px; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; justify-content: center; text-align: center;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b;">Moyenne Générale</span>
            <strong style="font-size: 26px; font-weight: 900; color: ${color}; margin-top: 4px;">${overallAverage.toFixed(2)} / 20</strong>
            ${honor ? `<span style="font-size: 9px; font-weight: 900; color: #10b981; margin-top: 4px; letter-spacing: 0.05em;">${honor}</span>` : ''}
          </div>
        </div>

        <!-- Subjects Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; border: 1.5px solid #d8e3ef;">
          <thead>
            <tr style="background: #1e3a8a; color: white; text-align: left; font-weight: bold;">
              <th style="padding: 8px; border: 1px solid #d8e3ef;">MATIÈRES</th>
              <th style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; width: 90px;">MOY. DEVOIRS</th>
              <th style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; width: 90px;">COMPOSITION</th>
              <th style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; width: 90px;">MOY. GÉNÉRALE</th>
              <th style="padding: 8px; border: 1px solid #d8e3ef; text-align: center; width: 50px;">COEFF</th>
              <th style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; width: 90px;">MOY. COEFF.</th>
              <th style="padding: 8px; border: 1px solid #d8e3ef; width: 140px;">APPRÉCIATIONS</th>
            </tr>
          </thead>
          <tbody>
            ${subjects
              .map(
                s => `
              <tr>
                <td style="padding: 8px; border: 1px solid #d8e3ef; font-weight: bold; text-transform: uppercase;">${escapeHtml(s.name)}</td>
                <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right;">${s.devoirsAvg.toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; font-weight: bold;">${s.compScore !== null ? s.compScore.toFixed(2) : '-'}</td>
                <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; font-weight: 800; background: #f8fafc;">${s.subjectAvg.toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: center;">${s.coefficient}</td>
                <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right; font-weight: bold;">${s.weightedScore.toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #d8e3ef; font-style: italic;">${getSubjectAppreciation(s.subjectAvg)}</td>
              </tr>
            `
              )
              .join('')}
            <!-- Totals Row -->
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td style="padding: 8px; border: 1px solid #d8e3ef; text-transform: uppercase;">TOTAL</td>
              <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right;">-</td>
              <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right;">-</td>
              <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right;">-</td>
              <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: center;">${totalCoeff}</td>
              <td style="padding: 8px; border: 1px solid #d8e3ef; text-align: right;">${totalWeighted.toFixed(2)}</td>
              <td style="padding: 8px; border: 1px solid #d8e3ef;">-</td>
            </tr>
          </tbody>
        </table>

        <!-- Class Summary Block -->
        <div style="border: 1px solid #d8e3ef; border-radius: 12px; padding: 15px; font-size: 11px; margin-bottom: 25px; background: #f8fafc;">
          <h3 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;">Profil et Rang dans la classe</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center;">
            <div style="padding: 6px; border-right: 1px solid #e2e8f0;">
              <span>Rang</span><br/>
              <strong style="font-size: 14px; color: #1e3a8a;">${rank}<sup>${rank === 1 ? 'er' : 'ème'}</sup> sur ${totalStudents}</strong>
            </div>
            <div style="padding: 6px; border-right: 1px solid #e2e8f0;">
              <span>Moyenne Classe</span><br/>
              <strong style="font-size: 14px; color: #64748b;">${classAverage.toFixed(2)} / 20</strong>
            </div>
            <div style="padding: 6px; border-right: 1px solid #e2e8f0;">
              <span>Moyenne Max.</span><br/>
              <strong style="font-size: 14px; color: #10b981;">${maxAverage.toFixed(2)} / 20</strong>
            </div>
            <div style="padding: 6px;">
              <span>Moyenne Min.</span><br/>
              <strong style="font-size: 14px; color: #ef4444;">${minAverage.toFixed(2)} / 20</strong>
            </div>
          </div>
        </div>

        <!-- Footer Signatures -->
        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <div style="text-align: center; width: 200px;">
            <p style="margin: 0 0 60px 0; text-decoration: underline; color: #db2777;">L'Enseignant Titulaire</p>
          </div>
          <div style="text-align: center; width: 200px;">
            <p style="margin: 0 0 60px 0; text-decoration: underline; color: #1e3a8a;">Le Directeur de l'École</p>
            <!-- Stamp simulation -->
            <div style="margin: 10px auto 0; border: 2px dashed #db2777; color: #db2777; border-radius: 50%; padding: 6px; width: 66px; height: 66px; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:bold; text-align:center; transform: rotate(-8deg); background: rgba(255,255,255,0.85);">
              HARPE DE DAVID
            </div>
          </div>
        </div>
      </section>
    </div>
    `
  );
}

function wrapDocumentWithHeader(school: any, title: string, contentHtml: string) {
  const logoHtml = school?.logo_url
    ? `<img src="${escapeHtml(school.logo_url)}" alt="${escapeHtml(school.name || '')}" style="width: 55px; height: 55px; border-radius: 12px; object-fit: cover; border: 1px solid #e2e8f0;" />`
    : `<div style="width: 55px; height: 55px; border-radius: 12px; background: #1e3a8a; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${escapeHtml((school?.name || 'GS')[0])}</div>`;

  const body = `
    <div style="max-width: 900px; margin: 0 auto; background: white; padding: 25px; font-family: system-ui, -apple-system, sans-serif;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${logoHtml}
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">${escapeHtml(school?.name || '')}</h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Maternelle et Primaire - PS au CM2</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${escapeHtml(school?.address || 'BP 506 BONOUA')} | Tél : ${escapeHtml(school?.phone || '')}</p>
          </div>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold;">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #94a3b8;">Union - Discipline - Travail</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #94a3b8;">Ministère de l'Éducation Nationale</p>
        </div>
      </div>

      ${contentHtml}
    </div>
  `;

  return printableShell(title, body);
}

export function buildClassRosterHtml({
  school,
  className,
  academicYearName = '2026-2027',
  students,
}: {
  school: any;
  className: string;
  academicYearName?: string;
  students: {
    matricule?: string;
    first_name: string;
    last_name: string;
    sex: string;
    birth_date?: string;
    parent_name?: string;
    parent_phone?: string;
  }[];
}) {
  const boysCount = students.filter(s => s.sex === 'M').length;
  const girlsCount = students.filter(s => s.sex === 'F').length;

  return wrapDocumentWithHeader(
    school,
    `LISTE OFFICIELLE DE CLASSE - ${className.toUpperCase()}`,
    `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #1e3a8a; text-transform: uppercase;">CLASSE DE : ${escapeHtml(className)}</h2>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Année Scolaire : ${escapeHtml(academicYearName)}</p>
        </div>
        <div style="text-align: right; font-size: 12px; font-weight: bold; color: #1e3a8a; background: #eff6ff; padding: 6px 12px; border-radius: 8px; border: 1px solid #bfdbfe;">
          Effectif Total : ${students.length} élèves (${boysCount} Garçons, ${girlsCount} Filles)
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #1e3a8a; color: white; text-align: left;">
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 30px; text-align: center;">N°</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 90px;">Matricule</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a;">Nom & Prénoms</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 45px; text-align: center;">Sexe</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 90px; text-align: center;">Né(e) le</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a;">Nom du Parent / Tuteur</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 110px;">Téléphone Contact</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (s, index) => `
            <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${index + 1}</td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${escapeHtml(s.matricule || '-')}</td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">${escapeHtml(s.last_name.toUpperCase())} ${escapeHtml(s.first_name)}</td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${s.sex === 'F' ? '#db2777' : '#2563eb'};">${s.sex || '-'}</td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: center;">${s.birth_date ? new Date(s.birth_date).toLocaleDateString('fr-FR') : '-'}</td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1;">${escapeHtml(s.parent_name || '-')}</td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${escapeHtml(s.parent_phone || '-')}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
        <div style="text-align: center; width: 200px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">L'Enseignant Titulaire</p>
        </div>
        <div style="text-align: center; width: 200px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">Le Directeur de l'Établissement</p>
        </div>
      </div>
    </div>
    `,
  );
}

export function buildClassAttendanceSheetHtml({
  school,
  className,
  monthName = 'Mois en cours',
  academicYearName = '2026-2027',
  students,
}: {
  school: any;
  className: string;
  monthName?: string;
  academicYearName?: string;
  students: {
    matricule?: string;
    first_name: string;
    last_name: string;
    sex: string;
  }[];
}) {
  return wrapDocumentWithHeader(
    school,
    `FICHE D'APPEL ET DE PRÉSENCE - ${className.toUpperCase()}`,
    `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #065f46; text-transform: uppercase;">REGISTRE DE PRÉSENCE : ${escapeHtml(className)}</h2>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Mois : <strong>${escapeHtml(monthName)}</strong> | Année Scolaire : ${escapeHtml(academicYearName)}</p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #065f46; background: #ecfdf5; padding: 6px 12px; border-radius: 8px; border: 1px solid #a7f3d0;">
          Légende : <strong>P</strong> = Présent | <strong>A</strong> = Absent | <strong>R</strong> = Retard
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #065f46; color: white; text-align: left;">
            <th style="padding: 6px; border: 1px solid #065f46; width: 25px; text-align: center;">N°</th>
            <th style="padding: 6px; border: 1px solid #065f46;">Nom & Prénoms</th>
            <th style="padding: 6px; border: 1px solid #065f46; width: 30px; text-align: center;">Sex</th>
            ${Array.from({ length: 31 }, (_, i) => `<th style="padding: 4px; border: 1px solid #065f46; width: 18px; text-align: center; font-size: 8px;">${i + 1}</th>`).join('')}
            <th style="padding: 4px; border: 1px solid #065f46; width: 25px; text-align: center; font-size: 8px;">Tot. Abs</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (s, index) => `
            <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${index + 1}</td>
              <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; white-space: nowrap;">${escapeHtml(s.last_name.toUpperCase())} ${escapeHtml(s.first_name)}</td>
              <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${s.sex || '-'}</td>
              ${Array.from({ length: 31 }, () => `<td style="border: 1px solid #cbd5e1;"></td>`).join('')}
              <td style="border: 1px solid #cbd5e1; background: #f1f5f9;"></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
        <div style="text-align: center; width: 200px;">
          <p style="margin: 0 0 40px 0; text-decoration: underline;">Signature de l'Enseignant</p>
        </div>
        <div style="text-align: center; width: 200px;">
          <p style="margin: 0 0 40px 0; text-decoration: underline;">Le Maître / Titulaire</p>
        </div>
      </div>
    </div>
    `,
  );
}

export function buildClassGradeSheetHtml({
  school,
  className,
  subjectName = 'Discipline / Matière',
  academicYearName = '2026-2027',
  students,
}: {
  school: any;
  className: string;
  subjectName?: string;
  academicYearName?: string;
  students: {
    matricule?: string;
    first_name: string;
    last_name: string;
  }[];
}) {
  return wrapDocumentWithHeader(
    school,
    `GRILLE DE SAISIE DES NOTES - ${className.toUpperCase()}`,
    `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c3aed; padding-bottom: 8px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #5b21b6; text-transform: uppercase;">SAISIE DES NOTES : ${escapeHtml(className)}</h2>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Matière : <strong>${escapeHtml(subjectName)}</strong> | Année Scolaire : ${escapeHtml(academicYearName)}</p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #5b21b6; background: #f5f3ff; padding: 6px 12px; border-radius: 8px; border: 1px solid #ddd6fe;">
          Semestre / Trimestre : ______________
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #5b21b6; color: white; text-align: left;">
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 30px; text-align: center;">N°</th>
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 90px;">Matricule</th>
            <th style="padding: 8px; border: 1px solid #5b21b6;">Nom & Prénoms de l'Élève</th>
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 70px; text-align: center;">Interro 1</th>
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 70px; text-align: center;">Interro 2</th>
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 70px; text-align: center;">Devoir 1</th>
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 70px; text-align: center;">Devoir 2</th>
            <th style="padding: 8px; border: 1px solid #5b21b6; width: 80px; text-align: center;">Moy. / 20</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (s, index) => `
            <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${index + 1}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${escapeHtml(s.matricule || '-')}</td>
              <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">${escapeHtml(s.last_name.toUpperCase())} ${escapeHtml(s.first_name)}</td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="border: 1px solid #cbd5e1;"></td>
              <td style="border: 1px solid #cbd5e1; background: #f8fafc;"></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
        <div style="text-align: center; width: 200px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">Date et Signature du Professeur</p>
        </div>
        <div style="text-align: center; width: 200px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">Le Directeur des Études</p>
        </div>
      </div>
    </div>
    `,
  );
}

export function buildTrialBalanceHtml({
  school,
  academicYearName = '2026-2027',
  rows,
}: {
  school: any;
  academicYearName?: string;
  rows: {
    account_number: string;
    name: string;
    total_debit: number;
    total_credit: number;
    debit_balance: number;
    credit_balance: number;
  }[];
}) {
  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0);
  const totalDebitBalance = rows.reduce((s, r) => s + r.debit_balance, 0);
  const totalCreditBalance = rows.reduce((s, r) => s + r.credit_balance, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return wrapDocumentWithHeader(
    school,
    `BALANCE GÉNÉRALE DES COMPTES (SYSCOHADA)`,
    `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #0369a1; text-transform: uppercase;">BALANCE GÉNÉRALE DU PLAN COMPTABLE</h2>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Année Scolaire : <strong>${escapeHtml(academicYearName)}</strong></p>
        </div>
        <div style="text-align: right; font-size: 11px; font-weight: bold; background: ${isBalanced ? '#f0fdf4' : '#fef2f2'}; color: ${isBalanced ? '#166534' : '#991b1b'}; padding: 6px 12px; border-radius: 8px; border: 1px solid ${isBalanced ? '#bbf7d0' : '#fecaca'};">
          ${isBalanced ? '🟢 BALANCE ÉQUILIBRÉE' : '⚠️ DÉSÉQUILIBRE COMPTABLE'}
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0369a1; color: white; text-align: left;">
            <th style="padding: 8px; border: 1px solid #0369a1; width: 90px;">N° Compte</th>
            <th style="padding: 8px; border: 1px solid #0369a1;">Intitulé du Compte</th>
            <th style="padding: 8px; border: 1px solid #0369a1; text-align: right; width: 110px;">Cumul Débit</th>
            <th style="padding: 8px; border: 1px solid #0369a1; text-align: right; width: 110px;">Cumul Crédit</th>
            <th style="padding: 8px; border: 1px solid #0369a1; text-align: right; width: 110px;">Solde Débiteur</th>
            <th style="padding: 8px; border: 1px solid #0369a1; text-align: right; width: 110px;">Solde Créditeur</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${escapeHtml(r.account_number)}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 500;">${escapeHtml(r.name)}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${r.total_debit > 0 ? formatCurrency(r.total_debit) : '-'}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${r.total_credit > 0 ? formatCurrency(r.total_credit) : '-'}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #2563eb; font-weight: bold;">${r.debit_balance > 0 ? formatCurrency(r.debit_balance) : '-'}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #059669; font-weight: bold;">${r.credit_balance > 0 ? formatCurrency(r.credit_balance) : '-'}</td>
            </tr>
          `,
            )
            .join('')}
          <tr style="background: #e0f2fe; font-weight: bold; border-top: 2px solid #0369a1;">
            <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-size: 12px;">TOTAUX GÉNÉRAUX :</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatCurrency(totalDebit)}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${formatCurrency(totalCredit)}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #1d4ed8;">${formatCurrency(totalDebitBalance)}</td>
            <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #047857;">${formatCurrency(totalCreditBalance)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
        <div style="text-align: center; width: 220px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">Le Chef Comptable</p>
        </div>
        <div style="text-align: center; width: 220px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">Le Directeur Général</p>
        </div>
      </div>
    </div>
    `,
  );
}

