import { checkoutMetadata, ShopCheckout } from "../views-checkout";

export async function generateMetadata({ params }: PageProps<"/[shop]/checkout">) {
  return checkoutMetadata((await params).shop);
}

export default async function CheckoutPage({ params }: PageProps<"/[shop]/checkout">) {
  return <ShopCheckout shop={(await params).shop} />;
}
