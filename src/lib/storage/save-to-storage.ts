import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { uploadViaSftp, decryptPassword } from './sftp'
import { uploadToGDrive, getValidGDriveToken } from './gdrive'
import { sendNotification } from '@/lib/notifications/send-email'

const STORAGE_BUCKET = 'bill-pdfs'

// ---------------------------------------------------------------------------
// Filename builder
// ---------------------------------------------------------------------------

function buildFilename(
  docType: 'bill' | 'po',
  date: string | null,
  vendorName: string | null,
  reference: string | null,
): string {
  const sanitize = (s: string | null): string =>
    (s ?? 'unknown')
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')

  const prefix   = docType === 'po' ? 'PO' : null
  const datePart = date ?? 'undated'
  const parts    = [prefix, datePart, sanitize(vendorName), sanitize(reference)].filter(Boolean)
  return parts.join('_') + '.pdf'
}

// ---------------------------------------------------------------------------
// Entry point — called after processBill / processPO completes
// Never throws; failures are logged and notified.
// ---------------------------------------------------------------------------

export async function saveToStorage(
  docId: string,
  docType: 'bill' | 'po',
  companyId: string,
): Promise<void> {
  const supabase = createServiceClient()

  // Load company storage settings
  const { data: company } = await supabase
    .from('companies')
    .select(`
      sftp_enabled, sftp_host, sftp_port, sftp_username, sftp_password_enc,
      sftp_bills_folder, sftp_pos_folder,
      gdrive_enabled, gdrive_access_token, gdrive_refresh_token, gdrive_token_expires_at,
      gdrive_bills_folder_id, gdrive_pos_folder_id
    `)
    .eq('company_id', companyId)
    .single()

  if (!company) return

  const sftpEnabled  = company.sftp_enabled  && !!company.sftp_host && !!company.sftp_password_enc
  const gdriveEnabled = company.gdrive_enabled && !!company.gdrive_access_token

  if (!sftpEnabled && !gdriveEnabled) return  // nothing configured — fast exit

  // Load document metadata to build filename
  let date: string | null = null
  let vendorName: string | null = null
  let reference: string | null = null
  let pdfUrl: string | null = null

  if (docType === 'bill') {
    const { data: bill } = await supabase
      .from('bills')
      .select('pdf_url, invoice_date, vendor_name_raw, invoice_number')
      .eq('bill_id', docId)
      .single()
    if (!bill) return
    date       = bill.invoice_date
    vendorName = bill.vendor_name_raw
    reference  = bill.invoice_number
    pdfUrl     = bill.pdf_url
  } else {
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('pdf_url, order_date, vendor_name_raw, po_number')
      .eq('po_id', docId)
      .single()
    if (!po) return
    date       = po.order_date
    vendorName = po.vendor_name_raw
    reference  = po.po_number
    pdfUrl     = po.pdf_url
  }

  if (!pdfUrl) return

  // Download PDF buffer
  const { data: fileData } = await supabase.storage.from(STORAGE_BUCKET).download(pdfUrl)
  if (!fileData) return
  const buffer = Buffer.from(await fileData.arrayBuffer())

  const filename = buildFilename(docType, date, vendorName, reference)

  // ── SFTP upload ─────────────────────────────────────────────────────────
  if (sftpEnabled) {
    const folder = docType === 'bill'
      ? (company.sftp_bills_folder ?? '/')
      : (company.sftp_pos_folder   ?? '/')
    const remotePath = folder.replace(/\/$/, '') + '/' + filename

    try {
      await uploadViaSftp({
        host:       company.sftp_host!,
        port:       company.sftp_port ?? 22,
        username:   company.sftp_username!,
        password:   decryptPassword(company.sftp_password_enc!),
        remotePath,
        buffer,
      })
      console.log(`[storage] SFTP saved: ${remotePath}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[storage] SFTP upload failed (${docId}):`, msg)
      await sendNotification({
        companyId,
        event:   'pdf_unreadable',
        subject: 'File storage upload failed (SFTP)',
        body:    `${filename} could not be saved to your SFTP server: ${msg}. Check your SFTP settings in Purchasomatic.`,
        ...(docType === 'bill' ? { billId: docId } : {}),
      })
    }
  }

  // ── Google Drive upload ──────────────────────────────────────────────────
  if (gdriveEnabled) {
    const folderId = docType === 'bill'
      ? company.gdrive_bills_folder_id
      : company.gdrive_pos_folder_id

    if (!folderId) return  // folder not configured for this doc type

    try {
      const accessToken = await getValidGDriveToken(company, companyId)
      await uploadToGDrive({ accessToken, folderId, filename, buffer })
      console.log(`[storage] Google Drive saved: ${filename} → folder ${folderId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[storage] Google Drive upload failed (${docId}):`, msg)
      await sendNotification({
        companyId,
        event:   'pdf_unreadable',
        subject: 'File storage upload failed (Google Drive)',
        body:    `${filename} could not be saved to your Google Drive folder: ${msg}. Check your Google Drive settings in Purchasomatic.`,
        ...(docType === 'bill' ? { billId: docId } : {}),
      })
    }
  }
}
