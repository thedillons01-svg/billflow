// QBD Web Connector (QBWC) support

export type QBDSession = {
  companyId: string
  sessionTicket: string
}

// In-memory session store (fine for single-server; for multi-server use Redis/DB)
const activeSessions = new Map<string, QBDSession>()

export function createSession(companyId: string): string {
  const ticket = `bfwc-${companyId.slice(0, 8)}-${Date.now()}`
  activeSessions.set(ticket, { companyId, sessionTicket: ticket })
  return ticket
}

export function getSession(ticket: string): QBDSession | null {
  return activeSessions.get(ticket) ?? null
}

export function closeSession(ticket: string) {
  activeSessions.delete(ticket)
}

// Generate QBXML for a bill add request
export function buildBillAddXML(bill: {
  requestId: string
  qbVendorListId: string
  invoiceDate: string | null
  invoiceNumber: string | null
  refNumber: string | null
  lineItems: Array<{
    qbAccountListId: string
    amount: number
    description: string | null
    qbJobListId: string | null
    qbClassListId: string | null
  }>
}): string {
  const txnDate = bill.invoiceDate ? `<TxnDate>${bill.invoiceDate}</TxnDate>` : ''
  const refNum = bill.refNumber ? `<RefNumber>${escapeXml(bill.refNumber)}</RefNumber>` : ''

  const lines = bill.lineItems
    .filter(li => li.amount > 0)
    .map(li => {
      const memo = li.description ? `<Memo>${escapeXml(li.description)}</Memo>` : ''
      const customer = li.qbJobListId ? `<CustomerRef><ListID>${escapeXml(li.qbJobListId)}</ListID></CustomerRef>` : ''
      const cls = li.qbClassListId ? `<ClassRef><ListID>${escapeXml(li.qbClassListId)}</ListID></ClassRef>` : ''
      return `
      <ExpenseLineAdd>
        <AccountRef><ListID>${escapeXml(li.qbAccountListId)}</ListID></AccountRef>
        <Amount>${li.amount.toFixed(2)}</Amount>
        ${memo}${customer}${cls}
      </ExpenseLineAdd>`
    })
    .join('')

  return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <BillAddRq requestID="${escapeXml(bill.requestId)}">
      <BillAdd>
        <VendorRef><ListID>${escapeXml(bill.qbVendorListId)}</ListID></VendorRef>
        ${txnDate}
        ${refNum}
        ${lines}
      </BillAdd>
    </BillAddRq>
  </QBXMLMsgsRq>
</QBXML>`
}

// Parse the QBXML response from QB Desktop for a BillAdd
export function parseBillAddResponse(xml: string): { success: boolean; qbBillTxnId: string | null; errorMsg: string | null } {
  const statusCodeMatch = xml.match(/<statusCode>(\d+)<\/statusCode>/)
  const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1]) : -1
  const statusMsgMatch = xml.match(/<statusMessage>(.*?)<\/statusMessage>/)
  const statusMsg = statusMsgMatch ? statusMsgMatch[1] : null
  const txnIdMatch = xml.match(/<TxnID[^>]*>(.*?)<\/TxnID>/)
  const txnId = txnIdMatch ? txnIdMatch[1] : null

  return {
    success: statusCode === 0,
    qbBillTxnId: txnId,
    errorMsg: statusCode !== 0 ? (statusMsg ?? `QB error code ${statusCode}`) : null,
  }
}

// Build SOAP envelope response for QBWC
export function soapResponse(methodName: string, returnValue: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${methodName}Response xmlns="http://developer.intuit.com/">
      <${methodName}Result>${returnValue}</${methodName}Result>
    </${methodName}Response>
  </soap:Body>
</soap:Envelope>`
}

export function soapResponseMulti(methodName: string, fields: Record<string, string>): string {
  const inner = Object.entries(fields)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('\n      ')
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${methodName}Response xmlns="http://developer.intuit.com/">
      ${inner}
    </${methodName}Response>
  </soap:Body>
</soap:Envelope>`
}

export function extractSoapField(xml: string, field: string): string {
  const match = xml.match(new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`, 'i'))
  return match ? match[1].trim() : ''
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
