import {
  Dumbbell,
  Utensils,
  Gem,
  Shapes,
  GraduationCap,
  AlertCircle,
  Sparkles,
  Gamepad2,
  Home,
  LayoutDashboard,
  PawPrint,
  Banknote,
  Stethoscope,
  ArrowLeftRight,
  Plane,
  Car,
  Shirt,
  Tag,
  type LucideIcon,
} from 'lucide-react'

// core-api stores category icons as Material Design Icon (mdi-*) names,
// carried over from the old Vuetify frontend — mapped 1:1 to the closest lucide icon.
const ICON_MAP: Record<string, LucideIcon> = {
  'mdi-dumbbell': Dumbbell,
  'mdi-food': Utensils,
  'mdi-ring': Gem,
  'mdi-shape': Shapes,
  'mdi-school': GraduationCap,
  'mdi-alert-circle': AlertCircle,
  'mdi-face-woman-shimmer': Sparkles,
  'mdi-gamepad-variant': Gamepad2,
  'mdi-home': Home,
  'mdi-view-dashboard': LayoutDashboard,
  'mdi-paw': PawPrint,
  'mdi-cash': Banknote,
  'mdi-medical-bag': Stethoscope,
  'mdi-bank-transfer': ArrowLeftRight,
  'mdi-airplane': Plane,
  'mdi-car': Car,
  'mdi-tshirt-crew': Shirt,
}

export function resolveCategoryIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) return Tag
  return ICON_MAP[icon.toLowerCase()] ?? Tag
}

// Curated subset offered by the category icon picker — every key here has a mapped lucide icon.
export const CATEGORY_ICON_OPTIONS = Object.keys(ICON_MAP)
