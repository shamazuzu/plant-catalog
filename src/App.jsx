import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Leaf, Heart, SlidersHorizontal, Sprout, Lock, LogOut, X,
  Plus, Pencil, Eye, EyeOff, ImagePlus, ArrowLeft, Save,
  Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from './supabase';

const FAVORITES_KEY = 'kind-of-green-favorites';

const MAX_URL = 'https://max.ru/u/f9LHodD0cOJyTw6rRDzloGk5WuqWxdMjoglfpIdytG357_M2CCEnIeSjK0A';
const TELEGRAM_URL = 'https://t.me/vilky_way';

function makeSlug(value) {
  const transliteration = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd',
    е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
    о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya'
  };

  return value.toLowerCase().split('')
    .map(char => transliteration[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const emptyForm = {
  plant_id: '',
  plant_name: '',
  botanical_name: '',
  cultivar: '',
  category_id: '',
  plant_description: '',
  care: '',
  pot_diameter: '',
  height_min: '',
  height_max: '',
  price: '',
  stock: '1',
  description_override: '',
  avito_url: '',
  status: 'available'
};

function getPhotoUrl(path) {
  if (!path || !supabase) return '';
  return supabase.storage.from('plant-photos').getPublicUrl(path).data.publicUrl;
}

function sortVariants(variants) {
  return [...variants].sort((a, b) =>
    (Number(a.pot_diameter) || 0) - (Number(b.pot_diameter) || 0)
  );
}

function sortCategories(categories) {
  return [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
  );
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString('ru-RU') + ' ₽';
}

function getHeight(variant) {
  if (variant.height_min && variant.height_max) {
    return `${variant.height_min}–${variant.height_max} см`;
  }
  if (variant.height_min) return `от ${variant.height_min} см`;
  if (variant.height_max) return `до ${variant.height_max} см`;
  return '';
}

function mapPublicPlants(rows) {
  const grouped = new Map();

  (rows || []).forEach(offer => {
    const plant = offer.plants;
    if (!plant || !plant.is_active) return;

    if (!grouped.has(plant.id)) {
      grouped.set(plant.id, {
        id: plant.id,
        name: plant.name,
        botanical_name: plant.botanical_name,
        cultivar: plant.cultivar,
        category: plant.plant_categories?.name || 'Прочие растения',
        description: plant.description || '',
        care: plant.care || '',
        variants: []
      });
    }

    const photos = (offer.offer_photos || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);

    grouped.get(plant.id).variants.push({
      id: offer.id,
      article_code: offer.article_code,
      pot_diameter: offer.pot_diameter,
      height_min: offer.height_min,
      height_max: offer.height_max,
      price: offer.price,
      stock: offer.stock,
      status: offer.status,
      description: offer.description_override || '',
      avito_url: offer.avito_url,
      photos
    });
  });

  return [...grouped.values()]
    .map(plant => ({
      ...plant,
      variants: sortVariants(plant.variants)
    }))
    .filter(plant =>
      plant.variants.some(v =>
        v.status === 'available' && Number(v.stock) > 0
      )
    );
}

const demoPlants = [
  {
    id: 'demo-1',
    name: 'Алоказия Лоу Райдер',
    botanical_name: 'Alocasia',
    category: 'Алоказии',
    description: 'Компактная алоказия с выразительной листвой.',
    variants: [{
      id: 'demo-1a',
      article_code: 'DEMO-001',
      pot_diameter: 8,
      height_min: 12,
      height_max: 16,
      price: 1200,
      stock: 1,
      status: 'available',
      photos: []
    }]
  },
  {
    id: 'demo-2',
    name: 'Замиокулькас Блэк',
    botanical_name: 'Zamioculcas zamiifolia',
    category: 'Замиокулькасы',
    description: 'Неприхотливое растение с тёмными листьями.',
    variants: [{
      id: 'demo-2a',
      article_code: 'DEMO-002',
      pot_diameter: 9,
      height_min: 15,
      height_max: 20,
      price: 900,
      stock: 2,
      status: 'available',
      photos: []
    }]
  },
  {
    id: 'demo-3',
    name: 'Алоказия Полли',
    botanical_name: 'Alocasia × amazonica',
    category: 'Алоказии',
    description: 'Контрастные листья с выразительными прожилками.',
    variants: [{
      id: 'demo-3a',
      article_code: 'DEMO-003',
      pot_diameter: 10,
      height_min: 20,
      height_max: 25,
      price: 1500,
      stock: 1,
      status: 'available',
      photos: []
    }]
  }
];

export default function App() {
  const [plants, setPlants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('Все растения');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('price-asc');
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Не удалось сохранить избранное:', error);
    }
  }, [favorites]);

  function toggleFavorite(offerId) {
    if (!offerId) return;

    setFavorites(current =>
      current.includes(offerId)
        ? current.filter(id => id !== offerId)
        : [...current, offerId]
    );
  }

  function isFavorite(offerId) {
    return favorites.includes(offerId);
  }

  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [loginOpen, setLoginOpen] = useState(false);
  const [resetEmailMode, setResetEmailMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState('plants');
  const [adminSearch, setAdminSearch] = useState('');

  const [adminOffers, setAdminOffers] = useState([]);
  const [adminPlants, setAdminPlants] = useState([]);
  const [adminCategories, setAdminCategories] = useState([]);

  const [categoryForm, setCategoryForm] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categorySaving, setCategorySaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [newPhotos, setNewPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');

  const selectedPlant = plants.find(p => p.id === selectedPlantId);

  const selectedVariant = selectedPlant
    ? selectedPlant.variants.find(v => v.id === selectedVariantId) ||
      sortVariants(selectedPlant.variants)[0]
    : null;

  const lightboxPhotos = selectedVariant?.photos || [];

  function showNextPhoto() {
    setLightboxIndex(current => {
      if (current === null || lightboxPhotos.length < 2) return current;
      return (current + 1) % lightboxPhotos.length;
    });
  }

  function showPreviousPhoto() {
    setLightboxIndex(current => {
      if (current === null || lightboxPhotos.length < 2) return current;
      return (current - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    });
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  useEffect(() => {
    if (lightboxIndex === null) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setLightboxIndex(null);

      if (event.key === 'ArrowRight') {
        setLightboxIndex(current => {
          if (current === null || lightboxPhotos.length < 2) return current;
          return (current + 1) % lightboxPhotos.length;
        });
      }

      if (event.key === 'ArrowLeft') {
        setLightboxIndex(current => {
          if (current === null || lightboxPhotos.length < 2) return current;
          return (current - 1 + lightboxPhotos.length) % lightboxPhotos.length;
        });
      }
    }

    const previousOverflow = document.body.style.overflow;
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxIndex, lightboxPhotos.length]);

  async function checkAdmin(user) {
    if (!user || !supabase) {
      setIsAdmin(false);
      return false;
    }

    const { data, error } = await supabase.rpc('is_admin');

    if (error) {
      console.error('Ошибка проверки администратора:', error);
      setIsAdmin(false);
      return false;
    }

    const result = data === true;
    setIsAdmin(result);
    return result;
  }

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);

      if (data.session?.user) {
        await checkAdmin(data.session.user);
      }

      if (mounted) setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);

        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true);
          setLoginOpen(false);
          setResetEmailMode(false);
          setAuthError('');
          setAuthMessage('');
        }

        if (!newSession) {
          setIsAdmin(false);
        } else {
          setTimeout(() => checkAdmin(newSession.user), 0);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    if (!supabase) {
      setAuthError('Нет подключения к базе данных.');
      return;
    }

    setAuthLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setAuthError('Не удалось войти. Проверь почту и пароль.');
      setAuthLoading(false);
      return;
    }

    const { data: adminData, error: adminError } =
      await supabase.rpc('is_admin');

    if (adminError || adminData !== true) {
      console.error('Ошибка проверки администратора:', adminError);
      await supabase.auth.signOut();
      setAuthError('Не удалось подтвердить права администратора.');
      setAuthLoading(false);
      return;
    }

    setSession(data.session);
    setIsAdmin(true);
    setLoginOpen(false);
    setPassword('');
    setAuthLoading(false);
  }

  async function handlePasswordResetRequest(event) {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    if (!supabase) {
      setAuthError('Нет подключения к базе данных.');
      return;
    }

    if (!email.trim()) {
      setAuthError('Введи адрес электронной почты.');
      return;
    }

    setAuthLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: window.location.origin }
    );

    setAuthLoading(false);

    if (error) {
      setAuthError('Не удалось отправить письмо: ' + error.message);
      return;
    }

    setAuthMessage(
      'Если аккаунт с такой почтой существует, письмо для восстановления пароля отправлено. Проверь почту.'
    );
  }

  async function handlePasswordUpdate(event) {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');

    if (!supabase) {
      setAuthError('Нет подключения к базе данных.');
      return;
    }

    if (newPassword.length < 6) {
      setAuthError('Пароль должен содержать не менее 6 символов.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthError('Пароли не совпадают.');
      return;
    }

    setAuthLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    setAuthLoading(false);

    if (error) {
      setAuthError('Не удалось изменить пароль: ' + error.message);
      return;
    }

    setRecoveryMode(false);
    setNewPassword('');
    setConfirmPassword('');
    setPassword('');

    await supabase.auth.signOut();

    setLoginOpen(true);
    setResetEmailMode(false);
    setAuthMessage('Пароль успешно изменён. Теперь можешь войти.');
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setAdminOpen(false);
    setAdminTab('plants');
  }

  async function loadCatalog() {
    if (!supabase) {
      setPlants(demoPlants);
      setCategories([]);
      setUsingDemo(true);
      setLoading(false);
      return;
    }

    const [{ data: cats }, { data, error }] = await Promise.all([
      supabase
        .from('plant_categories')
        .select('id,name')
        .eq('is_active', true)
        .order('sort_order'),

      supabase
        .from('plant_offers')
        .select(`
          id,plant_id,article_code,price,stock,status,
          pot_diameter,height_min,height_max,
          description_override,avito_url,
          plants!inner(
            id,name,botanical_name,cultivar,
            description,care,category_id,is_active,
            plant_categories(name)
          ),
          offer_photos(storage_path,sort_order)
        `)
        .in('status', ['available', 'sold'])
        .order('created_at', { ascending: false })
    ]);

    if (cats) setCategories(sortCategories(cats));

    if (error) {
      console.error('Ошибка загрузки каталога:', error);
      setPlants(demoPlants);
      setUsingDemo(true);
    } else {
      setUsingDemo(false);
      setPlants(mapPublicPlants(data || []));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    function readHash() {
      const hash = window.location.hash;
      const match = hash.match(/^#\/plant\/([^/]+)$/);

      if (match) {
        setShowDelivery(false);
        setShowContacts(false);
        setShowAbout(false);
        setSelectedPlantId(decodeURIComponent(match[1]));
        setSelectedVariantId(null);
        setLightboxIndex(null);
      } else if (hash === '#/about') {
        setSelectedPlantId(null);
        setSelectedVariantId(null);
        setLightboxIndex(null);
        setShowDelivery(false);
        setShowContacts(false);
        setShowAbout(true);
      } else if (hash === '#/delivery') {
        setSelectedPlantId(null);
        setSelectedVariantId(null);
        setLightboxIndex(null);
        setShowDelivery(true);
        setShowContacts(false);
        setShowAbout(false);
      } else if (hash === '#/contacts') {
        setSelectedPlantId(null);
        setSelectedVariantId(null);
        setLightboxIndex(null);
        setShowDelivery(false);
        setShowContacts(true);
        setShowAbout(false);
      } else {
        setSelectedPlantId(null);
        setSelectedVariantId(null);
        setLightboxIndex(null);
        setShowDelivery(false);
        setShowContacts(false);
        setShowAbout(false);
      }
    }

    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  function openPlant(plant) {
    setShowDelivery(false);
    setShowContacts(false);
    setShowAbout(false);
    setSelectedPlantId(plant.id);

    const favoriteVariant = plant.variants.find(v => favorites.includes(v.id));
    setSelectedVariantId(favoriteVariant?.id || null);

    setLightboxIndex(null);
    window.location.hash = `/plant/${encodeURIComponent(plant.id)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closePlant() {
    setLightboxIndex(null);
    window.location.hash = '';
    setSelectedPlantId(null);
    setSelectedVariantId(null);
    setShowDelivery(false);
    setShowContacts(false);
    setShowAbout(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDelivery() {
    setSelectedPlantId(null);
    setSelectedVariantId(null);
    setLightboxIndex(null);
    setShowContacts(false);
    setShowAbout(false);
    setShowDelivery(true);
    window.location.hash = '/delivery';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openContacts() {
    setSelectedPlantId(null);
    setSelectedVariantId(null);
    setLightboxIndex(null);
    setShowDelivery(false);
    setShowAbout(false);
    setShowContacts(true);
    window.location.hash = '/contacts';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openAbout() {
    setSelectedPlantId(null);
    setSelectedVariantId(null);
    setLightboxIndex(null);
    setShowDelivery(false);
    setShowContacts(false);
    setShowAbout(true);
    window.location.hash = '/about';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToCatalog() {
    setShowDelivery(false);
    setShowContacts(false);
    setShowAbout(false);
    setSelectedPlantId(null);
    setSelectedVariantId(null);
    setLightboxIndex(null);
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadAdminData() {
    if (!supabase) return;

    const [
      { data: plantsData, error: plantsError },
      { data: offersData, error: offersError },
      { data: categoryData, error: categoryError }
    ] = await Promise.all([
      supabase
        .from('plants')
        .select(`
          id,name,botanical_name,cultivar,category_id,
          description,care,is_active,plant_categories(name)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('plant_offers')
        .select(`
          id,plant_id,title,size_label,article_code,price,stock,
          is_individual,status,description_override,avito_url,
          pot_diameter,height_min,height_max,qr_code,
          plants(name,botanical_name),
          offer_photos(storage_path,sort_order)
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('plant_categories')
        .select('id,name,sort_order,is_active')
        .order('sort_order', { ascending: true })
    ]);

    if (plantsError || offersError || categoryError) {
      setAdminError(
        'Не удалось загрузить данные: ' +
        (plantsError?.message || offersError?.message || categoryError?.message)
      );
      return;
    }

    setAdminPlants(plantsData || []);
    setAdminOffers(offersData || []);
    setAdminCategories(sortCategories(categoryData || []));
  }

  useEffect(() => {
    if (adminOpen && isAdmin) loadAdminData();
  }, [adminOpen, isAdmin]);

  function startEditCategory(item) {
    setEditingCategoryId(item.id);
    setCategoryForm(item.name);
    setAdminError('');
    setAdminMessage('');
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
    setCategoryForm('');
  }

  async function saveCategory(event) {
    event.preventDefault();
    const name = categoryForm.trim();

    if (!name) {
      setAdminError('Введи название категории.');
      return;
    }

    setCategorySaving(true);
    setAdminError('');
    setAdminMessage('');

    try {
      let result;
      const baseSlug = makeSlug(name);

      if (!baseSlug) {
        throw new Error('Не удалось создать адрес категории. Измени название.');
      }

      if (editingCategoryId) {
        result = await supabase
          .from('plant_categories')
          .update({ name, slug: baseSlug })
          .eq('id', editingCategoryId);
      } else {
        const maxOrder = Math.max(
          0,
          ...adminCategories.map(item => Number(item.sort_order) || 0)
        );

        const { data: existingSlugs, error: slugError } = await supabase
          .from('plant_categories')
          .select('slug');

        if (slugError) throw slugError;

        const usedSlugs = new Set((existingSlugs || []).map(item => item.slug));
        let slug = baseSlug;
        let suffix = 2;

        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix}`;
          suffix++;
        }

        result = await supabase
          .from('plant_categories')
          .insert({
            name,
            slug,
            sort_order: maxOrder + 1,
            is_active: true
          });
      }

      if (result.error) throw result.error;

      cancelEditCategory();
      await loadAdminData();
      await loadCatalog();
      setAdminMessage('Категория сохранена.');
    } catch (error) {
      console.error(error);
      setAdminError(
        'Не удалось сохранить категорию: ' +
        (error.message || 'неизвестная ошибка')
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function toggleCategory(item) {
    setAdminError('');
    setAdminMessage('');

    const { error } = await supabase
      .from('plant_categories')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (error) {
      setAdminError('Не удалось изменить категорию: ' + error.message);
      return;
    }

    if (category === item.name && item.is_active) {
      setCategory('Все растения');
    }

    await loadAdminData();
    await loadCatalog();
    setAdminMessage('Статус категории изменён.');
  }

  async function deleteCategory(item) {
    setAdminError('');
    setAdminMessage('');

    const { count, error: countError } = await supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', item.id);

    if (countError) {
      setAdminError('Не удалось проверить категорию: ' + countError.message);
      return;
    }

    if (count > 0) {
      setAdminError(
        `Нельзя удалить «${item.name}»: в ней есть растения. Сначала перемести их в другую категорию.`
      );
      return;
    }

    if (!window.confirm(`Удалить категорию «${item.name}»?`)) return;

    const { error } = await supabase
      .from('plant_categories')
      .delete()
      .eq('id', item.id);

    if (error) {
      setAdminError('Не удалось удалить категорию: ' + error.message);
      return;
    }

    if (category === item.name) setCategory('Все растения');

    await loadAdminData();
    await loadCatalog();
    setAdminMessage('Категория удалена.');
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setNewPhotos([]);
    setAdminMessage('');
    setAdminError('');
  }

  function startEdit(offer) {
    setEditingId(offer.id);

    setForm({
      ...emptyForm,
      plant_id: offer.plant_id || '',
      pot_diameter: offer.pot_diameter ?? '',
      height_min: offer.height_min ?? '',
      height_max: offer.height_max ?? '',
      price: offer.price ?? '',
      stock: String(offer.stock ?? 0),
      description_override: offer.description_override || '',
      avito_url: offer.avito_url || '',
      status: offer.status || 'available'
    });

    setNewPhotos([]);
    setAdminMessage('');
    setAdminError('');
    setAdminTab('plants');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveOffer(event) {
    event.preventDefault();
    setAdminMessage('');
    setAdminError('');

    if (!supabase) {
      setAdminError('Нет подключения к базе данных.');
      return;
    }

    if (!editingId && !form.plant_id && !form.plant_name.trim()) {
      setAdminError('Выбери существующее растение или введи название нового.');
      return;
    }

    if (form.price === '' || Number(form.price) < 0) {
      setAdminError('Укажи корректную цену.');
      return;
    }

    if (form.stock === '' || Number(form.stock) < 0) {
      setAdminError('Укажи количество экземпляров.');
      return;
    }

    if (form.pot_diameter !== '' && Number(form.pot_diameter) <= 0) {
      setAdminError('Диаметр горшка должен быть больше нуля.');
      return;
    }

    if (
      form.height_min !== '' &&
      form.height_max !== '' &&
      Number(form.height_max) < Number(form.height_min)
    ) {
      setAdminError('Максимальная высота не может быть меньше минимальной.');
      return;
    }

    setSaving(true);

    try {
      let plantId = form.plant_id;

      if (!editingId && !plantId) {
        const { data: newPlant, error: plantError } = await supabase
          .from('plants')
          .insert({
            name: form.plant_name.trim(),
            botanical_name: form.botanical_name.trim() || null,
            cultivar: form.cultivar.trim() || null,
            category_id: form.category_id || null,
            description: form.plant_description.trim() || null,
            care: form.care.trim() || null,
            is_active: true
          })
          .select('id')
          .single();

        if (plantError) throw plantError;
        plantId = newPlant.id;
      }

      const payload = {
        plant_id: plantId,
        price: Number(form.price),
        stock: Math.max(0, Number(form.stock) || 0),
        is_individual: false,
        pot_diameter: form.pot_diameter === ''
          ? null
          : Number(form.pot_diameter),
        height_min: form.height_min === ''
          ? null
          : Number(form.height_min),
        height_max: form.height_max === ''
          ? null
          : Number(form.height_max),
        status: form.status,
        description_override: form.description_override.trim() || null,
        avito_url: form.avito_url.trim() || null
      };

      let offerId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('plant_offers')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from('plant_offers')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;
        offerId = created.id;
      }

      for (let i = 0; i < newPhotos.length; i++) {
        const file = newPhotos[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${offerId}/${Date.now()}-${i}-${safeName}`;

        const { error: uploadError } = await supabase
          .storage
          .from('plant-photos')
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase
          .from('offer_photos')
          .insert({
            offer_id: offerId,
            storage_path: path,
            alt_text: file.name,
            sort_order: i
          });

        if (photoError) throw photoError;
      }

      setAdminMessage(
        editingId ? 'Изменения сохранены.' : 'Размер добавлен в каталог.'
      );

      setEditingId(null);
      setForm(emptyForm);
      setNewPhotos([]);

      await loadAdminData();
      await loadCatalog();
    } catch (error) {
      console.error(error);
      setAdminError(
        'Не удалось сохранить: ' +
        (error.message || 'неизвестная ошибка')
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeOfferStatus(offer, status) {
    setAdminError('');
    setAdminMessage('');

    const { error } = await supabase
      .from('plant_offers')
      .update({ status })
      .eq('id', offer.id);

    if (error) {
      setAdminError('Не удалось изменить статус: ' + error.message);
      return;
    }

    await loadAdminData();
    await loadCatalog();
  }

  async function deleteOffer(offer) {
    const confirmed = window.confirm(
      `Удалить размер горшка ${
        offer.pot_diameter ? `${offer.pot_diameter} см` : 'без указанного диаметра'
      } у растения «${offer.plants?.name || 'Растение'}»?\n\n` +
      'Будут удалены только этот размер и его фотографии. Остальные размеры останутся.'
    );

    if (!confirmed) return;

    setAdminError('');
    setAdminMessage('');

    try {
      const { data: photos, error: photosError } = await supabase
        .from('offer_photos')
        .select('storage_path')
        .eq('offer_id', offer.id);

      if (photosError) throw photosError;

      const paths = (photos || [])
        .map(photo => photo.storage_path)
        .filter(Boolean);

      const { error: photoRecordsError } = await supabase
        .from('offer_photos')
        .delete()
        .eq('offer_id', offer.id);

      if (photoRecordsError) throw photoRecordsError;

      const { error: offerError } = await supabase
        .from('plant_offers')
        .delete()
        .eq('id', offer.id);

      if (offerError) throw offerError;

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('plant-photos')
          .remove(paths);

        if (storageError) {
          console.error('Не удалось удалить файлы фотографий:', storageError);
        }
      }

      if (editingId === offer.id) {
        setEditingId(null);
        setForm(emptyForm);
        setNewPhotos([]);
      }

      setFavorites(current => current.filter(id => id !== offer.id));

      await loadAdminData();
      await loadCatalog();
      setAdminMessage('Размер и его фотографии удалены.');
    } catch (error) {
      console.error(error);
      setAdminError('Не удалось удалить размер: ' + error.message);
    }
  }

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = plants.filter(p => {
      const matchesCategory =
        category === 'Все растения' || p.category === category;

      const matchesFavorites =
        !showFavorites || p.variants.some(v => favorites.includes(v.id));

      const searchableText = [
        p.name,
        p.botanical_name || '',
        p.cultivar || '',
        ...p.variants.map(v => v.article_code || '')
      ].join(' ').toLowerCase();

      return matchesCategory &&
        matchesFavorites &&
        searchableText.includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      const pricesA = a.variants
        .filter(v => v.status === 'available' && Number(v.stock) > 0)
        .map(v => Number(v.price));

      const pricesB = b.variants
        .filter(v => v.status === 'available' && Number(v.stock) > 0)
        .map(v => Number(v.price));

      const priceA = pricesA.length ? Math.min(...pricesA) : 0;
      const priceB = pricesB.length ? Math.min(...pricesB) : 0;

      switch (sortBy) {
        case 'price-asc': return priceA - priceB;
        case 'price-desc': return priceB - priceA;
        case 'name-asc':
          return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        case 'name-desc':
          return b.name.localeCompare(a.name, 'ru', { sensitivity: 'base' });
        default: return 0;
      }
    });
  }, [plants, category, query, sortBy, showFavorites, favorites]);

  const filteredAdminOffers = useMemo(() => {
    const normalized = adminSearch.trim().toLowerCase();
    if (!normalized) return adminOffers;

    return adminOffers.filter(o =>
      `${o.article_code || ''} ${o.plants?.name || ''} ${o.plants?.botanical_name || ''}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [adminOffers, adminSearch]);

  return (
    <div className="page">
      <header className="topbar">
        <a
          className="brand"
          href="#/"
          onClick={() => {
            setSelectedPlantId(null);
            setSelectedVariantId(null);
            setLightboxIndex(null);
            setShowDelivery(false);
            setShowContacts(false);
            setShowAbout(false);
          }}
        >
          <span className="brand-icon"><Leaf size={21} /></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>
              <span>Kind</span> <span className="brand-light">of</span> <span>Green</span>
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: '0.08em',
              color: '#788575'
            }}>
              Санкт-Петербург
            </span>
          </span>
        </a>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
          <span className="top-note">Небольшая коллекция растений</span>

          <a
            href="#/about"
            onClick={event => {
              event.preventDefault();
              openAbout();
            }}
            style={deliveryLink}
          >
            О нас
          </a>

          <a
            href="#/contacts"
            onClick={event => {
              event.preventDefault();
              openContacts();
            }}
            style={deliveryLink}
          >
            Контакты
          </a>

          <a
            href="#/delivery"
            onClick={event => {
              event.preventDefault();
              openDelivery();
            }}
            style={deliveryLink}
          >
            Доставка и самовывоз
          </a>

          {authReady && (
            isAdmin ? (
              <>
                <button
                  onClick={() => {
                    if (adminOpen) {
                      setAdminOpen(false);
                    } else {
                      setAdminTab('plants');
                      setAdminOpen(true);
                      startNew();
                    }
                  }}
                  style={headerButton}
                >
                  <Sprout size={15} />
                  {adminOpen ? 'Каталог' : 'Админка'}
                </button>

                <button onClick={handleLogout} style={headerButton}>
                  <LogOut size={15} /> Выйти
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setAuthError('');
                  setAuthMessage('');
                  setResetEmailMode(false);
                  setLoginOpen(true);
                }}
                style={headerButton}
              >
                <Lock size={15} /> Войти
              </button>
            )
          )}
        </div>
      </header>

      {adminOpen && isAdmin ? (
        <main className="admin-main">
          <div className="section-heading">
            <div>
              <p className="eyebrow">УПРАВЛЕНИЕ</p>
              <h2>Админ-панель</h2>
            </div>

            <button style={headerButton} onClick={() => setAdminOpen(false)}>
              <ArrowLeft size={15} /> В каталог
            </button>
          </div>

          <div style={adminTabs}>
            <button
              onClick={() => {
                setAdminTab('plants');
                setAdminError('');
                setAdminMessage('');
              }}
              style={adminTab === 'plants' ? activeTabButton : tabButton}
            >
              <Sprout size={16} />
              Растения и размеры
            </button>

            <button
              onClick={() => {
                setAdminTab('categories');
                setAdminError('');
                setAdminMessage('');
              }}
              style={adminTab === 'categories' ? activeTabButton : tabButton}
            >
              <SlidersHorizontal size={16} />
              Категории
            </button>
          </div>

          {adminError && <p style={errorText}>{adminError}</p>}
          {adminMessage && <p style={successText}>{adminMessage}</p>}

          {adminTab === 'categories' && (
            <div style={adminPanel}>
              <h3 style={{ marginTop: 0 }}>Категории растений</h3>

              <p style={mutedText}>
                Создавай категории, меняй их названия.
                Скрытые категории не видны посетителям каталога.
                Категории автоматически сортируются по алфавиту.
              </p>

              <form onSubmit={saveCategory}>
                <label style={fieldLabel}>
                  {editingCategoryId
                    ? 'Новое название категории'
                    : 'Название новой категории'}
                </label>

                <div style={categoryFormRow}>
                  <input
                    style={{ ...fieldInput, margin: 0, flex: 1 }}
                    value={categoryForm}
                    onChange={e => setCategoryForm(e.target.value)}
                    placeholder="Например, Алоказии"
                    required
                  />

                  <button
                    type="submit"
                    disabled={categorySaving}
                    style={smallActionButton}
                  >
                    <Save size={15} />
                    {categorySaving
                      ? 'Сохраняем…'
                      : editingCategoryId ? 'Сохранить' : 'Добавить'}
                  </button>

                  {editingCategoryId && (
                    <button
                      type="button"
                      style={iconButton}
                      onClick={cancelEditCategory}
                      title="Отмена"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              </form>

              <div style={{ marginTop: 18 }}>
                {adminCategories.length === 0 ? (
                  <p className="empty">Категорий пока нет.</p>
                ) : (
                  sortCategories(adminCategories).map(item => (
                    <div key={item.id} style={categoryRow}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{item.name}</strong>
                        <div style={categoryStatus}>
                          {item.is_active ? 'Видна в каталоге' : 'Скрыта'}
                        </div>
                      </div>

                      <button
                        style={iconButton}
                        onClick={() => startEditCategory(item)}
                        title="Переименовать"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        style={iconButton}
                        onClick={() => toggleCategory(item)}
                        title={item.is_active ? 'Скрыть' : 'Показать'}
                      >
                        {item.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>

                      <button
                        style={deleteButton}
                        onClick={() => deleteCategory(item)}
                        title="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {adminTab === 'plants' && (
            <>
              <div style={adminPanel}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <h3 style={{ margin: 0 }}>
                    {editingId ? 'Редактирование размера' : 'Новое растение или размер'}
                  </h3>

                  {editingId && (
                    <button style={headerButton} onClick={startNew}>
                      <Plus size={15} /> Новое
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveOffer}>
                  {!editingId && (
                    <>
                      <label style={fieldLabel}>Существующее растение</label>

                      <select
                        style={fieldInput}
                        value={form.plant_id}
                        onChange={e =>
                          setForm({ ...form, plant_id: e.target.value })
                        }
                      >
                        <option value="">Создать новое растение</option>
                        {adminPlants.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      {!form.plant_id && (
                        <>
                          <label style={fieldLabel}>Название растения *</label>
                          <input
                            style={fieldInput}
                            required
                            value={form.plant_name}
                            onChange={e =>
                              setForm({ ...form, plant_name: e.target.value })
                            }
                            placeholder="Например, Алоказия Лоу Райдер"
                          />

                          <label style={fieldLabel}>Ботаническое название</label>
                          <input
                            style={fieldInput}
                            value={form.botanical_name}
                            onChange={e =>
                              setForm({ ...form, botanical_name: e.target.value })
                            }
                            placeholder="Alocasia..."
                          />

                          <label style={fieldLabel}>Сорт / культивар</label>
                          <input
                            style={fieldInput}
                            value={form.cultivar}
                            onChange={e =>
                              setForm({ ...form, cultivar: e.target.value })
                            }
                          />

                          <label style={fieldLabel}>Категория</label>
                          <select
                            style={fieldInput}
                            value={form.category_id}
                            onChange={e =>
                              setForm({ ...form, category_id: e.target.value })
                            }
                          >
                            <option value="">Без категории</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>

                          <label style={fieldLabel}>Описание растения</label>
                          <textarea
                            style={fieldInput}
                            rows="3"
                            value={form.plant_description}
                            onChange={e =>
                              setForm({ ...form, plant_description: e.target.value })
                            }
                          />

                          <label style={fieldLabel}>Уход</label>
                          <textarea
                            style={fieldInput}
                            rows="3"
                            value={form.care}
                            onChange={e =>
                              setForm({ ...form, care: e.target.value })
                            }
                          />
                        </>
                      )}
                    </>
                  )}

                  <h4 style={{ margin: '24px 0 8px', color: '#405c43' }}>
                    Параметры размера
                  </h4>

                  <div style={formGrid}>
                    <div>
                      <label style={fieldLabel}>Диаметр горшка, см</label>
                      <input
                        style={fieldInput}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={form.pot_diameter}
                        onChange={e =>
                          setForm({ ...form, pot_diameter: e.target.value })
                        }
                        placeholder="Например, 8"
                      />
                    </div>

                    <div>
                      <label style={fieldLabel}>Минимальная высота, см</label>
                      <input
                        style={fieldInput}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={form.height_min}
                        onChange={e =>
                          setForm({ ...form, height_min: e.target.value })
                        }
                        placeholder="Например, 12"
                      />
                    </div>

                    <div>
                      <label style={fieldLabel}>Максимальная высота, см</label>
                      <input
                        style={fieldInput}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={form.height_max}
                        onChange={e =>
                          setForm({ ...form, height_max: e.target.value })
                        }
                        placeholder="Например, 16"
                      />
                    </div>

                    <div>
                      <label style={fieldLabel}>Цена, ₽ *</label>
                      <input
                        style={fieldInput}
                        type="number"
                        min="0"
                        required
                        value={form.price}
                        onChange={e => setForm({ ...form, price: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={fieldLabel}>Количество</label>
                      <input
                        style={fieldInput}
                        type="number"
                        min="0"
                        step="1"
                        value={form.stock}
                        onChange={e => setForm({ ...form, stock: e.target.value })}
                      />
                    </div>
                  </div>

                  <label style={fieldLabel}>Особенности конкретного размера</label>
                  <textarea
                    style={fieldInput}
                    rows="3"
                    value={form.description_override}
                    onChange={e =>
                      setForm({ ...form, description_override: e.target.value })
                    }
                    placeholder="Например, крупный клубень, 4 листа..."
                  />

                  <label style={fieldLabel}>Ссылка на Avito (необязательно)</label>
                  <input
                    style={fieldInput}
                    type="url"
                    value={form.avito_url}
                    onChange={e =>
                      setForm({ ...form, avito_url: e.target.value })
                    }
                    placeholder="https://www.avito.ru/..."
                  />

                  <label style={fieldLabel}>Статус</label>
                  <select
                    style={fieldInput}
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="available">В наличии</option>
                    <option value="hidden">Скрыто</option>
                    <option value="sold">Продано</option>
                    <option value="draft">Черновик</option>
                  </select>

                  <label style={fieldLabel}>Фотографии этого размера</label>
                  <label style={uploadLabel}>
                    <ImagePlus size={18} /> Выбрать фотографии
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={e =>
                        setNewPhotos(Array.from(e.target.files || []))
                      }
                      style={{ display: 'none' }}
                    />
                  </label>

                  {newPhotos.length > 0 && (
                    <p style={{ fontSize: 13, color: '#52634f' }}>
                      Выбрано файлов: {newPhotos.length}
                    </p>
                  )}

                  <button type="submit" disabled={saving} style={submitButton}>
                    <Save
                      size={16}
                      style={{ verticalAlign: 'middle', marginRight: 7 }}
                    />
                    {saving
                      ? 'Сохраняем…'
                      : editingId ? 'Сохранить изменения' : 'Добавить в каталог'}
                  </button>
                </form>
              </div>

              <div style={{ marginTop: 30 }}>
                <h3>Размеры и предложения</h3>

                <div className="search" style={{ margin: '14px 0', maxWidth: 420 }}>
                  <Search size={18} />
                  <input
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder="Поиск по артикулу или названию..."
                  />
                </div>

                {filteredAdminOffers.length === 0 ? (
                  <p className="empty">
                    {adminOffers.length === 0
                      ? 'Пока нет предложений.'
                      : 'Ничего не найдено.'}
                  </p>
                ) : (
                  filteredAdminOffers.map(o => (
                    <div key={o.id} style={offerRow}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{o.plants?.name || 'Растение'}</strong>

                        <div style={{
                          fontSize: 12,
                          color: '#52634f',
                          marginTop: 4,
                          fontWeight: 600
                        }}>
                          Артикул: {o.article_code || '—'}
                        </div>

                        <div style={{
                          fontSize: 12,
                          color: '#788575',
                          marginTop: 4
                        }}>
                          {o.pot_diameter
                            ? `Горшок ${o.pot_diameter} см`
                            : 'Диаметр не указан'}
                          {getHeight(o) ? ` · ${getHeight(o)}` : ''}
                          {' · '}{formatPrice(o.price)}
                          {' · '}{o.stock} шт.
                          {' · '}
                          {o.status === 'available' ? 'В наличии' :
                            o.status === 'sold' ? 'Продано' :
                              o.status === 'hidden' ? 'Скрыто' : 'Черновик'}
                        </div>

                        {o.avito_url && (
                          <a
                            href={o.avito_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 12, color: '#52634f' }}
                          >
                            Открыть Avito
                          </a>
                        )}
                      </div>

                      <button
                        style={iconButton}
                        onClick={() => startEdit(o)}
                        title="Редактировать"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        style={deleteButton}
                        onClick={() => deleteOffer(o)}
                        title="Удалить этот размер"
                      >
                        <Trash2 size={16} />
                      </button>

                      {o.status === 'hidden' ? (
                        <button
                          style={iconButton}
                          onClick={() => changeOfferStatus(o, 'available')}
                          title="Показать"
                        >
                          <Eye size={16} />
                        </button>
                      ) : (
                        <button
                          style={iconButton}
                          onClick={() => changeOfferStatus(o, 'hidden')}
                          title="Скрыть"
                        >
                          <EyeOff size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      ) : (
        <>
          <main>
            {showAbout ? (
              <section className="catalog">
                <button style={backButton} onClick={backToCatalog}>
                  <ArrowLeft size={16} /> Назад в каталог
                </button>

                <div style={aboutPage}>
                  <p className="eyebrow">KIND OF GREEN</p>
                  <h1 style={detailTitle}>О нас</h1>

                  <p style={aboutIntro}>
                    Комнатные растения для дома по разумным ценам. Уже подготовленные к жизни у вас дома.
                  </p>

                  <p style={aboutText}>
                    Здесь собраны комнатные растения на разный вкус и бюджет: от неприхотливой зелени для начинающих до необычных экземпляров для тех, кто уже успел заболеть домашними джунглями.
                  </p>

                  <p style={aboutText}>
                    Часть растений я выращиваю самостоятельно, другие закупаю у поставщиков, адаптирую к новым условиям и только после этого выставляю на продажу.
                  </p>

                  <p style={aboutText}>
                    Моя задача — сделать комнатные растения доступнее, не экономя на их состоянии и качестве.
                  </p>

                  <h2 style={aboutHeading}>Почему стоит покупать здесь?</h2>

                  <div style={aboutGrid}>
                    <article style={aboutCard}>
                      <h3>Цены без лишней магазинной наценки</h3>
                      <p style={aboutText}>
                        Я работаю в небольшом формате, без дорогой торговой площади и большого штата сотрудников. Это позволяет предлагать растения по более доступным ценам, чем во многих традиционных магазинах.
                      </p>
                    </article>

                    <article style={aboutCard}>
                      <h3>Растения уже подготовлены к домашнему содержанию</h3>
                      <p style={aboutText}>
                        Все растения адаптированы, посажены в подходящий авторский грунт и обеспечены удобрением пролонгированного действия с запасом питания примерно на полгода. Не нужно сразу искать подходящий субстрат, покупать удобрения и заниматься пересадкой. Остаётся выбрать растению подходящее место и поливать с учётом его потребностей.
                      </p>
                    </article>

                    <article style={aboutCard}>
                      <h3>Растения с понятной историей</h3>
                      <p style={aboutText}>
                        Часть ассортимента выращена самостоятельно. Закупленные растения проходят адаптацию и проверку перед продажей. Я уделяю внимание корням, состоянию листьев и общему здоровью растения.
                      </p>
                    </article>

                    <article style={aboutCard}>
                      <h3>Ассортимент постоянно обновляется</h3>
                      <p style={aboutText}>
                        Популярные комнатные растения, интересные новинки и экземпляры, которые не всегда встретишь в ближайшем цветочном магазине. Количество некоторых позиций ограничено.
                      </p>
                    </article>

                    <article style={aboutCard}>
                      <h3>Помощь с выбором и уходом</h3>
                      <p style={aboutText}>
                        Не знаете, какое растение подойдёт для вашей квартиры или с чего начать? Помогу подобрать вариант с учётом условий содержания и расскажу об основных особенностях ухода.
                      </p>
                    </article>
                  </div>

                  <h2 style={aboutHeading}>Что можно найти в каталоге?</h2>

                  <p style={aboutText}>
                    Ассортимент не ограничивается одной категорией растений. Здесь постепенно собирается разнообразная коллекция комнатной зелени.
                  </p>

                  <p style={aboutText}>
                    В основном это небольшие экземпляры, но могу достать и крупномеры по договорённости, адаптирую и посажу в подходящий грунт.
                  </p>

                  <h2 style={aboutHeading}>Как купить?</h2>

                  <p style={aboutText}>
                    Выберите понравившееся растение в каталоге, посмотрите фотографии, описание и актуальную цену. После этого свяжитесь со мной, чтобы уточнить наличие и договориться о покупке.
                  </p>

                  <div style={aboutDelivery}>
                    <p>📍 Самовывоз в Санкт-Петербурге.</p>
                    <p>🚗 Возможна доставка по Санкт-Петербургу по договорённости.</p>
                  </div>

                  <p style={aboutText}>
                    Ассортимент и наличие регулярно обновляются — заглядывайте, возможно, именно сегодня появилось что-то интересное.
                  </p>

                  <p style={aboutFinal}>
                    Домашние джунгли начинаются с одного растения.
                  </p>
                </div>
              </section>
            ) : showContacts ? (
              <section className="catalog">
                <button style={backButton} onClick={backToCatalog}>
                  <ArrowLeft size={16} /> Назад в каталог
                </button>

                <div style={{ maxWidth: 760, margin: '20px auto 60px' }}>
                  <p className="eyebrow">KIND OF GREEN</p>

                  <h1 style={detailTitle}>Контакты</h1>

                  <p className="description" style={{ marginTop: 20 }}>
                    Если понравилось растение или возникли вопросы — напишите мне.
                  </p>

                  <div style={deliveryCard}>
                    <h2 style={deliveryHeading}>Связаться со мной</h2>

                    <p className="description">
                      Выберите удобный мессенджер:
                    </p>

                    <div style={contactButtons}>
                      <a
                        href={MAX_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={contactButton}
                      >
                        MAX
                      </a>

                      <a
                        href={TELEGRAM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={contactButton}
                      >
                        Telegram
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            ) : showDelivery ? (
              <section className="catalog">
                <button style={backButton} onClick={backToCatalog}>
                  <ArrowLeft size={16} /> Назад в каталог
                </button>

                <div style={{ maxWidth: 760, margin: '20px auto 60px' }}>
                  <p className="eyebrow">KIND OF GREEN</p>

                  <h1 style={detailTitle}>Доставка и самовывоз</h1>

                  <p className="description" style={{ marginTop: 20 }}>
                    Рассказываю, как можно получить понравившиеся растения.
                  </p>

                  <div style={deliveryCard}>
                    <h2 style={deliveryHeading}>Доставка</h2>

                    <p className="description">
                      Доставка осуществляется курьером Яндекса.
                      Стоимость доставки оплачивает покупатель.
                      Возможность доставки и удобное время согласуем
                      индивидуально при оформлении заказа.
                    </p>
                  </div>

                  <div style={deliveryCard}>
                    <h2 style={deliveryHeading}>Самовывоз</h2>

                    <p className="description">
                      Самовывоз возможен по предварительной договорённости.
                      Пожалуйста, сначала свяжитесь со мной, чтобы согласовать
                      время получения заказа.
                    </p>

                    <p style={{
                      color: '#405c43',
                      fontWeight: 600,
                      marginTop: 18
                    }}>
                      Санкт-Петербург, ул. Верности, 8к3
                    </p>

                    <a
                      href="https://yandex.ru/maps/?rtext=~Санкт-Петербург%2C%20улица%20Верности%2C%208к3&rtt=auto"
                      target="_blank"
                      rel="noreferrer"
                      style={routeButton}
                    >
                      Построить маршрут в Яндекс Картах
                    </a>
                  </div>
                </div>
              </section>
            ) : selectedPlant ? (
              <section className="catalog">
                <button style={backButton} onClick={closePlant}>
                  <ArrowLeft size={16} /> Назад в каталог
                </button>

                <div style={detailLayout}>
                  <div>
                    <div style={detailPhoto}>
                      {selectedVariant?.photos?.length > 0 ? (
                        <img
                          src={getPhotoUrl(selectedVariant.photos[0].storage_path)}
                          alt={selectedPlant.name}
                          onClick={() => setLightboxIndex(0)}
                          style={detailPhotoImage}
                        />
                      ) : (
                        <div className="photo-placeholder">
                          <Leaf size={55} />
                          <span>растение</span>
                        </div>
                      )}
                    </div>

                    {selectedVariant?.photos?.length > 1 && (
                      <div style={photoGallery}>
                        {selectedVariant.photos.map((photo, index) => (
                          <button
                            key={photo.storage_path}
                            type="button"
                            onClick={() => setLightboxIndex(index)}
                            style={galleryButton}
                            aria-label={`Открыть фото ${index + 1}`}
                          >
                            <img
                              src={getPhotoUrl(photo.storage_path)}
                              alt={`${selectedPlant.name}, фото ${index + 1}`}
                              style={galleryImage}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="plant-category">{selectedPlant.category}</p>
                    <h1 style={detailTitle}>{selectedPlant.name}</h1>

                    {selectedPlant.botanical_name && (
                      <p className="latin">{selectedPlant.botanical_name}</p>
                    )}

                    {selectedPlant.cultivar && (
                      <p className="latin">{selectedPlant.cultivar}</p>
                    )}

                    <p className="description" style={{ marginTop: 20 }}>
                      {selectedVariant?.description || selectedPlant.description ||
                        'Растение из домашней коллекции.'}
                    </p>

                    <h3 style={{ marginTop: 28 }}>Выберите размер</h3>

                    <div style={variantButtons}>
                      {selectedPlant.variants.map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedVariantId(v.id);
                            setLightboxIndex(null);
                          }}
                          style={
                            selectedVariant?.id === v.id
                              ? selectedVariantButton
                              : variantButton
                          }
                        >
                          {v.pot_diameter
                            ? `${v.pot_diameter} см`
                            : 'Размер не указан'}
                          {v.status !== 'available' || Number(v.stock) <= 0
                            ? ' · нет в наличии'
                            : ''}
                        </button>
                      ))}
                    </div>

                    {selectedVariant && (
                      <div style={variantDetails}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginBottom: 12
                        }}>
                          <strong style={{ color: '#405c43', fontSize: 13 }}>
                            Артикул: {selectedVariant.article_code || '—'}
                          </strong>

                          <button
                            type="button"
                            onClick={() => toggleFavorite(selectedVariant.id)}
                            aria-label={
                              isFavorite(selectedVariant.id)
                                ? 'Убрать из избранного'
                                : 'Добавить в избранное'
                            }
                            title={
                              isFavorite(selectedVariant.id)
                                ? 'Убрать из избранного'
                                : 'Добавить в избранное'
                            }
                            style={{
                              ...iconButton,
                              color: isFavorite(selectedVariant.id) ? '#b64b42' : '#405c43',
                              borderColor: isFavorite(selectedVariant.id) ? '#eadbd8' : '#dfe4d9'
                            }}
                          >
                            <Heart
                              size={19}
                              fill={isFavorite(selectedVariant.id) ? '#b64b42' : 'none'}
                            />
                          </button>
                        </div>

                        <div style={detailLine}>
                          <span>Диаметр горшка</span>
                          <strong>
                            {selectedVariant.pot_diameter
                              ? `${selectedVariant.pot_diameter} см`
                              : 'Не указан'}
                          </strong>
                        </div>

                        <div style={detailLine}>
                          <span>Высота растения</span>
                          <strong>{getHeight(selectedVariant) || 'Не указана'}</strong>
                        </div>

                        <div style={detailLine}>
                          <span>Количество</span>
                          <strong>
                            {selectedVariant.status === 'available' &&
                              Number(selectedVariant.stock) > 0
                              ? `${selectedVariant.stock} шт.`
                              : 'Нет в наличии'}
                          </strong>
                        </div>

                        <div style={detailPrice}>
                          {formatPrice(selectedVariant.price)}
                        </div>

                        {selectedVariant.status === 'available' &&
                          Number(selectedVariant.stock) > 0 &&
                          selectedVariant.avito_url && (
                            <a
                              href={selectedVariant.avito_url}
                              target="_blank"
                              rel="noreferrer"
                              style={avitoButton}
                            >
                              Посмотреть объявление на Avito
                            </a>
                          )}
                      </div>
                    )}

                    {selectedPlant.care && (
                      <div style={{ marginTop: 30 }}>
                        <h3>Уход</h3>
                        <p className="description">{selectedPlant.care}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className="hero">
                  <div className="hero-copy">
                    <p className="eyebrow">
                      <Sprout size={15} /> РАСТЕНИЯ С ХАРАКТЕРОМ
                    </p>

                    <h1>
                      Найдите своё<br />
                      <em>зелёное</em> растение
                    </h1>

                    <p className="hero-sub">
                      Домашние растения, выращенные с вниманием и заботой.
                    </p>
                  </div>

                  <div className="hero-art" aria-hidden="true">
                    <div className="sun"></div>
                    <div className="plant-shape leaf-a"></div>
                    <div className="plant-shape leaf-b"></div>
                    <div className="plant-shape leaf-c"></div>
                    <div className="pot"></div>
                  </div>
                </section>

                <section className="catalog">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">КОЛЛЕКЦИЯ</p>
                      <h2>{showFavorites ? 'Избранные растения' : 'Растения в наличии'}</h2>
                    </div>

                    <span className="count">{visible.length} позиций</span>
                  </div>

                  <div className="toolbar">
                    <div className="search">
                      <Search size={18} />
                      <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Найти растение или артикул..."
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFavorites(value => !value)}
                      style={{
                        ...headerButton,
                        color: showFavorites ? '#b64b42' : '#405c43',
                        borderColor: showFavorites ? '#eadbd8' : '#dfe4d9',
                        background: showFavorites ? '#fff8f7' : '#fff'
                      }}
                    >
                      <Heart
                        size={16}
                        fill={showFavorites ? '#b64b42' : 'none'}
                      />
                      Избранное ({favorites.length})
                    </button>

                    <div className="search" style={{ maxWidth: 230 }}>
                      <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        style={{
                          width: '100%',
                          border: 0,
                          outline: 0,
                          background: 'transparent',
                          color: '#405c43',
                          font: 'inherit',
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                        aria-label="Сортировка растений"
                      >
                        <option value="price-asc">Сначала дешевле</option>
                        <option value="price-desc">Сначала дороже</option>
                        <option value="name-asc">По алфавиту А–Я</option>
                        <option value="name-desc">По алфавиту Я–А</option>
                      </select>
                    </div>

                    <div className="filter-label">
                      <SlidersHorizontal size={16} /> Категории
                    </div>
                  </div>

                  <div className="chips">
                    {['Все растения', ...categories.map(c => c.name)].map(c => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={category === c ? 'chip active' : 'chip'}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  {usingDemo && (
                    <div className="notice">
                      Пока показываем демонстрационные карточки. После подключения
                      приложения к базе здесь появятся твои растения.
                    </div>
                  )}

                  {loading ? (
                    <div className="empty">Загружаем каталог…</div>
                  ) : visible.length ? (
                    <div className="grid">
                      {visible.map(p => {
                        const available = p.variants.filter(v =>
                          v.status === 'available' && Number(v.stock) > 0
                        );

                        const minPrice = Math.min(
                          ...available.map(v => Number(v.price))
                        );

                        const totalStock = available.reduce(
                          (sum, v) => sum + Number(v.stock || 0),
                          0
                        );

                        const firstVariant = sortVariants(available)[0];
                        const firstPhoto = firstVariant?.photos?.[0]?.storage_path;
                        const favorite = firstVariant && isFavorite(firstVariant.id);

                        return (
                          <article
                            className="plant-card"
                            key={p.id}
                            onClick={() => openPlant(p)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="plant-photo">
                              {firstPhoto && supabase ? (
                                <img
                                  src={getPhotoUrl(firstPhoto)}
                                  alt={p.name}
                                />
                              ) : (
                                <div className="photo-placeholder">
                                  <Leaf size={42} />
                                  <span>растение</span>
                                </div>
                              )}

                              <button
                                className="heart"
                                type="button"
                                aria-label={
                                  favorite
                                    ? 'Убрать из избранного'
                                    : 'Добавить в избранное'
                                }
                                title={
                                  favorite
                                    ? 'Убрать из избранного'
                                    : 'Добавить в избранное'
                                }
                                onClick={e => {
                                  e.stopPropagation();
                                  if (firstVariant) toggleFavorite(firstVariant.id);
                                }}
                                style={{
                                  color: favorite ? '#b64b42' : undefined
                                }}
                              >
                                <Heart
                                  size={18}
                                  fill={favorite ? '#b64b42' : 'none'}
                                />
                              </button>

                              <span className="photo-tag">В наличии</span>
                            </div>

                            <div className="plant-info">
                              <p className="plant-category">{p.category}</p>
                              <h3>{p.name}</h3>

                              {p.botanical_name && (
                                <p className="latin">{p.botanical_name}</p>
                              )}

                              <p className="description">
                                {p.description || 'Растение из домашней коллекции.'}
                              </p>

                              <div style={cardVariantInfo}>
                                {available.length} {available.length === 1
                                  ? 'размер'
                                  : available.length < 5 ? 'размера' : 'размеров'}
                                {' · '}{totalStock} шт. в наличии
                              </div>

                              {firstVariant?.article_code && (
                                <div style={{
                                  fontSize: 11,
                                  color: '#788575',
                                  marginTop: 5
                                }}>
                                  Артикул: {firstVariant.article_code}
                                </div>
                              )}

                              <div className="card-bottom">
                                <strong>от {formatPrice(minPrice)}</strong>
                                <span>Подробнее →</span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty">
                      {showFavorites
                        ? 'В избранном пока пусто. Нажми на сердечко у понравившегося растения.'
                        : 'Пока здесь нет растений. Они появятся после добавления в каталог.'}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>

          <footer>
            © {new Date().getFullYear()} Kind of Green
            <span>Выращено с заботой</span>
          </footer>
        </>
      )}

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex] && (
        <div
          style={lightboxBackdrop}
          onClick={closeLightbox}
          role="presentation"
        >
          <button
            type="button"
            onClick={closeLightbox}
            style={lightboxClose}
            aria-label="Закрыть просмотр"
            title="Закрыть (Esc)"
          >
            <X size={28} />
          </button>

          {lightboxPhotos.length > 1 && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                showPreviousPhoto();
              }}
              style={{ ...lightboxArrow, left: 18 }}
              aria-label="Предыдущее фото"
              title="Предыдущее фото"
            >
              <ChevronLeft size={34} />
            </button>
          )}

          <img
            src={getPhotoUrl(lightboxPhotos[lightboxIndex].storage_path)}
            alt={`${selectedPlant?.name || 'Растение'}, фото ${lightboxIndex + 1}`}
            style={lightboxImage}
            onClick={event => event.stopPropagation()}
          />

          {lightboxPhotos.length > 1 && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                showNextPhoto();
              }}
              style={{ ...lightboxArrow, right: 18 }}
              aria-label="Следующее фото"
              title="Следующее фото"
            >
              <ChevronRight size={34} />
            </button>
          )}

          {lightboxPhotos.length > 1 && (
            <div style={lightboxCounter}>
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          )}
        </div>
      )}

      {recoveryMode && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="brand-icon" style={{ margin: '0 auto 12px' }}>
                <Leaf size={22} />
              </div>

              <h2 style={modalTitle}>Новый пароль</h2>
              <p style={mutedText}>Придумай новый пароль для входа</p>
            </div>

            <form onSubmit={handlePasswordUpdate}>
              <label style={fieldLabel}>Новый пароль</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={fieldInput}
                placeholder="Не менее 6 символов"
              />

              <label style={fieldLabel}>Повтори новый пароль</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={fieldInput}
                placeholder="Повтори пароль"
              />

              {authError && <p style={errorText}>{authError}</p>}

              <button type="submit" disabled={authLoading} style={submitButton}>
                {authLoading ? 'Сохраняем…' : 'Сохранить пароль'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loginOpen && (
        <div
          style={modalBackdrop}
          onClick={() => {
            setLoginOpen(false);
            setResetEmailMode(false);
          }}
        >
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => {
                setLoginOpen(false);
                setResetEmailMode(false);
              }}
              style={closeButton}
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="brand-icon" style={{ margin: '0 auto 12px' }}>
                <Leaf size={22} />
              </div>

              <h2 style={modalTitle}>
                {resetEmailMode
                  ? 'Восстановление пароля'
                  : 'Вход администратора'}
              </h2>

              <p style={mutedText}>
                {resetEmailMode
                  ? 'Отправим ссылку для создания нового пароля'
                  : 'Управление каталогом растений'}
              </p>
            </div>

            <form
              onSubmit={
                resetEmailMode
                  ? handlePasswordResetRequest
                  : handleLogin
              }
            >
              <label style={fieldLabel}>Электронная почта</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={fieldInput}
              />

              {!resetEmailMode && (
                <>
                  <label style={fieldLabel}>Пароль</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Твой пароль"
                    style={fieldInput}
                  />
                </>
              )}

              {authError && <p style={errorText}>{authError}</p>}
              {authMessage && <p style={successText}>{authMessage}</p>}

              <button type="submit" disabled={authLoading} style={submitButton}>
                {authLoading
                  ? 'Подожди…'
                  : resetEmailMode ? 'Отправить письмо' : 'Войти'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              {resetEmailMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmailMode(false);
                    setAuthError('');
                    setAuthMessage('');
                  }}
                  style={textButton}
                >
                  Вернуться ко входу
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmailMode(true);
                    setAuthError('');
                    setAuthMessage('');
                  }}
                  style={textButton}
                >
                  Забыли пароль?
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const headerButton = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '9px 13px',
  border: '1px solid #dfe4d9',
  borderRadius: 5,
  background: '#fff',
  color: '#405c43',
  cursor: 'pointer',
  fontSize: 12
};

const deliveryLink = {
  color: '#405c43',
  fontSize: 12,
  textDecoration: 'none',
  borderBottom: '1px solid #cbd5c5',
  paddingBottom: 3,
  whiteSpace: 'nowrap'
};

const deliveryCard = {
  background: '#fff',
  border: '1px solid #e3e8df',
  borderRadius: 8,
  padding: 24,
  marginTop: 20
};

const deliveryHeading = {
  fontFamily: 'Playfair Display, serif',
  fontWeight: 500,
  fontSize: 23,
  color: '#24352b',
  margin: '0 0 12px'
};

const routeButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10,
  padding: '12px 17px',
  borderRadius: 5,
  background: '#405c43',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 13
};

const contactButtons = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 20
};

const contactButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 120,
  padding: '13px 22px',
  borderRadius: 5,
  background: '#405c43',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500
};

const adminTabs = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 22,
  marginBottom: 8,
  borderBottom: '1px solid #e3e8df',
  paddingBottom: 12
};

const tabButton = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  border: '1px solid #dfe4d9',
  borderRadius: 6,
  background: '#fff',
  color: '#52634f',
  cursor: 'pointer',
  fontSize: 13
};

const activeTabButton = {
  ...tabButton,
  background: '#405c43',
  borderColor: '#405c43',
  color: '#fff'
};

const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: '#17231999',
  display: 'grid',
  placeItems: 'center',
  padding: 18
};

const modalBox = {
  position: 'relative',
  width: '100%',
  maxWidth: 430,
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: 30,
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 20px 60px #0003'
};

const modalTitle = {
  fontFamily: 'Playfair Display, serif',
  fontWeight: 500,
  margin: 0
};

const mutedText = {
  color: '#7c8678',
  fontSize: 13
};

const closeButton = {
  position: 'absolute',
  top: 12,
  right: 12,
  border: 0,
  background: 'transparent',
  color: '#788575',
  cursor: 'pointer'
};

const fieldLabel = {
  display: 'block',
  margin: '15px 0 7px',
  fontSize: 12,
  color: '#52634f'
};

const fieldInput = {
  boxSizing: 'border-box',
  width: '100%',
  padding: '12px',
  border: '1px solid #dfe4d9',
  borderRadius: 5,
  font: 'inherit',
  fontSize: 14,
  outlineColor: '#718b65',
  background: '#fff'
};

const submitButton = {
  width: '100%',
  marginTop: 22,
  padding: 13,
  border: 0,
  borderRadius: 5,
  background: '#405c43',
  color: '#fff',
  font: 'inherit',
  cursor: 'pointer'
};

const textButton = {
  border: 0,
  background: 'transparent',
  color: '#405c43',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  textDecoration: 'underline'
};

const adminPanel = {
  background: '#fff',
  border: '1px solid #e3e8df',
  borderRadius: 8,
  padding: 22,
  marginTop: 20
};

const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
  gap: 12
};

const uploadLabel = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 14px',
  border: '1px dashed #9aaa91',
  borderRadius: 5,
  color: '#405c43',
  cursor: 'pointer',
  fontSize: 13,
  marginTop: 5
};

const offerRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: '#fff',
  border: '1px solid #e3e8df',
  borderRadius: 7,
  padding: 13,
  marginTop: 9
};

const iconButton = {
  width: 38,
  height: 38,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid #dfe4d9',
  borderRadius: 5,
  background: '#fff',
  color: '#405c43',
  cursor: 'pointer',
  flexShrink: 0
};

const categoryFormRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap'
};

const smallActionButton = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '11px 14px',
  border: 0,
  borderRadius: 5,
  background: '#405c43',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13
};

const categoryRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  padding: '10px 0',
  borderBottom: '1px solid #edf0e9'
};

const categoryStatus = {
  fontSize: 11,
  color: '#788575',
  marginTop: 4
};

const deleteButton = {
  ...iconButton,
  color: '#b64b42',
  borderColor: '#eadbd8'
};

const errorText = {
  color: '#b64b42',
  fontSize: 13
};

const successText = {
  color: '#405c43',
  fontSize: 13
};

const backButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 0',
  border: 0,
  background: 'transparent',
  color: '#405c43',
  cursor: 'pointer',
  font: 'inherit',
  marginBottom: 20
};

const detailLayout = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))',
  gap: 36,
  alignItems: 'start',
  marginTop: 15
};

const detailPhoto = {
  width: '100%',
  aspectRatio: '1 / 1',
  overflow: 'hidden',
  borderRadius: 8,
  background: '#edf1e9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const detailTitle = {
  fontSize: 32,
  fontWeight: 700,
  lineHeight: 1.15,
  margin: '12px 0',
  color: '#24352b'
};

const detailPhotoImage = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  cursor: 'zoom-in'
};

const photoGallery = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill,minmax(75px,1fr))',
  gap: 8,
  marginTop: 10
};

const galleryButton = {
  display: 'block',
  width: '100%',
  padding: 0,
  border: 0,
  borderRadius: 5,
  background: '#edf1e9',
  overflow: 'hidden',
  cursor: 'zoom-in'
};

const galleryImage = {
  display: 'block',
  width: '100%',
  aspectRatio: '1 / 1',
  objectFit: 'contain',
  borderRadius: 5
};

const lightboxBackdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  background: 'rgba(0, 0, 0, 0.94)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '55px 70px 65px',
  boxSizing: 'border-box'
};

const lightboxImage = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  userSelect: 'none'
};

const lightboxClose = {
  position: 'absolute',
  top: 16,
  right: 18,
  width: 44,
  height: 44,
  display: 'grid',
  placeItems: 'center',
  border: 0,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.13)',
  color: '#fff',
  cursor: 'pointer',
  zIndex: 2
};

const lightboxArrow = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 48,
  height: 48,
  display: 'grid',
  placeItems: 'center',
  border: 0,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.13)',
  color: '#fff',
  cursor: 'pointer',
  zIndex: 2
};

const lightboxCounter = {
  position: 'absolute',
  bottom: 18,
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#fff',
  fontSize: 13,
  background: 'rgba(255,255,255,0.13)',
  padding: '7px 13px',
  borderRadius: 20
};

const variantButtons = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  marginTop: 14
};

const variantButton = {
  padding: '11px 15px',
  border: '1px solid #dfe4d9',
  borderRadius: 5,
  background: '#fff',
  color: '#405c43',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13
};

const selectedVariantButton = {
  ...variantButton,
  background: '#405c43',
  color: '#fff',
  borderColor: '#405c43'
};

const variantDetails = {
  marginTop: 22,
  padding: 18,
  border: '1px solid #e3e8df',
  borderRadius: 7,
  background: '#fff'
};

const detailLine = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 15,
  padding: '9px 0',
  borderBottom: '1px solid #edf0e9',
  fontSize: 13,
  color: '#52634f'
};

const detailPrice = {
  fontSize: 27,
  fontWeight: 600,
  color: '#405c43',
  marginTop: 18
};

const avitoButton = {
  display: 'inline-flex',
  marginTop: 16,
  padding: '12px 16px',
  borderRadius: 5,
  background: '#405c43',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 13
};

const cardVariantInfo = {
  color: '#788575',
  fontSize: 12,
  marginTop: 12
};

const aboutPage = {
  maxWidth: 850,
  margin: '20px auto 70px',
  padding: '0 4px'
};

const aboutIntro = {
  fontSize: 22,
  lineHeight: 1.45,
  fontWeight: 600,
  color: '#405c43',
  margin: '28px 0'
};

const aboutText = {
  fontSize: 15,
  lineHeight: 1.8,
  color: '#555d52',
  margin: '14px 0'
};

const aboutHeading = {
  fontSize: 23,
  fontWeight: 500,
  color: '#354b38',
  margin: '48px 0 20px'
};

const aboutGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 14,
  marginTop: 20
};

const aboutCard = {
  background: '#f5f6f1',
  border: '1px solid #e7e9e1',
  borderRadius: 8,
  padding: 22
};

const aboutDelivery = {
  background: '#f5f6f1',
  borderRadius: 8,
  padding: '12px 22px',
  margin: '24px 0',
  color: '#405c43',
  lineHeight: 1.6
};

const aboutFinal = {
  marginTop: 42,
  padding: '26px 10px',
  textAlign: 'center',
  color: '#405c43',
  fontSize: 21,
  fontWeight: 500,
  lineHeight: 1.5
};
