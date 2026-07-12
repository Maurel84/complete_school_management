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
          <div style="width: 86mm; height: 54mm; border-radius: 24px; overflow: hidden; position: relative; box-shadow: 0 28px 70px rgba(15,23,42,0.22); background: linear-gradient(135deg, #0f172a 0%, #0f766e 52%, #14b8a6 100%); color: white;">
            <div style="position:absolute; inset:0; background:
              radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 24%),
              radial-gradient(circle at bottom left, rgba(251,191,36,0.24), transparent 22%);
            "></div>
            <div style="position:relative; z-index:1; height:100%; padding:14px; display:grid; grid-template-columns: 1fr 74px; gap:12px;">
              <div style="display:flex; flex-direction:column; justify-content:space-between; min-width:0;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${
                      school.logo_url
                        ? `<img src="${escapeHtml(school.logo_url)}" alt="${escapeHtml(school.name)}" style="width:28px; height:28px; border-radius:10px; object-fit:cover; border:1px solid rgba(255,255,255,0.3);" />`
                        : `<div style="width:28px; height:28px; border-radius:10px; background:rgba(255,255,255,0.16);"></div>`
                    }
                    <div style="min-width:0;">
                      <p style="margin:0; font-size:7px; letter-spacing:0.14em; text-transform:uppercase; opacity:0.78;">Carte scolaire</p>
                      <p style="margin:2px 0 0; font-size:11px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(school.name)}</p>
                    </div>
                  </div>
                  <p style="margin:14px 0 0; font-size:15px; line-height:1.05; font-weight:900;">${escapeHtml(student.first_name)}<br />${escapeHtml(student.last_name)}</p>
                </div>
                <div>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <span style="padding:4px 8px; border-radius:999px; background:rgba(255,255,255,0.16); font-size:7px; font-weight:700;">${escapeHtml(className || 'Classe en cours')}</span>
                    <span style="padding:4px 8px; border-radius:999px; background:rgba(255,255,255,0.16); font-size:7px; font-weight:700;">${escapeHtml(academicYearName || 'Annee scolaire')}</span>
                  </div>
                  <p style="margin:8px 0 0; font-size:9px; opacity:0.86;">Matricule: <strong>${escapeHtml(student.matricule)}</strong></p>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end;">
                ${
                  student.photo_url
                    ? `<img src="${escapeHtml(student.photo_url)}" alt="${escapeHtml(`${student.first_name} ${student.last_name}`)}" style="width:66px; height:72px; border-radius:18px; object-fit:cover; border:2px solid rgba(255,255,255,0.25);" />`
                    : `<div class="placeholder-photo" style="width:66px; height:72px; border-radius:18px; background:rgba(255,255,255,0.16); border:2px solid rgba(255,255,255,0.12); font-size:8px;">PHOTO</div>`
                }
                <div style="text-align:right;">
                  <p style="margin:0; font-size:7px; opacity:0.72;">Responsable</p>
                  <p style="margin:3px 0 0; font-size:8px; line-height:1.25; font-weight:700; max-width:72px;">${escapeHtml(primaryGuardian || school.phone || 'Administration')}</p>
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
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
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
