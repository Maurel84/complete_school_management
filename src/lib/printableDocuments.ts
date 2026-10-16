import { formatCurrency, formatDate } from './utils';
import { IVORY_COAST_COAT_OF_ARMS_BASE64 } from './armoirieBase64';
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
  date_of_birth?: string;
  birth_date?: string;
  birth_place?: string;
  sex?: string;
  nationality?: string;
  blood_group?: string;
  parent_name?: string;
  parent_phone?: string;
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
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
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

export interface StudentCardTemplateInput {
  school: School;
  student: PrintableStudent;
  academicYearName?: string;
  className?: string;
  primaryGuardian?: string;
  primaryGuardianPhone?: string;
  directorName?: string;
  directorPhotoUrl?: string;
}

export function getIvoryCoastCoatOfArmsSvg({ size = 30, opacity = 1 }: { size?: number; opacity?: number } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:${opacity}; display:inline-block; vertical-align:middle; flex-shrink:0;">
    <!-- Sun rays (Soleil levant d'or) -->
    <g stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round">
      <path d="M60 22 L60 14"/>
      <path d="M51 24 L45 18"/>
      <path d="M69 24 L75 18"/>
      <path d="M44 29 L37 26"/>
      <path d="M76 29 L83 26"/>
      <path d="M40 37 L32 37"/>
      <path d="M80 37 L88 37"/>
    </g>
    <!-- Sun disc -->
    <circle cx="60" cy="38" r="9" fill="#F59E0B"/>

    <!-- Palm Trees flanking the shield (Deux palmiers) -->
    <g stroke="#059669" fill="none" stroke-width="2" stroke-linecap="round">
      <path d="M35 94 C33 75 31 55 42 42" stroke="#B45309" stroke-width="2.5"/>
      <path d="M42 42 C32 36 22 42 16 52"/>
      <path d="M42 42 C30 32 20 34 14 42"/>
      <path d="M42 42 C34 26 24 26 18 32"/>
      <path d="M42 42 C38 22 30 20 25 24"/>
      <path d="M42 42 C44 20 38 18 34 20"/>
      <path d="M85 94 C87 75 89 55 78 42" stroke="#B45309" stroke-width="2.5"/>
      <path d="M78 42 C88 36 98 42 104 52"/>
      <path d="M78 42 C90 32 100 34 106 42"/>
      <path d="M78 42 C86 26 96 26 102 32"/>
      <path d="M78 42 C82 22 90 20 95 24"/>
      <path d="M78 42 C76 20 82 18 86 20"/>
    </g>

    <!-- Shield (Écusson vert émeraude bordé d'or) -->
    <path d="M38 38 H82 C82 70 73 85 60 92 C47 85 38 70 38 38 Z" fill="#008751" stroke="#F59E0B" stroke-width="2.5"/>

    <!-- Elephant Head (Tête d'éléphant d'argent) -->
    <g fill="#FFFFFF">
      <ellipse cx="60" cy="53" rx="14" ry="12"/>
      <path d="M48 47 C41 43 37 51 41 62 C44 68 49 68 51 64 Z" fill="#E2E8F0"/>
      <path d="M72 47 C79 43 83 51 79 62 C76 68 71 68 69 64 Z" fill="#E2E8F0"/>
      <path d="M57 58 C56 67 55 75 60 77 C65 79 67 75 66 72 C65 70 62 70 61 72 C60 73 59 71 59 65 C59 61 61 58 61 58 Z" fill="#FFFFFF"/>
      <circle cx="53" cy="52" r="1.5" fill="#1E293B"/>
      <circle cx="67" cy="52" r="1.5" fill="#1E293B"/>
      <path d="M52 63 C48 67 45 71 43 73 C46 72 51 67 54 64 Z" fill="#FEF08A"/>
      <path d="M68 63 C72 67 75 71 77 73 C74 72 69 67 66 64 Z" fill="#FEF08A"/>
    </g>

    <!-- Lower Ribbon (Bandeau républicain officiel) -->
    <path d="M20 95 C40 91 80 91 100 95 L96 103 C78 99 42 99 24 103 Z" fill="#F59E0B" stroke="#D97706" stroke-width="0.8"/>
    <path d="M20 95 L14 99 L24 103 Z" fill="#D97706"/>
    <path d="M100 95 L106 99 L96 103 Z" fill="#D97706"/>
    <text x="60" y="99.5" font-size="4.2" font-family="Arial, sans-serif" font-weight="900" fill="#78350F" text-anchor="middle" letter-spacing="0.4">RÉPUBLIQUE DE CÔTE D'IVOIRE</text>
  </svg>`;
}

export function buildStudentCardHtml({
  school,
  student,
  academicYearName = '2026-2027',
  className,
  primaryGuardian,
  primaryGuardianPhone,
  directorName,
  directorPhotoUrl,
}: StudentCardTemplateInput) {
  const guardianNameStr = primaryGuardian || (student as any).parent_name || 'Maurel AGOHI-N’GUESSAN';
  const guardianPhoneStr = primaryGuardianPhone || (student as any).parent_phone || school.phone || '0700276689';

  let resolvedStampUrl = school.stamp_url;
  let resolvedSignatureUrl = school.signature_url;
  let resolvedDirectorName = directorName || (school as any).director_name;
  let resolvedLogoUrl = school.logo_url;

  if (typeof window !== 'undefined' && school.id) {
    try {
      const cached = localStorage.getItem(`school_branding_${school.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!resolvedStampUrl && parsed.stamp_url) resolvedStampUrl = parsed.stamp_url;
        if (!resolvedSignatureUrl && parsed.signature_url) resolvedSignatureUrl = parsed.signature_url;
        if (!resolvedDirectorName && parsed.director_name) resolvedDirectorName = parsed.director_name;
        if (!resolvedLogoUrl && parsed.logo_url) resolvedLogoUrl = parsed.logo_url;
      }
    } catch {}
  }
  if (!resolvedDirectorName) resolvedDirectorName = 'JEAN KRAZLIN';

  // Minimal dual accent line in soft national orange (#F77F00) and green (#009E60)
  const dualAccentLine = `
    <div style="display:flex; width:100%; height:2.5px; margin:2.5px 0 4.5px; border-radius:1px; overflow:hidden;">
      <div style="flex:1; background:#F77F00;"></div>
      <div style="flex:1; background:#009E60;"></div>
    </div>
  `;

  // Specimen watermark in light semi-transparent gray
  const specimenWatermark = `
    <div style="position:absolute; top:52%; left:50%; transform:translate(-50%, -50%) rotate(-23deg); font-size:15px; font-weight:900; color:rgba(100, 116, 139, 0.08); text-transform:uppercase; letter-spacing:0.18em; white-space:nowrap; pointer-events:none; z-index:0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      SPÉCIMEN – CARTE SCOLAIRE
    </div>
  `;

  return printableShell(
    `Carte scolaire officielle - ${student.first_name} ${student.last_name}`,
    `
    <div class="page" style="display:flex; align-items:center; justify-content:center; padding: 20px; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <section class="sheet" style="max-width: 320mm; padding: 20px; background: transparent; box-shadow: none;">
        
        <div style="display:flex; flex-wrap:wrap; gap:16mm; justify-content:center; align-items:center;">
          
          <!-- RECTO (FACE AVANT) -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:10px; font-weight:900; color:#1e293b; letter-spacing:0.08em; text-transform:uppercase;">RECTO (FACE AVANT)</span>
              <span style="font-size:9px; background:#eff6ff; color:#1d4ed8; padding:1px 6px; border-radius:999px; font-weight:800; border:1px solid #bfdbfe;">86 × 54 mm (CR80)</span>
            </div>
            
            <div style="width: 86mm; height: 54mm; border-radius: 4mm; overflow: hidden; position: relative; box-shadow: 0 16px 36px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06); background: linear-gradient(145deg, #ffffff 0%, #f9fafb 100%); color: #0f172a; box-sizing: border-box; border: 1.2px solid #e2e8f0; display: flex; flex-direction: column; justify-content: space-between; padding: 4.5px 6.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              
              <!-- Subtle Specimen Watermark -->
              ${specimenWatermark}

              <!-- Top Header: Coat of Arms + School Branding + Academic Year -->
              <div style="position:relative; z-index:1;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
                  
                  <!-- Left: Côte d'Ivoire Coat of Arms -->
                  <div style="flex-shrink:0; display:flex; align-items:center;">
                    <img src="${IVORY_COAST_COAT_OF_ARMS_BASE64}" alt="Armoiries de Côte d'Ivoire" style="height:25px; width:auto; object-fit:contain; display:block;" />
                  </div>

                  <!-- Center: School Logo + Name -->
                  <div style="flex:1; min-width:0; display:flex; align-items:center; justify-content:center; gap:5px; padding:0 4px;">
                    ${
                      resolvedLogoUrl
                        ? `<div style="width:20px; height:20px; border-radius:50%; background:white; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.08); overflow:hidden;">
                            <img src="${escapeHtml(resolvedLogoUrl)}" alt="${escapeHtml(school.name)}" style="width:100%; height:100%; object-fit:cover;" />
                          </div>`
                        : `<div style="width:20px; height:20px; border-radius:50%; background:#f1f5f9; border:1px solid #cbd5e1; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:9px;">🏫</div>`
                    }
                    <div style="text-align:center; min-width:0;">
                      <h2 style="margin:0; font-size:7.8px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.02em; line-height:1.15; font-family:'Inter', sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:48mm;">
                        ${escapeHtml(school.name || 'GROUPE SCOLAIRE LA HARPE DE DAVID')}
                      </h2>
                    </div>
                  </div>

                  <!-- Right: Academic Year Badge -->
                  <div style="flex-shrink:0;">
                    <div style="border:1px solid #cbd5e1; border-radius:4px; padding:1.5px 5px; font-size:6.5px; font-weight:800; color:#0f172a; background:#ffffff; text-align:center; font-family:'SF Mono', Consolas, monospace; line-height:1.1; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                      ${escapeHtml(academicYearName)}
                    </div>
                  </div>

                </div>

                <!-- Thin Elegant Horizontal Accent Line in Soft Orange and Green -->
                ${dualAccentLine}
              </div>

              <!-- Main Body: Rectangular Photo (Left) + Student Details (Right) -->
              <div style="display:flex; align-items:flex-start; gap:7px; flex:1; position:relative; z-index:1; min-height:0;">
                
                <!-- Left Side: Rectangular Student Photo -->
                <div style="flex-shrink:0;">
                  <div style="width:27mm; height:34mm; border-radius:4px; overflow:hidden; border:1.5px solid #cbd5e1; box-shadow:0 1px 4px rgba(0,0,0,0.08); background:#f8fafc; position:relative;">
                    ${
                      student.photo_url
                        ? `<img src="${escapeHtml(student.photo_url)}" alt="${escapeHtml(`${student.first_name} ${student.last_name}`)}" style="width:100%; height:100%; object-fit:cover; display:block;" />`
                        : `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%); color:#94a3b8;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.65;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span style="font-size:5px; font-weight:800; color:#64748b; margin-top:2px; letter-spacing:0.06em; text-transform:uppercase;">PHOTO</span>
                          </div>`
                    }
                  </div>
                </div>

                <!-- Right Side: Student Credentials -->
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:space-between; height:34mm; padding-left:1px;">
                  
                  <div>
                    <!-- Student Status Pill -->
                    <div style="margin-bottom:2px;">
                      <span style="font-size:5.5px; font-weight:800; color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; padding:1px 5px; border-radius:999px; text-transform:uppercase; letter-spacing:0.05em; display:inline-block;">
                        ÉLÈVE ${(student as any).gender === 'female' || (student.first_name && /elle|e$/i.test(student.first_name)) ? 'RÉGULIÈRE' : 'RÉGULIER'}
                      </span>
                    </div>

                    <!-- Student Last Name & First Name -->
                    <div style="font-size:11.5px; font-weight:900; line-height:1.12; color:#0f172a; text-transform:uppercase; letter-spacing:0.025em; font-family:'Inter', sans-serif;">
                      ${escapeHtml(student.last_name)}
                    </div>
                    <div style="font-size:9.5px; font-weight:700; line-height:1.15; color:#334155; text-transform:uppercase; margin-top:1px; font-family:'Inter', sans-serif;">
                      ${escapeHtml(student.first_name)}
                    </div>

                    <!-- Date & Lieu de Naissance -->
                    <div style="font-size:6.3px; font-weight:700; color:#334155; margin-top:2px; font-family:'Inter', sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      Né(e) le : <strong style="color:#0f172a;">${escapeHtml(student.date_of_birth ? (formatDate(student.date_of_birth) || student.date_of_birth) : ((student as any).birth_date ? (formatDate((student as any).birth_date) || (student as any).birth_date) : '14/05/2021'))}</strong>${((student as any).place_of_birth || (student as any).birth_place) ? ` à <strong style="color:#0f172a;">${escapeHtml((student as any).place_of_birth || (student as any).birth_place)}</strong>` : ' à Abidjan'}
                    </div>

                    <!-- Class Badge -->
                    <div style="margin-top:2px;">
                      <span style="display:inline-block; font-size:7.5px; font-weight:900; color:#166534; background:#f0fdf4; border:1px solid #86efac; padding:1.5px 6px; border-radius:3px; text-transform:uppercase; letter-spacing:0.04em;">
                        ${escapeHtml(className || 'MATERNELLE GS')}
                      </span>
                    </div>

                    <!-- Matricule Box -->
                    <div style="margin-top:2px; font-size:7.5px; font-weight:700; color:#0f172a; font-family:'SF Mono', Consolas, monospace; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:3px; padding:1.5px 5px; display:inline-block;">
                      Matricule : <strong style="font-weight:900; color:#0f172a;">${escapeHtml(student.matricule)}</strong>
                    </div>

                    <!-- Validity -->
                    <div style="font-size:6px; font-weight:700; color:#047857; margin-top:1.5px;">
                      Validité : 31/07/2027 ✔
                    </div>
                  </div>

                  <!-- 1D Barcode Simulation at Bottom Right -->
                  <div style="margin-top:auto; padding-top:2px;">
                    <svg width="100%" height="13" viewBox="0 0 140 13" style="display:block;">
                      <rect x="0" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="3" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="5" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="10" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="13" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="16" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="19" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="24" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="28" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="30" y="0" width="2.5" height="9" fill="#0f172a"/>
                      <rect x="34" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="37" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="42" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="45" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="49" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="52" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="57" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="60" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="64" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="67" y="0" width="2.5" height="9" fill="#0f172a"/>
                      <rect x="71" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="74" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="79" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="82" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="86" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="89" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="94" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="97" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="101" y="0" width="2.5" height="9" fill="#0f172a"/>
                      <rect x="105" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="108" y="0" width="3" height="9" fill="#0f172a"/>
                      <rect x="113" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="116" y="0" width="2" height="9" fill="#0f172a"/>
                      <rect x="120" y="0" width="1" height="9" fill="#0f172a"/>
                      <rect x="123" y="0" width="2.5" height="9" fill="#0f172a"/>
                      <rect x="128" y="0" width="1.5" height="9" fill="#0f172a"/>
                      <rect x="132" y="0" width="2" height="9" fill="#0f172a"/>
                      <text x="68" y="12.5" font-family="'SF Mono', Consolas, monospace" font-size="3.5" font-weight="700" text-anchor="middle" fill="#64748b" letter-spacing="1">${escapeHtml(student.matricule)}</text>
                    </svg>
                  </div>

                </div>

              </div>

              <!-- Very Small Text at the Bottom Edge -->
              <div style="font-size:4.5px; color:#94a3b8; text-align:center; position:relative; z-index:1; padding-top:1px;">
                Maquette SaaS – Document officiel d’identification scolaire
              </div>

            </div>
          </div>

          <!-- VERSO (FACE ARRIÈRE) -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:10px; font-weight:900; color:#1e293b; letter-spacing:0.08em; text-transform:uppercase;">VERSO (FACE ARRIÈRE)</span>
              <span style="font-size:9px; background:#f0fdf4; color:#166534; padding:1px 6px; border-radius:999px; font-weight:800; border:1px solid #bbf7d0;">CONTACT & VISA</span>
            </div>

            <div style="width: 86mm; height: 54mm; border-radius: 4mm; overflow: hidden; position: relative; box-shadow: 0 16px 36px rgba(15,23,42,0.1), 0 2px 8px rgba(15,23,42,0.05); background: #ffffff; color: #1e293b; box-sizing: border-box; border: 1.5px solid #009E60; display: flex; flex-direction: column; justify-content: space-between; padding: 4.5px 6.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              
              <!-- Subtle Specimen Watermark -->
              ${specimenWatermark}

              <!-- Header: République de Côte d'Ivoire & School Name -->
              <div style="position:relative; z-index:1;">
                <div style="line-height:1.2;">
                  <p style="margin:0; font-size:5.5px; font-weight:800; color:#009E60; text-transform:uppercase; letter-spacing:0.08em;">
                    RÉPUBLIQUE DE CÔTE D’IVOIRE – CARTE SCOLAIRE
                  </p>
                  <p style="margin:1px 0 0; font-size:7.5px; font-weight:900; color:#0f172a; text-transform:uppercase;">
                    ${escapeHtml(school.name || 'GROUPE SCOLAIRE LA HARPE DE DAVID')}
                  </p>
                </div>

                <!-- Thin Horizontal Accent Line -->
                ${dualAccentLine}
              </div>

              <!-- Content Body -->
              <div style="display:flex; flex-direction:column; gap:3px; position:relative; z-index:1; flex:1; justify-content:center;">
                
                <!-- Section Parent / Tuteur Légal à Contacter -->
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:5px; padding:3.5px 6px;">
                  <span style="font-size:5px; font-weight:800; color:#009E60; text-transform:uppercase; display:block; letter-spacing:0.04em;">
                    PARENT / TUTEUR LÉGAL À CONTACTER
                  </span>
                  <div style="font-size:7.5px; font-weight:800; color:#0f172a; margin-top:0.5px; font-family:'Inter', sans-serif;">
                    ${escapeHtml(guardianNameStr)}
                  </div>
                  <div style="font-size:7px; font-weight:700; color:#0f172a; font-family:monospace; margin-top:0.5px;">
                    Téléphone : ${escapeHtml(guardianPhoneStr)}
                  </div>
                </div>

                <!-- Section Établissement / Contact Administratif -->
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:5px; padding:2.5px 6px; font-size:5px; color:#475569;">
                  <span style="font-weight:700; color:#0f172a; text-transform:uppercase;">CONTACT ÉTABLISSEMENT :</span> 
                  ${escapeHtml(school.address || school.city || 'Abidjan, Côte d\'Ivoire')} • Tél : ${escapeHtml(school.phone || '0700276689')}
                </div>

                <!-- Bottom Row: QR Code & Visa / Stamp Area -->
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:2px;">
                  
                  <!-- Left: QR Code Placeholder -->
                  <div style="background:#ffffff; padding:1.5px; border:1px solid #cbd5e1; border-radius:4px; flex-shrink:0;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&margin=1&data=${encodeURIComponent(`CARTE SCOLAIRE CI | Eleve: ${student.first_name} ${student.last_name} | Matr: ${student.matricule} | Classe: ${className || ''} | Etablissement: ${school.name || ''} | Annee: ${academicYearName}`)}" alt="QR Code" style="width:36px; height:36px; display:block;" />
                  </div>

                  <!-- Right: Stamp & Signature Area (Le Chef d'Établissement) -->
                  <div style="flex:1; border:1px dashed #94a3b8; border-radius:5px; padding:2.5px 5px; text-align:center; height:36px; display:flex; flex-direction:column; justify-content:space-between; background:rgba(248,250,252,0.7); box-sizing:border-box;">
                    <div style="font-size:4.8px; font-weight:800; color:#0f172a; text-transform:uppercase; letter-spacing:0.04em;">
                      LE CHEF D’ÉTABLISSEMENT
                    </div>
                    
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                      <!-- Circular Official Stamp (Uploaded or SVG fallback) -->
                      ${
                        resolvedStampUrl
                          ? `<img src="${escapeHtml(resolvedStampUrl)}" alt="Cachet Officiel" style="height:26px; width:auto; max-width:32px; object-fit:contain; display:block;" />`
                          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" style="opacity:0.85; flex-shrink:0;">
                              <circle cx="12" cy="12" r="10" stroke-dasharray="2 2"/>
                              <path d="M12 6v12M6 12h12"/>
                            </svg>`
                      }
                      <!-- Executive Signature (Uploaded image or Stylized text fallback) -->
                      ${
                        resolvedSignatureUrl
                          ? `<img src="${escapeHtml(resolvedSignatureUrl)}" alt="Signature Direction" style="height:22px; width:auto; max-width:44px; object-fit:contain; display:block;" />`
                          : `<span style="font-family:'Brush Script MT', 'Dancing Script', cursive, italic; font-size:11px; color:#1e40af; font-weight:700;">
                              ${escapeHtml(resolvedDirectorName.split(' ')[0] || 'Direction')}
                            </span>`
                      }
                    </div>

                    <div style="font-size:4.2px; color:#64748b; font-style:italic;">
                      ${escapeHtml(resolvedDirectorName)} — Visa, Cachet & Signature
                    </div>
                  </div>

                </div>

              </div>

              <!-- Footer Text -->
              <div style="font-size:4.8px; color:#64748b; text-align:center; position:relative; z-index:1; padding-top:1.5px; border-top:1px solid #e2e8f0; margin-top:1px;">
                Année ${escapeHtml(academicYearName)} – République de Côte d’Ivoire – Maquette SaaS
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
    birth_place?: string;
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
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 85px;">Matricule</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a;">Nom & Prénoms</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 40px; text-align: center;">Sexe</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 85px; text-align: center;">Né(e) le</th>
            <th style="padding: 8px; border: 1px solid #1e3a8a; width: 95px;">Lieu de naissance</th>
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
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1;">${escapeHtml(s.birth_place || '-')}</td>
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

export function buildStudentAccountStatementHtml({
  school,
  student,
  className,
  academicYearName = '2026-2027',
  planName,
  totalExpected,
  totalPaid,
  remaining,
  installments = [],
  paymentHistory = [],
}: {
  school: School;
  student: PrintableStudent;
  className?: string;
  academicYearName?: string;
  planName?: string;
  totalExpected: number;
  totalPaid: number;
  remaining: number;
  installments?: { installment_number: number; label: string; amount: number; due_date: string }[];
  paymentHistory?: { receipt_number: string; payment_date: string; payment_method: string; amount: number; is_canteen?: boolean; description?: string }[];
}) {
  const title = `Relevé de compte - ${student.first_name} ${student.last_name}`;
  const nowFormatted = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Chronological installments status calculation
  let runningPaid = totalPaid;
  const enrichedInstallments = installments.map(inst => {
    const amt = Number(inst.amount) || 0;
    const paidForThisInst = Math.min(amt, runningPaid);
    const rem = Math.max(0, amt - paidForThisInst);
    runningPaid -= paidForThisInst;

    let statusLabel = 'Non Payé';
    let statusBg = '#fee2e2';
    let statusColor = '#991b1b';
    if (paidForThisInst >= amt) {
      statusLabel = 'Soldé';
      statusBg = '#dcfce7';
      statusColor = '#166534';
    } else if (paidForThisInst > 0) {
      statusLabel = 'Partiel';
      statusBg = '#fef3c7';
      statusColor = '#92400e';
    }

    return {
      ...inst,
      paid: paidForThisInst,
      remaining: rem,
      statusLabel,
      statusBg,
      statusColor,
    };
  });

  return wrapDocumentWithHeader(
    school,
    `RELEVÉ DE COMPTE FINANCIER ÉLÈVE`,
    `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 10px;">
      
      <!-- Top Student info cards -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px;">
          <p style="margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Informations Élève</p>
          <h2 style="margin: 4px 0 6px 0; font-size: 18px; color: #0f172a; font-weight: 800;">
            ${escapeHtml(student.last_name.toUpperCase())} ${escapeHtml(student.first_name)}
          </h2>
          <div style="display: flex; gap: 15px; font-size: 11px;">
            <span>Matricule : <strong style="font-family: monospace; color: #1e3a8a;">${escapeHtml(student.matricule)}</strong></span>
            <span>Classe : <strong style="color: #1e3a8a;">${escapeHtml(className || '-')}</strong></span>
            <span>Année Scolaire : <strong>${escapeHtml(academicYearName)}</strong></span>
          </div>
          ${planName ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #475569;">Plan / Formule : <strong>${escapeHtml(planName)}</strong></p>` : ''}
        </div>

        <div style="background: ${remaining === 0 ? '#f0fdf4' : remaining > 0 && totalPaid > 0 ? '#fffbeb' : '#fef2f2'}; border: 1.5px solid ${remaining === 0 ? '#86efac' : remaining > 0 && totalPaid > 0 ? '#fde68a' : '#fecaca'}; border-radius: 12px; padding: 14px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
          <p style="margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b;">Situation Globale</p>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: ${remaining === 0 ? '#15803d' : remaining > 0 && totalPaid > 0 ? '#b45309' : '#b91c1c'};">
            ${remaining === 0 ? 'COMPTE SOLDÉ' : remaining > 0 && totalPaid > 0 ? 'SOLDE PARTIEL' : 'TOTAL IMPAYÉ'}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b;">Édité le ${escapeHtml(nowFormatted)}</p>
        </div>
      </div>

      <!-- Financial Balance KPI Blocks -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px;">
        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; text-align: center;">
          <span style="font-size: 10px; text-transform: uppercase; color: #475569; font-weight: 700; display: block;">Total Frais Exigibles</span>
          <strong style="font-size: 18px; color: #0f172a; margin-top: 4px; display: block; font-family: monospace;">${escapeHtml(formatCurrency(totalExpected))}</strong>
        </div>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px; text-align: center;">
          <span style="font-size: 10px; text-transform: uppercase; color: #065f46; font-weight: 700; display: block;">Total Déjà Encaissé</span>
          <strong style="font-size: 18px; color: #047857; margin-top: 4px; display: block; font-family: monospace;">${escapeHtml(formatCurrency(totalPaid))}</strong>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; text-align: center;">
          <span style="font-size: 10px; text-transform: uppercase; color: #991b1b; font-weight: 700; display: block;">Solde Restant à Régulariser</span>
          <strong style="font-size: 18px; color: #b91c1c; margin-top: 4px; display: block; font-family: monospace;">${escapeHtml(formatCurrency(remaining))}</strong>
        </div>
      </div>

      <!-- Section 1: Échéancier officiel des tranches -->
      ${
        enrichedInstallments.length > 0
          ? `
          <div style="margin-bottom: 22px;">
            <h3 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #bfdbfe; padding-bottom: 4px;">
              1. Échéancier contractuel des tranches de paiement
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #1e3a8a; color: white; text-align: left;">
                  <th style="padding: 7px 10px; border: 1px solid #1e3a8a;">Tranche / Versement</th>
                  <th style="padding: 7px 10px; border: 1px solid #1e3a8a; text-align: center; width: 110px;">Date d'échéance</th>
                  <th style="padding: 7px 10px; border: 1px solid #1e3a8a; text-align: right; width: 110px;">Montant Attendu</th>
                  <th style="padding: 7px 10px; border: 1px solid #1e3a8a; text-align: right; width: 110px;">Déjà Versé</th>
                  <th style="padding: 7px 10px; border: 1px solid #1e3a8a; text-align: right; width: 110px;">Reste Dû</th>
                  <th style="padding: 7px 10px; border: 1px solid #1e3a8a; text-align: center; width: 90px;">Statut</th>
                </tr>
              </thead>
              <tbody>
                ${enrichedInstallments
                  .map(
                    (inst, idx) => `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">${escapeHtml(inst.label)}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: center;">${escapeHtml(formatDate(inst.due_date))}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${escapeHtml(formatCurrency(inst.amount))}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #047857; font-weight: bold;">${escapeHtml(formatCurrency(inst.paid))}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #b91c1c; font-weight: bold;">${escapeHtml(formatCurrency(inst.remaining))}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: center;">
                      <span style="background: ${inst.statusBg}; color: ${inst.statusColor}; padding: 3px 8px; border-radius: 6px; font-size: 9.5px; font-weight: 800; text-transform: uppercase;">
                        ${inst.statusLabel}
                      </span>
                    </td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          `
          : ''
      }

      <!-- Section 2: Historique chronologique des règlements effectués -->
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #bfdbfe; padding-bottom: 4px;">
          2. Historique complet des règlements et encaissements enregistrés
        </h3>
        ${
          paymentHistory.length === 0
            ? `<p style="font-size: 11px; color: #64748b; font-style: italic; padding: 10px 0;">Aucun versement n'a été enregistré à ce jour pour cet élève.</p>`
            : `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #0f766e; color: white; text-align: left;">
                  <th style="padding: 7px 10px; border: 1px solid #0f766e; width: 35px; text-align: center;">N°</th>
                  <th style="padding: 7px 10px; border: 1px solid #0f766e; width: 100px; text-align: center;">Date</th>
                  <th style="padding: 7px 10px; border: 1px solid #0f766e; width: 130px;">N° Reçu / Réf</th>
                  <th style="padding: 7px 10px; border: 1px solid #0f766e;">Nature de l'encaissement</th>
                  <th style="padding: 7px 10px; border: 1px solid #0f766e; width: 110px;">Mode</th>
                  <th style="padding: 7px 10px; border: 1px solid #0f766e; text-align: right; width: 120px;">Montant Versé</th>
                </tr>
              </thead>
              <tbody>
                ${paymentHistory
                  .map(
                    (p, idx) => `
                  <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: center;">${escapeHtml(formatDate(p.payment_date))}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #1e3a8a;">${escapeHtml(p.receipt_number)}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1;">${escapeHtml(p.description || (p.is_canteen ? 'Cantine scolaire' : 'Frais de scolarité / inscription'))}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-transform: capitalize;">${escapeHtml(p.payment_method)}</td>
                    <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: 800; color: #047857;">${escapeHtml(formatCurrency(p.amount))}</td>
                  </tr>
                `,
                  )
                  .join('')}
                <tr style="background: #f0fdf4; font-weight: bold; border-top: 2px solid #0f766e;">
                  <td colspan="5" style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">TOTAL DES VERSEMENTS EFFECTUÉS :</td>
                  <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-size: 12px; color: #047857;">${escapeHtml(formatCurrency(totalPaid))}</td>
                </tr>
              </tbody>
            </table>
            `
        }
      </div>

      <!-- Signatures -->
      <div style="margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
        <div style="text-align: center; width: 220px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">Le Responsable Financier / Parent</p>
        </div>
        <div style="text-align: center; width: 220px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">La Comptabilité / La Caisse</p>
        </div>
      </div>
    </div>
    `,
  );
}

export function buildClassSupplyListHtml({
  school,
  className,
  academicYearName = '2026-2027',
  items,
}: {
  school: School;
  className: string;
  academicYearName?: string;
  items: {
    item_name: string;
    category: string;
    quantity: number;
    unit_price: number;
    is_mandatory: boolean;
    notes?: string;
  }[];
}) {
  const title = `Liste des fournitures - ${className}`;
  const totalBudget = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  const mandatoryCount = items.filter(i => i.is_mandatory).length;

  const categoryLabels: Record<string, string> = {
    manuel: '📚 Manuels & Livres au programme',
    cahier: '📓 Cahiers',
    papeterie: '✏️ Papeterie & Écriture',
    geometrie: '📐 Matériel géométrique & Dessin',
    uniforme: '👔 Tenues & Accessoires',
    autre: '📦 Autres fournitures',
  };

  // Group items by category
  const grouped: Record<string, typeof items> = {};
  items.forEach(it => {
    const cat = it.category || 'autre';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(it);
  });

  return wrapDocumentWithHeader(
    school,
    `LISTE OFFICIELLE DES FOURNITURES & MANUELS SCOLAIRES`,
    `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 10px;">
      
      <!-- Top banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px;">
        <div>
          <h2 style="margin: 0; font-size: 19px; color: #1e3a8a; text-transform: uppercase; font-weight: 900;">
            CLASSE : ${escapeHtml(className.toUpperCase())}
          </h2>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">
            Année Académique : <strong>${escapeHtml(academicYearName)}</strong>
          </p>
        </div>
        <div style="text-align: right; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 8px 14px;">
          <p style="margin: 0; font-size: 10px; font-weight: bold; color: #1e40af; text-transform: uppercase;">Budget Estimatif Total</p>
          <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 900; color: #1e3a8a; font-family: monospace;">
            ${escapeHtml(formatCurrency(totalBudget))}
          </p>
          <p style="margin: 2px 0 0 0; font-size: 9.5px; color: #64748b;">
            ${items.length} articles (${mandatoryCount} obligatoires)
          </p>
        </div>
      </div>

      <div style="margin-bottom: 15px; font-size: 11px; color: #475569; background: #f8fafc; border-left: 4px solid #2563eb; padding: 8px 12px; border-radius: 0 8px 8px 0;">
        <strong>Chers Parents :</strong> Prière de vous conformer rigoureusement aux titres et éditions indiqués ci-dessous pour assurer un bon suivi pédagogique de l'élève dès le premier jour de la rentrée des classes.
      </div>

      <!-- Categories & Items Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #1e3a8a; color: white; text-align: left;">
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a; width: 35px; text-align: center;">N°</th>
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a;">Désignation du Manuel / Fourniture</th>
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a; width: 140px;">Catégorie</th>
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a; width: 55px; text-align: center;">Qté</th>
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a; width: 95px; text-align: right;">Prix Indicatif</th>
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a; width: 105px; text-align: right;">Total Ligne</th>
            <th style="padding: 7px 10px; border: 1px solid #1e3a8a; width: 85px; text-align: center;">Caractère</th>
          </tr>
        </thead>
        <tbody>
          ${
            items.length === 0
              ? `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Aucune fourniture n'a encore été configurée pour cette classe.</td></tr>`
              : Object.keys(grouped)
                  .map(cat => {
                    const catItems = grouped[cat];
                    const catTitle = categoryLabels[cat] || cat.toUpperCase();
                    return `
                      <tr style="background: #f1f5f9; font-weight: 800; color: #1e293b;">
                        <td colspan="7" style="padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 10.5px; letter-spacing: 0.04em;">
                          ${escapeHtml(catTitle)}
                        </td>
                      </tr>
                      ${catItems
                        .map((it, idx) => {
                          const totalLine = Number(it.quantity) * Number(it.unit_price);
                          return `
                          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfd'};">
                            <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                            <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">
                              <strong style="color: #0f172a;">${escapeHtml(it.item_name)}</strong>
                              ${it.notes ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">ℹ️ ${escapeHtml(it.notes)}</div>` : ''}
                            </td>
                            <td style="padding: 6px 10px; border: 1px solid #cbd5e1; color: #475569; font-size: 10px;">
                              ${escapeHtml(categoryLabels[it.category] || it.category)}
                            </td>
                            <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #1e3a8a;">
                              ${it.quantity}
                            </td>
                            <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">
                              ${it.unit_price > 0 ? formatCurrency(it.unit_price) : '-'}
                            </td>
                            <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">
                              ${totalLine > 0 ? formatCurrency(totalLine) : '-'}
                            </td>
                            <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">
                              <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${it.is_mandatory ? '#fee2e2' : '#f1f5f9'}; color: ${it.is_mandatory ? '#991b1b' : '#475569'}; text-transform: uppercase;">
                                ${it.is_mandatory ? 'Obligatoire' : 'Facultatif'}
                              </span>
                            </td>
                          </tr>
                        `;
                        })
                        .join('')}
                    `;
                  })
                  .join('')
          }
          <tr style="background: #e0f2fe; font-weight: bold; border-top: 2px solid #1e3a8a;">
            <td colspan="5" style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-size: 11.5px;">BUDGET ESTIMATIF TOTAL :</td>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-size: 12px; color: #1e3a8a;">${formatCurrency(totalBudget)}</td>
            <td style="padding: 8px 10px; border: 1px solid #cbd5e1;"></td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures -->
      <div style="margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
        <div style="text-align: center; width: 220px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">L'Enseignant / Le Titulaire</p>
        </div>
        <div style="text-align: center; width: 220px;">
          <p style="margin: 0 0 50px 0; text-decoration: underline;">La Direction des Études</p>
        </div>
      </div>
    </div>
    `,
  );
}

export interface SchoolCertificateInput {
  school: School;
  certificateType: 'attestation_scolarite' | 'certificat_frequentation';
  student: {
    first_name: string;
    last_name: string;
    matricule: string;
    date_of_birth?: string;
    place_of_birth?: string;
    gender?: string;
    photo_url?: string;
  };
  className: string;
  academicYearName: string;
  referenceNumber?: string;
  city?: string;
  date?: string;
  directorName?: string;
  purpose?: string;
}

export function buildSchoolCertificateHtml({
  school,
  certificateType,
  student,
  className,
  academicYearName,
  referenceNumber,
  city,
  date,
  directorName,
  purpose,
}: SchoolCertificateInput) {
  const isAttestation = certificateType === 'attestation_scolarite';
  const docTitle = isAttestation ? 'ATTESTATION DE SCOLARITÉ' : 'CERTIFICAT DE FRÉQUENTATION';
  const docSub = isAttestation
    ? 'Attestation d’inscription régulière et de scolarité'
    : 'Certificat constatant la fréquentation assidue des cours';
  const ref = referenceNumber || `REF-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';
  const genderTitle = student.gender === 'F' ? 'l’élève (Fille)' : 'l’élève';

  return printableShell(
    `${docTitle} - ${student.first_name} ${student.last_name}`,
    `
    <div class="page" style="padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div class="sheet" style="max-width: 210mm; margin: 0 auto; background: white; border: 2px solid #cbd5e1; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; min-height: 270mm;">
        
        <!-- Filigrane d'authenticité -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(148, 163, 184, 0.08); pointer-events: none; text-transform: uppercase; white-space: nowrap; user-select: none;">
          ${escapeHtml(school.name)}
        </div>

        <!-- En-tête officiel -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #1e3a8a;">
          <div style="display: flex; align-items: center; gap: 16px; max-width: 60%;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0; padding: 4px;" />`
                : `<div style="width: 76px; height: 76px; border-radius: 12px; background: #1e3a8a; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${escapeHtml(school.name.substring(0, 2).toUpperCase())}</div>`
            }
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; line-height: 1.2;">${escapeHtml(school.name)}</h2>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                ${escapeHtml(school.address || '')}${school.city ? `, ${escapeHtml(school.city)}` : ''}<br />
                ${school.phone ? `Tél : ${escapeHtml(school.phone)}` : ''} ${school.email ? `| Email : ${escapeHtml(school.email)}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 11px; color: #475569;">
            <p style="margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
            <p style="margin: 2px 0 0; font-style: italic; color: #64748b;">Union - Discipline - Travail</p>
            <p style="margin: 6px 0 0; font-weight: 700; color: #0284c7;">MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
            <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">N° d'enregistrement : <strong>${escapeHtml(ref)}</strong></p>
          </div>
        </div>

        <!-- Titre du document -->
        <div style="text-align: center; margin: 40px 0 35px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #0284c7; background: #f0f9ff; padding: 4px 14px; border-radius: 999px; border: 1px solid #bae6fd; margin-bottom: 8px;">DOCUMENT OFFICIEL</span>
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; text-transform: uppercase; border-bottom: 3px double #1e3a8a; display: inline-block; padding-bottom: 6px;">
            ${escapeHtml(docTitle)}
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #64748b; font-style: italic;">
            ${escapeHtml(docSub)}
          </p>
        </div>

        <!-- Corps de l'attestation -->
        <div style="font-size: 14.5px; line-height: 1.8; color: #1e293b; margin: 0 16px;">
          <p style="margin: 0 0 20px;">
            Le Chef d'Établissement soussigné, atteste par la présente que :
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #1e3a8a; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
            <div style="display: grid; grid-template-columns: 140px 1fr; row-gap: 12px; font-size: 14px;">
              <span style="font-weight: 700; color: #475569;">Nom et Prénoms :</span>
              <span style="font-weight: 900; font-size: 16px; color: #0f172a; text-transform: uppercase;">${escapeHtml(student.last_name)} ${escapeHtml(student.first_name)}</span>

              <span style="font-weight: 700; color: #475569;">Matricule :</span>
              <span style="font-family: monospace; font-weight: 800; font-size: 15px; color: #0284c7;">${escapeHtml(student.matricule)}</span>

              ${student.date_of_birth ? `
                <span style="font-weight: 700; color: #475569;">Né(e) le :</span>
                <span><strong>${escapeHtml(formatDate(student.date_of_birth))}</strong> ${student.place_of_birth ? `à <strong>${escapeHtml(student.place_of_birth)}</strong>` : ''}</span>
              ` : ''}

              <span style="font-weight: 700; color: #475569;">Classe fréquentée :</span>
              <span style="font-weight: 800; color: #1e3a8a; font-size: 15px;">${escapeHtml(className)}</span>

              <span style="font-weight: 700; color: #475569;">Année scolaire :</span>
              <span style="font-weight: 800; color: #0f172a;">${escapeHtml(academicYearName)}</span>
            </div>
          </div>

          <p style="margin: 24px 0 16px; text-align: justify;">
            Est régulièrement inscrit(e) sur les registres matricules de l'établissement et suit avec assiduité l'ensemble des enseignements et activités pédagogiques prescrits par les programmes officiels.
          </p>

          ${purpose ? `
            <p style="margin: 12px 0; font-size: 13.5px; color: #334155; background: #f1f5f9; padding: 10px 14px; border-radius: 8px;">
              <strong>Objet / Mention spéciale :</strong> ${escapeHtml(purpose)}
            </p>
          ` : ''}

          <p style="margin: 24px 0 0; text-align: justify; font-style: italic; color: #334155;">
            En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit devant toutes autorités compétentes et administrations.
          </p>
        </div>

        <!-- Date et Signatures -->
        <div style="margin-top: 50px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 260px;">
            <p style="margin: 0; font-size: 13px; color: #475569;">Fait à ${escapeHtml(currentCity)}, le ${escapeHtml(currentDate)}</p>
            <p style="margin: 8px 0 0; font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              Le Chef d'Établissement / La Direction
            </p>
            <p style="margin: 4px 0 60px; font-size: 12px; color: #64748b;">(Signature et Cachet Officiel)</p>
            
            <div style="border-top: 1px dashed #94a3b8; padding-top: 8px;">
              <span style="font-weight: 700; font-size: 13px; color: #1e3a8a;">
                ${escapeHtml(directorName || 'Le Directeur des Études')}
              </span>
            </div>
          </div>
        </div>

        <!-- Bas de page sécurisé -->
        <div style="position: absolute; bottom: 25px; left: 40px; right: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8;">
          <div>Authenticité certifiée - Système de Gestion Scolaire Numérique</div>
          <div>Page 1/1 • Ref: ${escapeHtml(ref)}</div>
        </div>

      </div>
    </div>
    `,
  );
}

export interface ParentSummonsInput {
  school: School;
  student: {
    first_name: string;
    last_name: string;
    matricule: string;
  };
  parentName: string;
  parentPhone?: string;
  className: string;
  referenceNumber?: string;
  summonsDate: string;
  summonsTime: string;
  location?: string;
  reason: string;
  directorName?: string;
  city?: string;
  date?: string;
  notes?: string;
}

export function buildParentSummonsHtml({
  school,
  student,
  parentName,
  parentPhone,
  className,
  referenceNumber,
  summonsDate,
  summonsTime,
  location,
  reason,
  directorName,
  city,
  date,
  notes,
}: ParentSummonsInput) {
  const ref = referenceNumber || `CONV-${Math.floor(100000 + Math.random() * 900000)}`;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';

  return printableShell(
    `Convocation Parent - ${student.first_name} ${student.last_name}`,
    `
    <div class="page" style="padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div class="sheet" style="max-width: 210mm; margin: 0 auto; background: white; border: 2px solid #cbd5e1; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative;">
        
        <!-- En-tête -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0f172a;">
          <div style="display: flex; align-items: center; gap: 14px; max-width: 65%;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 70px; height: 70px; object-fit: contain; border-radius: 10px; border: 1px solid #e2e8f0; padding: 4px;" />`
                : `<div style="width: 66px; height: 66px; border-radius: 10px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${escapeHtml(school.name.substring(0, 2).toUpperCase())}</div>`
            }
            <div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${escapeHtml(school.name)}</h2>
              <p style="margin: 3px 0 0; font-size: 11px; color: #64748b;">
                ${escapeHtml(school.address || '')}${school.city ? `, ${escapeHtml(school.city)}` : ''} | Tél : ${escapeHtml(school.phone || '')}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 11px;">
            <p style="margin: 0; color: #64748b;">Fait à ${escapeHtml(currentCity)}, le ${escapeHtml(currentDate)}</p>
            <p style="margin: 4px 0 0; font-weight: 800; color: #dc2626;">RÉF : ${escapeHtml(ref)}</p>
          </div>
        </div>

        <!-- Titre -->
        <div style="text-align: center; margin: 30px 0 25px;">
          <div style="display: inline-block; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 24px;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em;">
              CONVOCATION DE PARENT / TUTEUR LÉGAL
            </h1>
          </div>
        </div>

        <!-- Destinataire -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
            <div>
              <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">À l'attention de :</p>
              <p style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">${escapeHtml(parentName || 'Parent / Tuteur de l’élève')}</p>
              ${parentPhone ? `<p style="margin: 2px 0 0; font-size: 12px; color: #475569;">Contact : <strong>${escapeHtml(parentPhone)}</strong></p>` : ''}
            </div>
            <div>
              <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Concernant l'élève :</p>
              <p style="margin: 0; font-size: 15px; font-weight: 800; color: #1e3a8a;">${escapeHtml(student.last_name)} ${escapeHtml(student.first_name)}</p>
              <p style="margin: 2px 0 0; font-size: 12px; color: #475569;">Classe : <strong>${escapeHtml(className)}</strong> | Matr. : <strong>${escapeHtml(student.matricule)}</strong></p>
            </div>
          </div>
        </div>

        <!-- Corps du message -->
        <div style="font-size: 14px; line-height: 1.7; color: #1e293b;">
          <p style="margin: 0 0 16px;">
            Madame, Monsieur le Responsable Légal,
          </p>
          <p style="margin: 0 0 16px; text-align: justify;">
            La Direction de l'établissement vous prie de bien vouloir vous présenter impérativement au sein de notre établissement pour un entretien personnel concernant votre enfant :
          </p>

          <!-- Détails du Rendez-vous -->
          <div style="background: #fff7ed; border: 1.5px solid #fdba74; border-radius: 12px; padding: 18px 24px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: 140px 1fr; row-gap: 10px; font-size: 14px;">
              <span style="font-weight: 700; color: #9a3412;">📅 Date du rendez-vous :</span>
              <span style="font-weight: 800; font-size: 15px; color: #c2410c;">${escapeHtml(summonsDate)}</span>

              <span style="font-weight: 700; color: #9a3412;">⏰ Heure précise :</span>
              <span style="font-weight: 800; font-size: 15px; color: #c2410c;">${escapeHtml(summonsTime)}</span>

              <span style="font-weight: 700; color: #9a3412;">📍 Lieu d'accueil :</span>
              <span style="font-weight: 700; color: #1e293b;">${escapeHtml(location || 'Bureau de la Direction / Administration')}</span>

              <span style="font-weight: 700; color: #9a3412;">🎯 Objet / Motif :</span>
              <span style="font-weight: 800; color: #991b1b; font-size: 14.5px;">${escapeHtml(reason)}</span>
            </div>
          </div>

          ${notes ? `
            <div style="margin: 16px 0; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #334155;">
              <strong>Observations complémentaires :</strong> ${escapeHtml(notes)}
            </div>
          ` : ''}

          <p style="margin: 18px 0 0; font-weight: 600; color: #991b1b;">
            ⚠️ Compte tenu de l'importance de cette rencontre pour la scolarité et l'avenir de l'élève, votre présence effective est indispensable. En cas d'empêchement majeur, prière d'informer immédiatement la direction pour reprogrammer la date.
          </p>
        </div>

        <!-- Signature Direction -->
        <div style="margin-top: 35px; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 240px;">
            <p style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              La Direction de l'Établissement
            </p>
            <p style="margin: 4px 0 45px; font-size: 11px; color: #64748b;">(Signature et Cachet)</p>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px;">
              <span style="font-weight: 700; font-size: 12px; color: #1e3a8a;">${escapeHtml(directorName || 'Le Chef d’Établissement')}</span>
            </div>
          </div>
        </div>

        <!-- Coupon détachable pour le parent -->
        <div style="margin-top: 40px; border-top: 2px dashed #94a3b8; padding-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
              ✂️ TALON DE CONFIRMATION / ACCUSÉ DE RÉCEPTION (À RETOURNER SIGNÉ À L'ÉCOLE SOUS 48H)
            </span>
            <span style="font-size: 10px; font-family: monospace; color: #94a3b8;">Réf: ${escapeHtml(ref)}</span>
          </div>

          <div style="font-size: 12px; line-height: 1.6; color: #334155; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <p style="margin: 0 0 8px;">
              Je soussigné(e) <strong>${escapeHtml(parentName || '....................................................................')}</strong>, 
              responsable de l'élève <strong>${escapeHtml(student.last_name)} ${escapeHtml(student.first_name)}</strong> (${escapeHtml(className)}), 
              confirme avoir reçu la convocation pour le <strong>${escapeHtml(summonsDate)}</strong> à <strong>${escapeHtml(summonsTime)}</strong>.
            </p>
            <div style="display: flex; gap: 30px; margin: 10px 0;">
              <span>[ ] Confirme ma présence à l'heure indiquée</span>
              <span>[ ] Sollicite un report au : ........................................</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px;">
              <span>Date : ........................................</span>
              <span>Signature du Parent / Tuteur : ....................................................</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    `,
  );
}

export interface HonorDiplomaInput {
  school: School;
  diplomaType: 'reussite' | 'tableau_honneur' | 'excellence' | 'encouragement';
  student: {
    first_name: string;
    last_name: string;
    matricule: string;
    photo_url?: string;
  };
  className: string;
  academicYearName: string;
  periodLabel?: string;
  average?: number;
  rank?: number | string;
  distinction?: string;
  city?: string;
  date?: string;
  teacherName?: string;
  directorName?: string;
}

export function buildHonorDiplomaHtml({
  school,
  diplomaType,
  student,
  className,
  academicYearName,
  periodLabel,
  average,
  rank,
  distinction,
  city,
  date,
  teacherName,
  directorName,
}: HonorDiplomaInput) {
  const typeTitles: Record<string, { title: string; subtitle: string; color: string; badge: string }> = {
    reussite: {
      title: 'DIPLÔME DE RÉUSSITE',
      subtitle: 'Pour la brillante réussite de l’année académique',
      color: '#0f766e',
      badge: 'FÉLICITATIONS OFFICIELLES',
    },
    tableau_honneur: {
      title: 'TABLEAU D’HONNEUR',
      subtitle: 'Avec les Félicitations du Conseil des Maîtres & Professeurs',
      color: '#b45309',
      badge: 'MENTION HONORIFIQUE',
    },
    excellence: {
      title: 'PRIX D’EXCELLENCE',
      subtitle: 'Pour l’exemplarité de son travail et son esprit d’effort',
      color: '#1e3a8a',
      badge: 'MAJOR & EXCELLENCE',
    },
    encouragement: {
      title: 'DIPLÔME D’ENCOURAGEMENT',
      subtitle: 'Pour ses progrès constants et son assiduité remarquable',
      color: '#4338ca',
      badge: 'ENCOURAGEMENTS',
    },
  };

  const meta = typeTitles[diplomaType] || typeTitles.reussite;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';

  return printableShell(
    `${meta.title} - ${student.first_name} ${student.last_name}`,
    `
    <div class="page" style="padding: 20px; font-family: 'Georgia', serif; color: #1e293b;">
      <div class="sheet" style="max-width: 297mm; min-height: 200mm; margin: 0 auto; background: #fffefb; border: 12px double ${meta.color}; border-radius: 18px; padding: 40px 50px; box-shadow: 0 16px 40px rgba(0,0,0,0.12); position: relative; box-sizing: border-box;">
        
        <!-- Ornements d'angle -->
        <div style="position: absolute; top: 12px; left: 16px; font-size: 26px; color: ${meta.color};">✦</div>
        <div style="position: absolute; top: 12px; right: 16px; font-size: 26px; color: ${meta.color};">✦</div>
        <div style="position: absolute; bottom: 12px; left: 16px; font-size: 26px; color: ${meta.color};">✦</div>
        <div style="position: absolute; bottom: 12px; right: 16px; font-size: 26px; color: ${meta.color};">✦</div>

        <!-- En-tête -->
        <div style="text-align: center; border-bottom: 2px solid ${meta.color}; padding-bottom: 18px; margin-bottom: 25px;">
          <p style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b;">
            RÉPUBLIQUE DE CÔTE D'IVOIRE • MINISTÈRE DE L'ÉDUCATION NATIONALE
          </p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 10px;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 50px; height: 50px; object-fit: contain;" />`
                : ''
            }
            <h2 style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
              ${escapeHtml(school.name)}
            </h2>
          </div>
          <p style="margin: 4px 0 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #64748b;">
            ${escapeHtml(school.address || '')}${school.city ? ` - ${escapeHtml(school.city)}` : ''}
          </p>
        </div>

        <!-- Badge & Grand Titre -->
        <div style="text-align: center; margin: 20px 0 25px;">
          <div style="display: inline-block; padding: 4px 18px; border-radius: 999px; background: ${meta.color}; color: white; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px;">
            ${escapeHtml(meta.badge)}
          </div>
          <h1 style="margin: 0; font-size: 38px; font-weight: 900; letter-spacing: 0.08em; color: ${meta.color}; text-transform: uppercase; text-shadow: 1px 1px 2px rgba(0,0,0,0.08);">
            ${escapeHtml(meta.title)}
          </h1>
          <p style="margin: 8px 0 0; font-style: italic; font-size: 15px; color: #475569;">
            ${escapeHtml(meta.subtitle)}
          </p>
        </div>

        <!-- Décerné à -->
        <div style="text-align: center; margin: 25px 0;">
          <p style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b;">
            Décerné avec honneur à l'élève :
          </p>
          <div style="display: inline-block; margin: 12px auto; padding: 8px 30px; border-bottom: 2px solid ${meta.color};">
            <span style="font-size: 30px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">
              ${escapeHtml(student.last_name)} ${escapeHtml(student.first_name)}
            </span>
          </div>
          <p style="margin: 4px 0 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #334155;">
            Inscrit(e) en classe de <strong>${escapeHtml(className)}</strong> • Matricule : <strong style="font-family: monospace;">${escapeHtml(student.matricule)}</strong>
          </p>
          <p style="margin: 4px 0 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #64748b;">
            ${escapeHtml(periodLabel || `Année Scolaire ${academicYearName}`)}
          </p>
        </div>

        <!-- Performances clés -->
        ${
          average !== undefined || rank !== undefined || distinction
            ? `
          <div style="display: flex; justify-content: center; gap: 30px; margin: 24px 0;">
            ${
              average !== undefined
                ? `
              <div style="background: white; border: 1.5px solid ${meta.color}; border-radius: 12px; padding: 10px 22px; text-align: center; min-width: 120px;">
                <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Moyenne</div>
                <div style="font-size: 22px; font-weight: 900; color: ${meta.color};">${average.toFixed(2)} / 20</div>
              </div>
            `
                : ''
            }
            ${
              rank !== undefined
                ? `
              <div style="background: white; border: 1.5px solid ${meta.color}; border-radius: 12px; padding: 10px 22px; text-align: center; min-width: 120px;">
                <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Rang</div>
                <div style="font-size: 22px; font-weight: 900; color: ${meta.color};">${rank}${typeof rank === 'number' && rank === 1 ? 'er' : 'ème'}</div>
              </div>
            `
                : ''
            }
            ${
              distinction
                ? `
              <div style="background: white; border: 1.5px solid ${meta.color}; border-radius: 12px; padding: 10px 22px; text-align: center; min-width: 140px;">
                <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Mention</div>
                <div style="font-size: 18px; font-weight: 900; color: ${meta.color};">${escapeHtml(distinction)}</div>
              </div>
            `
                : ''
            }
          </div>
        `
            : ''
        }

        <!-- Signatures & Sceau -->
        <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 40px; font-family: 'Segoe UI', Arial, sans-serif;">
          <div style="text-align: center; width: 200px;">
            <p style="margin: 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              Le Professeur Principal
            </p>
            <div style="height: 55px;"></div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 6px;">
              <span style="font-size: 12px; color: #475569;">${escapeHtml(teacherName || 'Le Titulaire de Classe')}</span>
            </div>
          </div>

          <!-- Sceau doré central -->
          <div style="text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 50%; border: 3px double ${meta.color}; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: #fffcf0; color: ${meta.color}; font-weight: 900; font-size: 10px; letter-spacing: 0.05em; text-align: center; text-transform: uppercase; padding: 6px;">
              SCEAU OFFICIEL
            </div>
            <p style="margin: 6px 0 0; font-size: 10px; color: #94a3b8;">Fait à ${escapeHtml(currentCity)}, le ${escapeHtml(currentDate)}</p>
          </div>

          <div style="text-align: center; width: 200px;">
            <p style="margin: 0; font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              Le Chef d'Établissement
            </p>
            <div style="height: 55px;"></div>
            <div style="border-top: 1px dashed #94a3b8; padding-top: 6px;">
              <span style="font-size: 12px; color: #475569;">${escapeHtml(directorName || 'La Direction Générale')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    `,
  );
}

export interface WorkAttestationInput {
  school: School;
  employee: {
    first_name: string;
    last_name: string;
    matricule?: string;
    position?: string;
    department?: string;
    contract_type?: string;
    hire_date?: string;
    date_of_birth?: string;
    place_of_birth?: string;
    phone?: string;
    cni_number?: string;
    sex?: string;
    photo_url?: string;
  };
  referenceNumber?: string;
  city?: string;
  date?: string;
  directorName?: string;
  purpose?: string;
}

export function buildWorkAttestationHtml({
  school,
  employee,
  referenceNumber,
  city,
  date,
  directorName,
  purpose,
}: WorkAttestationInput) {
  const ref = referenceNumber || `AT-RH-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';
  const civilite = employee.sex === 'F' ? 'Madame' : 'Monsieur';
  const hireDateFormatted = employee.hire_date ? formatDate(employee.hire_date) : 'la rentrée scolaire';
  const birthFormatted = employee.date_of_birth ? formatDate(employee.date_of_birth) : '';
  const contractLabel = (employee.contract_type || 'CDI').toUpperCase();
  const positionLabel = employee.position || 'Membre du Personnel Enseignant';

  return printableShell(
    `Attestation de Travail - ${employee.last_name} ${employee.first_name}`,
    `
    <div class="page" style="padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div class="sheet" style="max-width: 210mm; margin: 0 auto; background: white; border: 2px solid #cbd5e1; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; min-height: 270mm;">
        
        <!-- Filigrane d'authenticité -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 70px; font-weight: 900; color: rgba(148, 163, 184, 0.08); pointer-events: none; text-transform: uppercase; white-space: nowrap; user-select: none;">
          ${escapeHtml(school.name)}
        </div>

        <!-- En-tête officiel -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #0f766e;">
          <div style="display: flex; align-items: center; gap: 16px; max-width: 60%;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0; padding: 4px;" />`
                : `<div style="width: 76px; height: 76px; border-radius: 12px; background: #0f766e; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${escapeHtml(school.name.substring(0, 2).toUpperCase())}</div>`
            }
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f766e; text-transform: uppercase; line-height: 1.2;">${escapeHtml(school.name)}</h2>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                ${escapeHtml(school.address || '')}${school.city ? `, ${escapeHtml(school.city)}` : ''}<br />
                ${school.phone ? `Tél : ${escapeHtml(school.phone)}` : ''} ${school.email ? `| Email : ${escapeHtml(school.email)}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 11px; color: #475569;">
            <p style="margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
            <p style="margin: 2px 0 0; font-style: italic; color: #64748b;">Union - Discipline - Travail</p>
            <p style="margin: 6px 0 0; font-weight: 700; color: #0f766e;">SERVICE DES RESSOURCES HUMAINES</p>
            <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">Réf. RH : <strong>${escapeHtml(ref)}</strong></p>
          </div>
        </div>

        <!-- Titre du document -->
        <div style="text-align: center; margin: 38px 0 32px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #0f766e; background: #f0fdfa; padding: 4px 14px; border-radius: 999px; border: 1px solid #99f6e4; margin-bottom: 8px;">DOCUMENT ADMINISTRATIF OFFICIEL</span>
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; text-transform: uppercase; border-bottom: 3px double #0f766e; display: inline-block; padding-bottom: 6px;">
            ATTESTATION DE TRAVAIL
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #64748b; font-style: italic;">
            Attestation d'emploi et d'exercice régulier des fonctions
          </p>
        </div>

        <!-- Corps de l'attestation -->
        <div style="font-size: 14.5px; line-height: 1.8; color: #1e293b; margin: 0 16px;">
          <p style="margin: 0 0 20px;">
            La Direction Générale du Groupe Scolaire soussignée, atteste sur l'honneur par la présente que :
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #0f766e; border-radius: 12px; padding: 22px 24px; margin: 24px 0;">
            <div style="display: grid; grid-template-columns: 180px 1fr; row-gap: 12px; font-size: 14px;">
              <span style="font-weight: 700; color: #475569;">Civilité & Identité :</span>
              <span style="font-weight: 900; font-size: 16px; color: #0f172a; text-transform: uppercase;">${escapeHtml(civilite)} ${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)}</span>

              ${
                employee.matricule
                  ? `
                <span style="font-weight: 700; color: #475569;">Numéro Matricule :</span>
                <span style="font-family: monospace; font-weight: 800; color: #0f766e; font-size: 15px;">${escapeHtml(employee.matricule)}</span>
              `
                  : ''
              }

              ${
                birthFormatted
                  ? `
                <span style="font-weight: 700; color: #475569;">Date de Naissance :</span>
                <span style="color: #1e293b;">${escapeHtml(birthFormatted)}${employee.place_of_birth ? ` à ${escapeHtml(employee.place_of_birth)}` : ''}</span>
              `
                  : ''
              }

              ${
                employee.cni_number
                  ? `
                <span style="font-weight: 700; color: #475569;">Pièce d'Identité (CNI/Passeport) :</span>
                <span style="font-family: monospace; font-weight: 700; color: #1e293b;">${escapeHtml(employee.cni_number)}</span>
              `
                  : ''
              }

              <span style="font-weight: 700; color: #475569;">Fonction / Poste occupé :</span>
              <span style="font-weight: 800; color: #0f172a;">${escapeHtml(positionLabel)}</span>

              <span style="font-weight: 700; color: #475569;">Département / Service :</span>
              <span style="color: #334155;">${escapeHtml(employee.department || 'Pédagogique & Administratif')}</span>

              <span style="font-weight: 700; color: #475569;">Type de Contrat :</span>
              <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 10px; border-radius: 6px; font-weight: 800; font-size: 12px; width: fit-content;">${escapeHtml(contractLabel)}</span>

              <span style="font-weight: 700; color: #475569;">Date de prise de service :</span>
              <span style="font-weight: 700; color: #0f766e;">Depuis le ${escapeHtml(hireDateFormatted)}</span>
            </div>
          </div>

          <p style="margin: 20px 0; text-align: justify;">
            Est actuellement employé(e) au sein de notre établissement et y exerce ses fonctions de manière continue, avec assiduité, compétence et professionnalisme.
          </p>

          <p style="margin: 20px 0; text-align: justify;">
            À ce jour, ${escapeHtml(civilite)} ${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)} fait partie des effectifs réguliers de l'établissement et n'est sous le coup d'aucune procédure de préavis ou de suspension.
          </p>

          ${
            purpose
              ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #166534;">
              <strong>Objet spécifique :</strong> ${escapeHtml(purpose)}
            </div>
          `
              : ''
          }

          <p style="margin: 24px 0 0; text-align: justify; font-style: italic; color: #475569;">
            La présente attestation lui est délivrée sur sa demande pour servir et valoir ce que de droit, notamment auprès des organismes bancaires, consulats, administrations publiques ou privées.
          </p>
        </div>

        <!-- Date & Signatures -->
        <div style="margin-top: 45px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="text-align: center; width: 220px;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">L'Intéressé(e)</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #94a3b8;">(Signature précédée de la mention manuscrite « Lu et approuvé »)</p>
            <div style="height: 60px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 11px; color: #64748b;">${escapeHtml(employee.first_name)} ${escapeHtml(employee.last_name)}</span>
            </div>
          </div>

          <!-- Tampon central -->
          <div style="text-align: center;">
            <div style="border: 2px dashed #0f766e; border-radius: 12px; padding: 10px 16px; color: #0f766e; font-size: 10px; font-weight: 800; text-transform: uppercase; background: #f0fdfa;">
              CACHET OFFICIEL DE L'ÉTABLISSEMENT
            </div>
            <p style="margin: 8px 0 0; font-size: 11px; color: #64748b;">
              Fait à <strong>${escapeHtml(currentCity)}</strong>, le <strong>${escapeHtml(currentDate)}</strong>
            </p>
          </div>

          <div style="text-align: center; width: 220px;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">La Direction Générale</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #94a3b8;">Signature autorisée & Sceau</p>
            <div style="height: 60px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: #0f172a;">${escapeHtml(directorName || 'Le Chef d’Établissement')}</span>
            </div>
          </div>
        </div>

        <!-- Pied de page officiel -->
        <div style="position: absolute; bottom: 18px; left: 40px; right: 40px; text-align: center; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          Toute falsification, surcharge ou altération du présent document expose son auteur aux sanctions pénales prévues par le Code Pénal. Réf : ${escapeHtml(ref)}
        </div>

      </div>
    </div>
    `,
  );
}

export interface WorkCertificateInput {
  school: School;
  employee: {
    first_name: string;
    last_name: string;
    matricule?: string;
    position?: string;
    department?: string;
    contract_type?: string;
    hire_date?: string;
    end_date?: string;
    date_of_birth?: string;
    place_of_birth?: string;
    phone?: string;
    cni_number?: string;
    sex?: string;
  };
  referenceNumber?: string;
  city?: string;
  date?: string;
  directorName?: string;
  reason?: string;
}

export function buildWorkCertificateHtml({
  school,
  employee,
  referenceNumber,
  city,
  date,
  directorName,
  reason,
}: WorkCertificateInput) {
  const ref = referenceNumber || `CT-FIN-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';
  const civilite = employee.sex === 'F' ? 'Madame' : 'Monsieur';
  const hireDateFormatted = employee.hire_date ? formatDate(employee.hire_date) : 'la date d’embauche';
  const endDateFormatted = employee.end_date ? formatDate(employee.end_date) : currentDate;
  const birthFormatted = employee.date_of_birth ? formatDate(employee.date_of_birth) : '';
  const positionLabel = employee.position || 'Enseignant / Membre du Personnel';

  return printableShell(
    `Certificat de Travail - ${employee.last_name} ${employee.first_name}`,
    `
    <div class="page" style="padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div class="sheet" style="max-width: 210mm; margin: 0 auto; background: white; border: 2px solid #cbd5e1; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; min-height: 270mm;">
        
        <!-- Filigrane d'authenticité -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 70px; font-weight: 900; color: rgba(148, 163, 184, 0.08); pointer-events: none; text-transform: uppercase; white-space: nowrap; user-select: none;">
          ${escapeHtml(school.name)}
        </div>

        <!-- En-tête officiel -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #b45309;">
          <div style="display: flex; align-items: center; gap: 16px; max-width: 60%;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0; padding: 4px;" />`
                : `<div style="width: 76px; height: 76px; border-radius: 12px; background: #b45309; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${escapeHtml(school.name.substring(0, 2).toUpperCase())}</div>`
            }
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #b45309; text-transform: uppercase; line-height: 1.2;">${escapeHtml(school.name)}</h2>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                ${escapeHtml(school.address || '')}${school.city ? `, ${escapeHtml(school.city)}` : ''}<br />
                ${school.phone ? `Tél : ${escapeHtml(school.phone)}` : ''} ${school.email ? `| Email : ${escapeHtml(school.email)}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 11px; color: #475569;">
            <p style="margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
            <p style="margin: 2px 0 0; font-style: italic; color: #64748b;">Union - Discipline - Travail</p>
            <p style="margin: 6px 0 0; font-weight: 700; color: #b45309;">DIRECTION DES RESSOURCES HUMAINES</p>
            <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">Certificat N° : <strong>${escapeHtml(ref)}</strong></p>
          </div>
        </div>

        <!-- Titre du document -->
        <div style="text-align: center; margin: 38px 0 32px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #b45309; background: #fffbeb; padding: 4px 14px; border-radius: 999px; border: 1px solid #fde68a; margin-bottom: 8px;">DOCUMENT LÉGAL OBLIGATOIRE • CODE DU TRAVAIL</span>
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; text-transform: uppercase; border-bottom: 3px double #b45309; display: inline-block; padding-bottom: 6px;">
            CERTIFICAT DE TRAVAIL
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #64748b; font-style: italic;">
            Délivré à l'expiration du contrat de travail conformément aux dispositions légales en vigueur
          </p>
        </div>

        <!-- Corps du certificat -->
        <div style="font-size: 14.5px; line-height: 1.8; color: #1e293b; margin: 0 16px;">
          <p style="margin: 0 0 20px;">
            La Direction du Groupe Scolaire soussignée, certifie par la présente que :
          </p>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 5px solid #b45309; border-radius: 12px; padding: 22px 24px; margin: 24px 0;">
            <div style="display: grid; grid-template-columns: 180px 1fr; row-gap: 12px; font-size: 14px;">
              <span style="font-weight: 700; color: #475569;">Civilité & Identité :</span>
              <span style="font-weight: 900; font-size: 16px; color: #0f172a; text-transform: uppercase;">${escapeHtml(civilite)} ${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)}</span>

              ${
                employee.matricule
                  ? `
                <span style="font-weight: 700; color: #475569;">Numéro Matricule :</span>
                <span style="font-family: monospace; font-weight: 800; color: #b45309; font-size: 15px;">${escapeHtml(employee.matricule)}</span>
              `
                  : ''
              }

              ${
                birthFormatted
                  ? `
                <span style="font-weight: 700; color: #475569;">Date de Naissance :</span>
                <span style="color: #1e293b;">${escapeHtml(birthFormatted)}${employee.place_of_birth ? ` à ${escapeHtml(employee.place_of_birth)}` : ''}</span>
              `
                  : ''
              }

              ${
                employee.cni_number
                  ? `
                <span style="font-weight: 700; color: #475569;">Pièce d'Identité :</span>
                <span style="font-family: monospace; font-weight: 700; color: #1e293b;">${escapeHtml(employee.cni_number)}</span>
              `
                  : ''
              }

              <span style="font-weight: 700; color: #475569;">Période d'Emploi :</span>
              <span style="font-weight: 800; color: #0f172a;">
                Du <strong>${escapeHtml(hireDateFormatted)}</strong> au <strong>${escapeHtml(endDateFormatted)}</strong>
              </span>

              <span style="font-weight: 700; color: #475569;">Dernière Fonction :</span>
              <span style="font-weight: 800; color: #b45309;">${escapeHtml(positionLabel)}</span>

              <span style="font-weight: 700; color: #475569;">Département / Cycle :</span>
              <span style="color: #334155;">${escapeHtml(employee.department || 'Enseignement & Administration')}</span>

              <span style="font-weight: 700; color: #475569;">Type de Contrat :</span>
              <span style="color: #334155;">${escapeHtml((employee.contract_type || 'CDI').toUpperCase())}</span>
            </div>
          </div>

          <p style="margin: 20px 0; text-align: justify;">
            A été employé(e) dans notre établissement durant la période mentionnée ci-dessus et y a exercé ses fonctions de manière consciencieuse et dévouée.
          </p>

          <!-- Formule légale obligatoire -->
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px 20px; margin: 22px 0;">
            <p style="margin: 0; font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 13px;">
              Mention légale de libération :
            </p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #334155; line-height: 1.6;">
              ${escapeHtml(civilite)} <strong>${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)}</strong> quitte notre établissement ce jour, <strong>libre de tout engagement envers nous</strong>, l'ensemble de ses salaires, indemnités légales de fin de contrat et congés payés lui ayant été intégralement réglés.
            </p>
          </div>

          ${
            reason
              ? `
            <p style="margin: 16px 0; font-size: 13.5px; color: #475569;">
              <strong>Motif du départ :</strong> ${escapeHtml(reason)}
            </p>
          `
              : ''
          }

          <p style="margin: 24px 0 0; text-align: justify; font-style: italic; color: #475569;">
            En foi de quoi, le présent certificat de travail lui est délivré en application des dispositions du Code du Travail pour servir et valoir ce que de droit.
          </p>
        </div>

        <!-- Date & Signatures -->
        <div style="margin-top: 45px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="text-align: center; width: 220px;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Pour Acquit & Réception</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #94a3b8;">Signature de l'ex-salarié(e)</p>
            <div style="height: 60px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 11px; color: #64748b;">${escapeHtml(employee.first_name)} ${escapeHtml(employee.last_name)}</span>
            </div>
          </div>

          <!-- Tampon central -->
          <div style="text-align: center;">
            <div style="border: 2px dashed #b45309; border-radius: 12px; padding: 10px 16px; color: #b45309; font-size: 10px; font-weight: 800; text-transform: uppercase; background: #fffbeb;">
              SCEAU & CACHET OFFICIEL
            </div>
            <p style="margin: 8px 0 0; font-size: 11px; color: #64748b;">
              Fait à <strong>${escapeHtml(currentCity)}</strong>, le <strong>${escapeHtml(currentDate)}</strong>
            </p>
          </div>

          <div style="text-align: center; width: 220px;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">La Direction Générale</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #94a3b8;">Signature autorisée</p>
            <div style="height: 60px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: #0f172a;">${escapeHtml(directorName || 'Le Chef d’Établissement')}</span>
            </div>
          </div>
        </div>

        <!-- Pied de page officiel -->
        <div style="position: absolute; bottom: 18px; left: 40px; right: 40px; text-align: center; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
          Certificat délivré conformément aux lois et règlements régissant les contrats de travail. Réf : ${escapeHtml(ref)}
        </div>

      </div>
    </div>
    `,
  );
}

export interface MissionOrderInput {
  school: School;
  employee: {
    first_name: string;
    last_name: string;
    matricule?: string;
    position?: string;
    department?: string;
    phone?: string;
    sex?: string;
  };
  referenceNumber?: string;
  city?: string;
  date?: string;
  directorName?: string;
  missionDestination: string;
  missionPurpose: string;
  startDate: string;
  endDate: string;
  transportMode?: string;
  expenseCoverage?: string;
}

export function buildMissionOrderHtml({
  school,
  employee,
  referenceNumber,
  city,
  date,
  directorName,
  missionDestination,
  missionPurpose,
  startDate,
  endDate,
  transportMode,
  expenseCoverage,
}: MissionOrderInput) {
  const ref = referenceNumber || `OM-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';
  const civilite = employee.sex === 'F' ? 'Madame' : 'Monsieur';
  const startFormatted = startDate ? formatDate(startDate) : currentDate;
  const endFormatted = endDate ? formatDate(endDate) : currentDate;

  return printableShell(
    `Ordre de Mission - ${employee.last_name} ${employee.first_name}`,
    `
    <div class="page" style="padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div class="sheet" style="max-width: 210mm; margin: 0 auto; background: white; border: 2px solid #cbd5e1; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; min-height: 270mm;">
        
        <!-- En-tête officiel -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #1e40af;">
          <div style="display: flex; align-items: center; gap: 16px; max-width: 60%;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0; padding: 4px;" />`
                : `<div style="width: 76px; height: 76px; border-radius: 12px; background: #1e40af; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${escapeHtml(school.name.substring(0, 2).toUpperCase())}</div>`
            }
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #1e40af; text-transform: uppercase; line-height: 1.2;">${escapeHtml(school.name)}</h2>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                ${escapeHtml(school.address || '')}${school.city ? `, ${escapeHtml(school.city)}` : ''}<br />
                ${school.phone ? `Tél : ${escapeHtml(school.phone)}` : ''} ${school.email ? `| Email : ${escapeHtml(school.email)}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 11px; color: #475569;">
            <p style="margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
            <p style="margin: 2px 0 0; font-style: italic; color: #64748b;">Union - Discipline - Travail</p>
            <p style="margin: 6px 0 0; font-weight: 700; color: #1e40af;">DIRECTION GÉNÉRALE</p>
            <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">Ordre N° : <strong>${escapeHtml(ref)}</strong></p>
          </div>
        </div>

        <!-- Titre -->
        <div style="text-align: center; margin: 38px 0 32px;">
          <span style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #1e40af; background: #eff6ff; padding: 4px 14px; border-radius: 999px; border: 1px solid #bfdbfe; margin-bottom: 8px;">MISSION OFFICIELLE</span>
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; text-transform: uppercase; border-bottom: 3px double #1e40af; display: inline-block; padding-bottom: 6px;">
            ORDRE DE MISSION
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: #64748b; font-style: italic;">
            Autorisation de déplacement et d'exécution de mission officielle
          </p>
        </div>

        <div style="font-size: 14.5px; line-height: 1.8; color: #1e293b; margin: 0 16px;">
          <p style="margin: 0 0 16px;">
            Il est ordonné par la présente à :
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #1e40af; border-radius: 12px; padding: 20px 24px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: 180px 1fr; row-gap: 10px; font-size: 14px;">
              <span style="font-weight: 700; color: #475569;">Bénéficiaire :</span>
              <span style="font-weight: 900; font-size: 15px; color: #0f172a; text-transform: uppercase;">${escapeHtml(civilite)} ${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)}</span>

              <span style="font-weight: 700; color: #475569;">Fonction :</span>
              <span style="font-weight: 800; color: #1e40af;">${escapeHtml(employee.position || 'Personnel de l’Établissement')}</span>

              <span style="font-weight: 700; color: #475569;">Matricule :</span>
              <span style="font-family: monospace; font-weight: 700;">${escapeHtml(employee.matricule || '-')}</span>
            </div>
          </div>

          <p style="margin: 16px 0;">
            De se rendre en mission officielle selon les termes et dispositions suivants :
          </p>

          <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 22px 24px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: 180px 1fr; row-gap: 12px; font-size: 14px;">
              <span style="font-weight: 700; color: #1e40af;">Lieu / Destination :</span>
              <span style="font-weight: 800; font-size: 15px; color: #0f172a;">${escapeHtml(missionDestination || 'Non spécifié')}</span>

              <span style="font-weight: 700; color: #1e40af;">Objet de la mission :</span>
              <span style="color: #1e293b; font-weight: 600;">${escapeHtml(missionPurpose || 'Mission pédagogique et administrative')}</span>

              <span style="font-weight: 700; color: #1e40af;">Période de mission :</span>
              <span style="font-weight: 800; color: #0f172a;">Du <strong>${escapeHtml(startFormatted)}</strong> au <strong>${escapeHtml(endFormatted)}</strong></span>

              <span style="font-weight: 700; color: #1e40af;">Moyen de transport :</span>
              <span style="color: #334155;">${escapeHtml(transportMode || 'Transport en commun / Véhicule')}</span>

              <span style="font-weight: 700; color: #1e40af;">Prise en charge :</span>
              <span style="color: #334155;">${escapeHtml(expenseCoverage || 'Frais pris en charge par l’établissement')}</span>
            </div>
          </div>

          <p style="margin: 20px 0; text-align: justify; font-size: 13.5px; color: #475569;">
            Les autorités civiles, militaires et de police, ainsi que les responsables des centres ou institutions d'accueil, sont priées de faciliter l'accomplissement de sa mission et de lui prêter aide et assistance en cas de besoin.
          </p>
        </div>

        <!-- Visas et Signatures -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="text-align: center; width: 200px;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Visa au Départ</p>
            <div style="height: 55px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 10px; color: #94a3b8;">Date & Cachet départ</span>
            </div>
          </div>

          <div style="text-align: center; width: 200px;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Visa à l'Arrivée (Lieu de mission)</p>
            <div style="height: 55px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 10px; color: #94a3b8;">Date & Cachet autorité d'accueil</span>
            </div>
          </div>

          <div style="text-align: center; width: 200px;">
            <p style="margin: 0; font-size: 11px; font-weight: 800; color: #1e40af; text-transform: uppercase;">L'Autorité Signataire</p>
            <p style="margin: 2px 0 0; font-size: 9.5px; color: #64748b;">Le Chef d'Établissement</p>
            <div style="height: 50px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: #0f172a;">${escapeHtml(directorName || 'La Direction')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    `,
  );
}

export interface RecommendationLetterInput {
  school: School;
  employee: {
    first_name: string;
    last_name: string;
    matricule?: string;
    position?: string;
    department?: string;
    hire_date?: string;
    end_date?: string;
    sex?: string;
  };
  referenceNumber?: string;
  city?: string;
  date?: string;
  directorName?: string;
  recipient?: string;
  qualities?: string;
}

export function buildRecommendationLetterHtml({
  school,
  employee,
  referenceNumber,
  city,
  date,
  directorName,
  recipient,
  qualities,
}: RecommendationLetterInput) {
  const ref = referenceNumber || `REC-${Math.floor(100000 + Math.random() * 900000)}/${new Date().getFullYear()}`;
  const currentDate = date || formatDate(new Date().toISOString());
  const currentCity = city || school.city || 'Abidjan';
  const civilite = employee.sex === 'F' ? 'Madame' : 'Monsieur';
  const hireDateFormatted = employee.hire_date ? formatDate(employee.hire_date) : 'son intégration';
  const positionLabel = employee.position || 'Enseignant(e)';
  const defaultQualities = qualities || `de remarquables compétences professionnelles et pédagogiques, une ponctualité exemplaire, une éthique de travail irréprochable et un dévouement constant auprès des apprenants et de la communauté éducative.`;

  return printableShell(
    `Lettre de Recommandation - ${employee.last_name} ${employee.first_name}`,
    `
    <div class="page" style="padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div class="sheet" style="max-width: 210mm; margin: 0 auto; background: white; border: 2px solid #cbd5e1; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); position: relative; min-height: 270mm;">
        
        <!-- En-tête officiel -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #6b21a8;">
          <div style="display: flex; align-items: center; gap: 16px; max-width: 60%;">
            ${
              school.logo_url
                ? `<img src="${escapeHtml(school.logo_url)}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; border: 1px solid #e2e8f0; padding: 4px;" />`
                : `<div style="width: 76px; height: 76px; border-radius: 12px; background: #6b21a8; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${escapeHtml(school.name.substring(0, 2).toUpperCase())}</div>`
            }
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #6b21a8; text-transform: uppercase; line-height: 1.2;">${escapeHtml(school.name)}</h2>
              <p style="margin: 4px 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
                ${escapeHtml(school.address || '')}${school.city ? `, ${escapeHtml(school.city)}` : ''}<br />
                ${school.phone ? `Tél : ${escapeHtml(school.phone)}` : ''} ${school.email ? `| Email : ${escapeHtml(school.email)}` : ''}
              </p>
            </div>
          </div>

          <div style="text-align: right; font-size: 11px; color: #475569;">
            <p style="margin: 0; font-weight: 800; text-transform: uppercase; color: #1e293b;">RÉPUBLIQUE DE CÔTE D'IVOIRE</p>
            <p style="margin: 2px 0 0; font-style: italic; color: #64748b;">Union - Discipline - Travail</p>
            <p style="margin: 6px 0 0; font-weight: 700; color: #6b21a8;">DIRECTION GÉNÉRALE</p>
            <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">Réf : <strong>${escapeHtml(ref)}</strong></p>
          </div>
        </div>

        <!-- Destinataire -->
        <div style="margin: 30px 0 20px; text-align: right;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">Fait à ${escapeHtml(currentCity)}, le ${escapeHtml(currentDate)}</p>
          <div style="display: inline-block; margin-top: 10px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px 18px; text-align: left;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; color: #6b21a8; text-transform: uppercase;">Destinataire :</p>
            <p style="margin: 2px 0 0; font-size: 13px; font-weight: 800; color: #0f172a;">${escapeHtml(recipient || 'À qui de droit / Direction des Recrutements')}</p>
          </div>
        </div>

        <!-- Titre -->
        <div style="text-align: center; margin: 15px 0 25px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.05em; color: #0f172a; text-transform: uppercase; border-bottom: 3px double #6b21a8; display: inline-block; padding-bottom: 6px;">
            LETTRE DE RECOMMANDATION
          </h1>
        </div>

        <!-- Corps -->
        <div style="font-size: 14.5px; line-height: 1.8; color: #1e293b; margin: 0 16px; text-align: justify;">
          <p style="margin: 0 0 18px;">
            C'est avec grand honneur et un réel plaisir que je rédige cette lettre de recommandation en faveur de ${escapeHtml(civilite)} <strong>${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)}</strong>, qui a exercé au sein de notre établissement scolaire en qualité de <strong>${escapeHtml(positionLabel)}</strong> depuis le <strong>${escapeHtml(hireDateFormatted)}</strong>.
          </p>

          <p style="margin: 0 0 18px;">
            Durant toute la période passée parmi nous, ${escapeHtml(civilite)} <strong>${escapeHtml(employee.last_name)}</strong> a fait preuve ${escapeHtml(defaultQualities)}
          </p>

          <p style="margin: 0 0 18px;">
            Son sens aigu des responsabilités, sa capacité d'adaptation et son sens de la communication ont été particulièrement appréciés tant par ses pairs et la direction que par les élèves et leurs parents. Son apport à la réussite pédagogique et au climat scolaire au sein de notre groupe scolaire a été hautement bénéfique.
          </p>

          <p style="margin: 0 0 24px;">
            Je recommande ${escapeHtml(civilite)} <strong>${escapeHtml(employee.last_name)} ${escapeHtml(employee.first_name)}</strong> de la manière la plus chaleureuse et sans la moindre réserve pour toute opportunité professionnelle ou académique future. Je suis convaincu(e) qu'il/elle saura être un atout précieux pour toute institution qui lui accordera sa confiance.
          </p>

          <p style="margin: 0; font-style: italic; color: #475569;">
            Je reste à votre entière disposition pour tout renseignement complémentaire que vous jugeriez utile.
          </p>
        </div>

        <!-- Signature -->
        <div style="margin-top: 50px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
          <div style="text-align: center; width: 260px;">
            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Le Chef d'Établissement</p>
            <p style="margin: 2px 0 0; font-size: 10px; color: #94a3b8;">Signature & Sceau de l'École</p>
            <div style="height: 65px;"></div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              <span style="font-size: 12px; font-weight: 800; color: #0f172a;">${escapeHtml(directorName || 'La Direction Générale')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    `,
  );
}



