import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Search, Leaf, Heart, SlidersHorizontal, Sprout } from 'lucide-react';
import { supabase } from './supabase';

const demoPlants = [
  { id: 'demo-1', name: 'Алоказия Лоу Райдер', botanical_name: 'Alocasia', category: 'Алоказии', price: 1200, stock: 1, status: 'available', description: 'Компактная алоказия с выразительной листвой.' },
  { id: 'demo-2', name: 'Замиокулькас Блэк', botanical_name: 'Zamioculcas zamiifolia', category: 'Замиокулькасы', price: 900, stock: 2, status: 'available', description: 'Неприхотливое растение с тёмными листьями.' },
  { id: 'demo-3', name: 'Алоказия Полли', botanical_name: 'Alocasia × amazonica', category: 'Алоказии', price: 1500, stock: 1, status: 'available', description: 'Контрастные листья с выразительными прожилками.' },
];

export default function App() {
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState(['Все растения', 'Алоказии', 'Замиокулькасы', 'Аглаонемы', 'Папоротники', 'Фикусы', 'Сингониумы', 'Прочие растения']);
  const [category, setCategory] = useState('Все растения');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) {
        if (alive) { setOffers(demoPlants); setUsingDemo(true); setLoading(false); }
        return;
      }
      const [{ data: cats }, { data, error }] = await Promise.all([
        supabase.from('plant_categories').select('id,name').eq('is_active', true).order('sort_order'),
        supabase.from('plant_offers')
          .select('id,title,size_label,price,stock,status,description_override,plants!inner(id,name,botanical_name,category_id,is_active,plant_categories(name)),offer_photos(storage_path,sort_order)')
          .eq('status', 'available')
          .gt('stock', 0)
          .order('created_at', { ascending: false })
      ]);
      if (!alive) return;
      if (cats?.length) setCategories(['Все растения', ...cats.map(c => c.name)]);
      if (error) {
        console.error(error);
        setOffers(demoPlants);
        setUsingDemo(true);
      } else {
        const mapped = (data || []).filter(o => o.plants?.is_active).map(o => ({
          id: o.id, name: o.title || o.plants?.name || 'Растение',
          botanical_name: o.plants?.botanical_name,
          category: o.plants?.plant_categories?.name || 'Прочие растения',
          price: o.price, stock: o.stock, status: o.status,
          description: o.description_override || '',
          photo: o.offer_photos?.sort((a,b) => a.sort_order-b.sort_order)?.[0]?.storage_path
        }));
        setOffers(mapped);
      }
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => offers.filter(p =>
    (category === 'Все растения' || p.category === category) &&
    `${p.name} ${p.botanical_name || ''}`.toLowerCase().includes(query.toLowerCase())
  ), [offers, category, query]);

  return <div className="page">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon"><Leaf size={21}/></span><span>зелёная<span className="brand-light">комната</span></span></a>
      <span className="top-note">Небольшая коллекция растений</span>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sprout size={15}/> РАСТЕНИЯ С ХАРАКТЕРОМ</p>
          <h1>Найдите своё<br/><em>зелёное</em> растение</h1>
          <p className="hero-sub">Домашние растения, выращенные с вниманием и заботой.</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="sun"></div><div className="plant-shape leaf-a"></div><div className="plant-shape leaf-b"></div><div className="plant-shape leaf-c"></div><div className="pot"></div></div>
      </section>

      <section className="catalog">
        <div className="section-heading"><div><p className="eyebrow">КОЛЛЕКЦИЯ</p><h2>Растения в наличии</h2></div><span className="count">{visible.length} позиций</span></div>
        <div className="toolbar">
          <div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти растение..."/></div>
          <div className="filter-label"><SlidersHorizontal size={16}/> Категории</div>
        </div>
        <div className="chips">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={category===c?'chip active':'chip'}>{c}</button>)}</div>
        {usingDemo && <div className="notice">Пока показываем демонстрационные карточки. После подключения приложения к базе здесь появятся твои растения.</div>}
        {loading ? <div className="empty">Загружаем каталог…</div> : visible.length ? <div className="grid">{visible.map(p=><article className="plant-card" key={p.id}>
          <div className="plant-photo">{p.photo && supabase ? <img src={supabase.storage.from('plant-photos').getPublicUrl(p.photo).data.publicUrl} alt={p.name}/> : <div className="photo-placeholder"><Leaf size={42}/><span>растение</span></div>}<button className="heart" aria-label="В избранное"><Heart size={18}/></button><span className="photo-tag">В наличии</span></div>
          <div className="plant-info"><p className="plant-category">{p.category}</p><h3>{p.name}</h3>{p.botanical_name && <p className="latin">{p.botanical_name}</p>}<p className="description">{p.description || 'Растение из домашней коллекции.'}</p><div className="card-bottom"><strong>{Number(p.price).toLocaleString('ru-RU')} ₽</strong><span>{p.stock > 1 ? `${p.stock} шт.` : '1 экземпляр'}</span></div></div>
        </article>)}</div> : <div className="empty">Пока здесь нет растений. Они появятся после добавления в каталог.</div>}
      </section>
    </main>
    <footer>© {new Date().getFullYear()} Зелёная комната <span>Выращено с заботой</span></footer>
  </div>;
}
