import { ShopHome } from "./views-home";

// app.com/<shop>: that shop's catalogue (no shop with this address → not found)
export default async function Home({ params }: PageProps<"/[shop]">) {
  return <ShopHome slug={(await params).shop} />;
}
