import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createSession, getSession, closeSession,
  buildBillAddXML, parseBillAddResponse,
  soapResponse, soapResponseMulti, extractSoapField,
} from '@/lib/quickbooks/qbd'

// QBD Web Connector polls this endpoint via SOAP
export async function POST(req: NextRequest) {
  const body = await req.text()
  const supabase = await createClient()

  const soapAction = req.headers.get('soapaction')?.replace(/"/g, '') ?? ''

  if (soapAction.includes('authenticate') || body.includes('authenticate')) {
    return handleAuthenticate(body, supabase)
  }
  if (body.includes('sendRequestXML')) {
    return handleSendRequest(body, supabase)
  }
  if (body.includes('receiveResponseXML')) {
    return handleReceiveResponse(body, supabase)
  }
  if (body.includes('getLastError')) {
    const ticket = extractSoapField(body, 'ticket')
    return xmlResponse(soapResponse('getLastError', ''))
  }
  if (body.includes('closeConnection')) {
    const ticket = extractSoapField(body, 'ticket')
    closeSession(ticket)
    await updateHeartbeat(ticket, supabase)
    return xmlResponse(soapResponse('closeConnection', 'OK'))
  }
  if (body.includes('serverVersion')) {
    return xmlResponse(soapResponse('serverVersion', '1.0'))
  }
  if (body.includes('clientVersion')) {
    return xmlResponse(soapResponse('clientVersion', ''))
  }

  return xmlResponse(soapResponse('unknown', ''))
}

// Also serve the WSDL
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  if (url.searchParams.has('wsdl')) {
    return new NextResponse(WSDL_STUB, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    })
  }
  return NextResponse.json({ service: 'BillFlow QBD Web Connector' })
}

async function handleAuthenticate(body: string, supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const username = extractSoapField(body, 'strUserName')
  const password = extractSoapField(body, 'strPassword')

  // Look up company by QBD service key (stored as qbd_service_key on companies)
  const { data: company } = await supabase
    .from('companies')
    .select('company_id, qbd_service_key')
    .eq('qbd_service_key', username)
    .single()

  if (!company || password !== process.env.QBD_WEBHOOK_SECRET) {
    return xmlResponse(soapResponseMulti('authenticate', {
      string_0: '',
      string_1: 'nvu',  // not a valid user
    }))
  }

  const ticket = createSession(company.company_id)
  await updateHeartbeat(ticket, supabase, company.company_id)

  // Check if there are bills queued for QBD push
  const { count } = await supabase
    .from('bills')
    .select('bill_id', { count: 'exact', head: true })
    .eq('company_id', company.company_id)
    .eq('status', 'ready')

  if (!count || count === 0) {
    return xmlResponse(soapResponseMulti('authenticate', {
      string_0: ticket,
      string_1: 'none',  // no work to do
    }))
  }

  return xmlResponse(soapResponseMulti('authenticate', {
    string_0: ticket,
    string_1: '',  // empty = use current QB company file
  }))
}

async function handleSendRequest(body: string, supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const ticket = extractSoapField(body, 'ticket')
  const session = getSession(ticket)
  if (!session) return xmlResponse(soapResponse('sendRequestXML', ''))

  await updateHeartbeat(ticket, supabase, session.companyId)

  // Get next ready bill for this company
  const { data: bill } = await supabase
    .from('bills')
    .select(`
      bill_id, invoice_number, invoice_date, vendor_po_reference, qb_reference_number,
      vendors!bills_vendor_id_fkey ( qb_vendor_id, copy_po_to_qb_reference ),
      bill_line_items (
        line_id, description, extended_cost, gl_account_id, job_id, class_id, sort_order
      )
    `)
    .eq('company_id', session.companyId)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!bill) return xmlResponse(soapResponse('sendRequestXML', ''))

  const b = bill as Record<string, unknown>
  const vendor = b.vendors as { qb_vendor_id: string | null; copy_po_to_qb_reference: boolean } | null
  if (!vendor?.qb_vendor_id) {
    // Skip this bill — no QBD vendor ID
    await supabase.from('bills').update({
      status: 'sync_error',
      qb_sync_error: 'No QuickBooks Desktop vendor ID set on this vendor.',
    }).eq('bill_id', bill.bill_id)
    return xmlResponse(soapResponse('sendRequestXML', ''))
  }

  // Mark as publishing
  await supabase.from('bills').update({ status: 'publishing' }).eq('bill_id', bill.bill_id)

  const lineItems = (b.bill_line_items as Array<{
    line_id: string; description: string | null; extended_cost: number | null;
    gl_account_id: string | null; job_id: string | null; class_id: string | null; sort_order: number
  }>).sort((a, c) => a.sort_order - c.sort_order)
    .filter(li => li.gl_account_id && li.extended_cost != null)

  if (lineItems.length === 0) {
    await supabase.from('bills').update({
      status: 'sync_error',
      qb_sync_error: 'No line items with GL accounts.',
    }).eq('bill_id', bill.bill_id)
    return xmlResponse(soapResponse('sendRequestXML', ''))
  }

  const refNumber = vendor.copy_po_to_qb_reference
    ? ((b.qb_reference_number ?? b.vendor_po_reference) as string | null)
    : (b.qb_reference_number as string | null)

  const xml = buildBillAddXML({
    requestId: bill.bill_id,
    qbVendorListId: vendor.qb_vendor_id,
    invoiceDate: b.invoice_date as string | null,
    invoiceNumber: b.invoice_number as string | null,
    refNumber,
    lineItems: lineItems.map(li => ({
      qbAccountListId: li.gl_account_id!,
      amount: li.extended_cost!,
      description: li.description,
      qbJobListId: li.job_id,
      qbClassListId: li.class_id,
    })),
  })

  return xmlResponse(soapResponse('sendRequestXML', escapeForSoap(xml)))
}

async function handleReceiveResponse(body: string, supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const ticket = extractSoapField(body, 'ticket')
  const response = extractSoapField(body, 'response')
  const hresult = extractSoapField(body, 'hresult')
  const message = extractSoapField(body, 'message')

  const session = getSession(ticket)
  if (!session) return xmlResponse(soapResponse('receiveResponseXML', '-1'))

  await updateHeartbeat(ticket, supabase, session.companyId)

  if (hresult && hresult !== '0x00000000') {
    // QB Desktop returned an error
    await supabase.from('bills')
      .update({ status: 'sync_error', qb_sync_error: message || `HRESULT: ${hresult}` })
      .eq('company_id', session.companyId)
      .eq('status', 'publishing')
    return xmlResponse(soapResponse('receiveResponseXML', '100'))
  }

  const parsed = parseBillAddResponse(response)

  if (parsed.success && parsed.qbBillTxnId) {
    // Find the bill that was publishing
    const { data: publishingBill } = await supabase
      .from('bills')
      .select('bill_id')
      .eq('company_id', session.companyId)
      .eq('status', 'publishing')
      .single()

    if (publishingBill) {
      await supabase.from('bills').update({
        status: 'published',
        qb_bill_id: parsed.qbBillTxnId,
        publish_method: 'manual',
        qb_sync_error: null,
      }).eq('bill_id', publishingBill.bill_id)

      await supabase.from('processing_log').insert({
        bill_id: publishingBill.bill_id,
        action: 'published_to_qbd',
        actor: 'system',
        after_state: { qb_bill_id: parsed.qbBillTxnId },
      })
    }
  } else if (!parsed.success) {
    await supabase.from('bills').update({
      status: 'sync_error',
      qb_sync_error: parsed.errorMsg ?? 'Unknown QB error',
    }).eq('company_id', session.companyId).eq('status', 'publishing')
  }

  // Check if more bills are queued
  const { count } = await supabase
    .from('bills')
    .select('bill_id', { count: 'exact', head: true })
    .eq('company_id', session.companyId)
    .eq('status', 'ready')

  return xmlResponse(soapResponse('receiveResponseXML', count && count > 0 ? '50' : '100'))
}

async function updateHeartbeat(
  ticket: string,
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  companyId?: string
) {
  const session = getSession(ticket)
  const cid = companyId ?? session?.companyId
  if (!cid) return

  await supabase.from('qbd_heartbeats').upsert({
    company_id: cid,
    last_heartbeat_at: new Date().toISOString(),
    connector_status: 'running',
  }, { onConflict: 'company_id' })
}

function xmlResponse(xml: string) {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

function escapeForSoap(xml: string): string {
  return xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const WSDL_STUB = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://developer.intuit.com/" targetNamespace="http://developer.intuit.com/" name="QBWebConnectorSvc">
  <types/>
  <portType name="QBWebConnectorSvcSoap">
    <operation name="serverVersion"><input message="tns:serverVersionSoapIn"/><output message="tns:serverVersionSoapOut"/></operation>
    <operation name="clientVersion"><input message="tns:clientVersionSoapIn"/><output message="tns:clientVersionSoapOut"/></operation>
    <operation name="authenticate"><input message="tns:authenticateSoapIn"/><output message="tns:authenticateSoapOut"/></operation>
    <operation name="sendRequestXML"><input message="tns:sendRequestXMLSoapIn"/><output message="tns:sendRequestXMLSoapOut"/></operation>
    <operation name="receiveResponseXML"><input message="tns:receiveResponseXMLSoapIn"/><output message="tns:receiveResponseXMLSoapOut"/></operation>
    <operation name="getLastError"><input message="tns:getLastErrorSoapIn"/><output message="tns:getLastErrorSoapOut"/></operation>
    <operation name="closeConnection"><input message="tns:closeConnectionSoapIn"/><output message="tns:closeConnectionSoapOut"/></operation>
  </portType>
  <binding name="QBWebConnectorSvcSoap" type="tns:QBWebConnectorSvcSoap">
    <soap:binding transport="http://schemas.xmlsoap.org/soap/http"/>
  </binding>
  <service name="QBWebConnectorSvc">
    <port name="QBWebConnectorSvcSoap" binding="tns:QBWebConnectorSvcSoap">
      <soap:address location="/api/quickbooks/qbd"/>
    </port>
  </service>
</definitions>`
