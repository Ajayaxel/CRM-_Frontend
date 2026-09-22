import { PosTabBar } from '@/features/verticals/restaurant/restaurant';
// The POS stylesheet. Every `rst-*` class on every restaurant screen comes from
// here; nothing else loads it, so without this line production rendered those
// screens unstyled — and the phone tab bar, hidden above 560px by this file,
// showed on every desktop.
import '@/features/verticals/restaurant/restaurant/ui/restaurant.css';

/**
 * Every POS route gets the phone tab bar. It renders only below 560px (CSS), so
 * on a tablet or desktop the platform sidebar remains the only navigation and
 * this costs nothing.
 */
export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PosTabBar />
    </>
  );
}
