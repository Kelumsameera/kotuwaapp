import CartView from "@/components/store/CartView";

// /cart — works for guests too; login is only needed at checkout.
export default function CartPage() {
  return <CartView />;
}
