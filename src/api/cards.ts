import { getCards as getCardsService, getInvoice as getInvoiceService, getInvoicePreview as getInvoicePreviewService, payInvoice as payInvoiceService } from '../services/accountService'
import { importItauFatura as importItauFaturaService } from '../services/importItau'

export function getCards() {
  return getCardsService()
}

export function getInvoice(cardId: string, year: number, month: number) {
  return getInvoiceService(cardId, year, month)
}

export function getInvoicePreview(cardId: string, year: number, month: number) {
  return getInvoicePreviewService(cardId, year, month)
}

export function payInvoice(invoiceId: string, status: boolean) {
  return payInvoiceService(invoiceId, status)
}

export function importItauFatura(accountId: string, file: string) {
  return importItauFaturaService(accountId, file)
}
