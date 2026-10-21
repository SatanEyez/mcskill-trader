import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { Hero } from '../components/home/Hero';
import { QuickLinks } from '../components/home/QuickLinks';
import { NewsBlock } from '../components/news/NewsBlock';
import { useResourceStats } from '../hooks/useResourceStats';

/**
 * Главная: превью трейда с кнопками, ниже — новостная лента.
 * Каталог ресурсов переехал на отдельную страницу `/resources`.
 */
export function HomePage() {
  const { stats, loading } = useResourceStats();
  const categories = stats?.categories ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <Hero
          resourceCount={stats?.total ?? 0}
          categoryCount={categories.length}
          minPrice={stats?.min_price ?? null}
          loading={loading}
        />

        <NewsBlock />

        <QuickLinks resourceCount={stats?.total ?? 0} />
      </main>

      <Footer />
    </div>
  );
}
