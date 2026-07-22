import { House, ArrowLeftRight, Landmark, CreditCard, LayoutGrid, Tag, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Início', path: '/', icon: House },
  { label: 'Transações', path: '/transacoes', icon: ArrowLeftRight },
  { label: 'Contas', path: '/contas', icon: Landmark },
  { label: 'Cartões', path: '/cartoes', icon: CreditCard },
  { label: 'Categorias', path: '/categorias', icon: LayoutGrid },
  { label: 'Tags', path: '/tags', icon: Tag },
]
