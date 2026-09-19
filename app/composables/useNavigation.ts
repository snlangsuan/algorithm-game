export interface NavItem {
  label: string
  to: string
}

export const useNavigation = () => {
  const mainNav: NavItem[] = [
    { label: 'หน้าแรก', to: '/' },
    { label: 'เล่นเกม', to: '/play' },
    { label: 'ความรู้', to: '/learn' },
    { label: 'เกี่ยวกับ', to: '/about' }
  ]

  return { mainNav }
}
