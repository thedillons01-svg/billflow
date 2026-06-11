// QBD Web Connector (QBWC) support

export type QBDSession = {
  companyId: string
  sessionTicket: string
  currentPoId?: string  // PO in-flight during current Web Connector exchange
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

// Generate QBXML for a purchase order add request
export function buildPurchaseOrderAddXML(po: {
  requestId: string
  qbVendorListId: string
  orderDate: string | null
  poNumber: string | null
  expectedDeliveryDate: string | null
  lineItems: Array<{
    description: string | null
    quantity: number | null
    unitCost: number | null
    amount: number
    qbJobListId: string | null
    qbClassListId: string | null
  }>
}): string {
  const txnDate = po.orderDate ? `<TxnDate>${po.orderDate}</TxnDate>` : ''
  const refNum = po.poNumber ? `<RefNumber>${escapeXml(po.poNumber)}</RefNumber>` : ''
  const shipDate = po.expectedDeliveryDate ? `<ShipDate>${po.expectedDeliveryDate}</ShipDate>` : ''

  const lines = po.lineItems
    .filter(li => li.amount > 0)
    .map(li => {
      const desc = li.description ? `<Desc>${escapeXml(li.description)}</Desc>` : ''
      const qty = li.quantity != null ? `<Quantity>${li.quantity}</Quantity>` : ''
      const rate = li.unitCost != null ? `<Rate>${li.unitCost.toFixed(2)}</Rate>` : ''
      const customer = li.qbJobListId ? `<CustomerRef><ListID>${escapeXml(li.qbJobListId)}</ListID></CustomerRef>` : ''
      const cls = li.qbClassListId ? `<ClassRef><ListID>${escapeXml(li.qbClassListId)}</ListID></ClassRef>` : ''
      return `
      <POLineAdd>
        ${desc}${qty}${rate}
        <Amount>${li.amount.toFixed(2)}</Amount>
        ${customer}${cls}
      </POLineAdd>`
    })
    .join('')

  return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <PurchaseOrderAddRq requestID="${escapeXml(po.requestId)}">
      <PurchaseOrderAdd>
        <VendorRef><ListID>${escapeXml(po.qbVendorListId)}</ListID></VendorRef>
        ${txnDate}
        ${refNum}
        ${shipDate}
        ${lines}
      </PurchaseOrderAdd>
    </PurchaseOrderAddRq>
  </QBXMLMsgsRq>
</QBXML>`
}

export function parsePurchaseOrderAddResponse(xml: string): { success: boolean; qbPoTxnId: string | null; errorMsg: string | null } {
  const statusCodeMatch = xml.match(/<statusCode>(\d+)<\/statusCode>/)
  const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1]) : -1
  const statusMsgMatch = xml.match(/<statusMessage>(.*?)<\/statusMessage>/)
  const statusMsg = statusMsgMatch ? statusMsgMatch[1] : null
  const txnIdMatch = xml.match(/<TxnID[^>]*>(.*?)<\/TxnID>/)
  const txnId = txnIdMatch ? txnIdMatch[1] : null

  return {
    success: statusCode === 0,
    qbPoTxnId: txnId,
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
