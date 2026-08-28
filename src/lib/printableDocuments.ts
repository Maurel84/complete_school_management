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
              ? `
              <div style="margin-top:22px; padding:20px; border:1px solid #dce5ef; border-radius:22px; background:#f8fafc; font-family:sans-serif;">
                <h3 style="margin:0 0 12px; font-size:14px; font-weight:800; color:#0f3f57; text-transform:uppercase; letter-spacing:0.05em;">État financier de l'élève</h3>
                <div style="display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px; text-align:center;">
                  <div style="padding:10px; background:white; border:1px solid #e2e8f0; border-radius:12px;">
                    <p style="margin:0 0 4px; font-size:10px; color:#64748b; text-transform:uppercase;">Total Scolarité</p>
                    <p style="margin:0; font-size:15px; font-weight:700; color:#1e293b;">${escapeHtml(formatCurrency(totalExpected || 0))}</p>
                  </div>
                  <div style="padding:10px; background:white; border:1px solid #e2e8f0; border-radius:12px;">
                    <p style="margin:0 0 4px; font-size:10px; color:#64748b; text-transform:uppercase;">Déjà Encaissé</p>
                    <p style="margin:0; font-size:15px; font-weight:700; color:#047857;">${escapeHtml(formatCurrency(totalPaid || 0))}</p>
                  </div>
                  <div style="padding:10px; background:white; border:1px solid #e2e8f0; border-radius:12px;">
                    <p style="margin:0 0 4px; font-size:10px; color:#64748b; text-transform:uppercase;">Reste à Payer</p>
                    <p style="margin:0; font-size:15px; font-weight:700; color:#b91c1c;">${escapeHtml(formatCurrency(remaining || 0))}</p>
                  </div>
                </div>
                
                ${
                  installments && installments.length > 0
                    ? `
                    <div style="margin-top:16px;">
                      <p style="margin:0 0 6px; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Échéancier des tranches</p>
                      <table style="width:100%; border-collapse:collapse; font-size:11px; background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                        <thead>
                          <tr style="background:#f1f5f9; text-align:left; color:#475569;">
                            <th style="padding:6px 10px; border-bottom:1px solid #e2e8f0;">Tranche</th>
                            <th style="padding:6px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">Date d'échéance</th>
                            <th style="padding:6px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${installments
                            .map(
                              inst => `
                            <tr style="color:#334155;">
                              <td style="padding:6px 10px; border-bottom:1px solid #f1f5f9;">${escapeHtml(inst.label)}</td>
                              <td style="padding:6px 10px; border-bottom:1px solid #f1f5f9; text-align:center;">${escapeHtml(formatDate(inst.due_date))}</td>
                              <td style="padding:6px 10px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:600;">${escapeHtml(formatCurrency(inst.amount))}</td>
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
              `
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
  academicYearName,
  className,
  primaryGuardian,
}: StudentCardTemplateInput) {
  return printableShell(
    `Carte scolaire ${student.matricule}`,
    `
    <div class="page" style="display:flex; align-items:center; justify-content:center;">
      <section class="sheet" style="max-width: 320mm; padding: 34px;">
        <div style="display:grid; gap:24px; justify-content:center;">
          <div style="width: 86mm; height: 54mm; border-radius: 24px; overflow: hidden; position: relative; box-shadow: 0 28px 70px rgba(15,23,42,0.22); background: linear-gradient(135deg, #1d4ed8 0%, #ec4899 65%, #f59e0b 100%); color: white;">
            <div style="position:absolute; inset:0; background:
              radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 30%),
              radial-gradient(circle at bottom left, rgba(251,191,36,0.3), transparent 28%);
            "></div>
            <div style="position:relative; z-index:1; height:100%; padding:14px; display:grid; grid-template-columns: 1fr 74px; gap:12px;">
              <div style="display:flex; flex-direction:column; justify-content:space-between; min-width:0;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${
                      school.logo_url
                        ? `<div style="width:30px; height:30px; border-radius:50%; background:white; display:flex; align-items:center; justify-content:center; padding:2px; box-shadow:0 2px 4px rgba(0,0,0,0.15); flex-shrink:0;">
                            <img src="${escapeHtml(school.logo_url)}" alt="${escapeHtml(school.name)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />
                          </div>`
                        : `<div style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0;">★</div>`
                    }
                    <div style="min-width:0;">
                      <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:6px; letter-spacing:0.14em; text-transform:uppercase; opacity:0.85; font-weight:800;">Carte scolaire</span>
                        <span style="font-size:6px; color:#fef08a;">★★★★★</span>
                      </div>
                      <p style="margin:1px 0 0; font-size:10px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#ffffff;">${escapeHtml(school.name)}</p>
                    </div>
                  </div>
                  <p style="margin:12px 0 0; font-size:15px; line-height:1.05; font-weight:900; letter-spacing:-0.01em;">${escapeHtml(student.first_name)}<br />${escapeHtml(student.last_name)}</p>
                </div>
                <div>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <span style="padding:4px 8px; border-radius:999px; background:rgba(255,255,255,0.22); font-size:7px; font-weight:800; border:1px solid rgba(255,255,255,0.15); text-transform:uppercase; letter-spacing:0.04em;">${escapeHtml(className || 'Classe en cours')}</span>
                    <span style="padding:4px 8px; border-radius:999px; background:rgba(255,255,255,0.22); font-size:7px; font-weight:800; border:1px solid rgba(255,255,255,0.15);">${escapeHtml(academicYearName || 'Annee scolaire')}</span>
                  </div>
                  <p style="margin:8px 0 0; font-size:9px; opacity:0.9; letter-spacing:0.02em;">Matricule: <strong style="color:#fef08a;">${escapeHtml(student.matricule)}</strong></p>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end;">
                ${
                  student.photo_url
                    ? `<img src="${escapeHtml(student.photo_url)}" alt="${escapeHtml(`${student.first_name} ${student.last_name}`)}" style="width:66px; height:72px; border-radius:18px; object-fit:cover; border:2px solid #ffffff; box-shadow:0 4px 10px rgba(0,0,0,0.2);" />`
                    : `<div class="placeholder-photo" style="width:66px; height:72px; border-radius:18px; background:rgba(255,255,255,0.2); border:2px solid rgba(255,255,255,0.15); font-size:8px; display:flex; align-items:center; justify-content:center;">PHOTO</div>`
                }
                <div style="text-align:right;">
                  <p style="margin:0; font-size:6px; opacity:0.8; text-transform:uppercase; letter-spacing:0.05em;">Responsable</p>
                  <p style="margin:2px 0 0; font-size:8px; line-height:1.2; font-weight:800; max-width:72px; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(primaryGuardian || school.phone || 'Administration')}</p>
                </div>
              </div>
            </div>
          </div>

          <div style="width: 170mm; max-width:100%; border-radius: 26px; border: 1px solid #d8e3ef; background: linear-gradient(135deg, #fbfdff 0%, #f5faf7 100%); padding: 24px;">
            <div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:14px;">
              <div style="padding:14px; border-radius:18px; background:white; border:1px solid #e2e8f0;">
                <p class="muted" style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.12em;">Nom complet</p>
                <p style="margin:0; font-size:16px; font-weight:800;">${escapeHtml(`${student.first_name} ${student.last_name}`)}</p>
              </div>
              <div style="padding:14px; border-radius:18px; background:white; border:1px solid #e2e8f0;">
                <p class="muted" style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.12em;">Classe</p>
                <p style="margin:0; font-size:16px; font-weight:800;">${escapeHtml(className || '-')}</p>
              </div>
              <div style="padding:14px; border-radius:18px; background:white; border:1px solid #e2e8f0;">
                <p class="muted" style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.12em;">Matricule</p>
                <p style="margin:0; font-size:16px; font-weight:800;">${escapeHtml(student.matricule)}</p>
              </div>
              <div style="padding:14px; border-radius:18px; background:white; border:1px solid #e2e8f0;">
                <p class="muted" style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:0.12em;">Responsable</p>
                <p style="margin:0; font-size:16px; font-weight:800;">${escapeHtml(primaryGuardian || 'Administration')}</p>
              </div>
            </div>
            <p style="margin:18px 0 0; font-size:13px; color:#516071; line-height:1.7;">
              Cette carte scolaire est un support officiel de ${escapeHtml(school.name)}. Elle peut etre imprimee, archivee
              dans le dossier eleve et reproduite en serie pour l'ensemble des classes.
            </p>
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

  const cr = Number(details.cr) || 0;
  const its = Number(details.its) || 0;
  const solidarite = Number(details.solidarite) || 0;
  const pharmacie = Number(details.pharmacie) || 0;

  const totalGains = baseSalary + sursalaire + transport + anciennete + autresPrimes + gratification + congesPayes;
  const totalRetenues = cr + its + solidarite + pharmacie;
  const netPay = totalGains - totalRetenues;
  const baseImposable = baseSalary + sursalaire + anciennete + autresPrimes;

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
