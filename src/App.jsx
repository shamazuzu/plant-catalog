import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Leaf, Heart, SlidersHorizontal, Sprout, Lock, LogOut, X,
  Plus, Pencil, Eye, EyeOff, ImagePlus, ArrowLeft, Save
} from 'lucide-react';
import { supabase } from './supabase';

const demoPlants = [
  {
    id: 'demo-1',
    name: 'Алоказия Лоу Райдер',
    botanical_name: 'Alocasia',
    category: 'Алоказии',
    price: 1200,
    stock: 1,
    description: 'Компактная алоказия с выразительной листвой.'
  },
  {
    id: 'demo-2',
    name: 'Замиокулькас Блэк',
    botanical_name: 'Zamioculcas zamiifolia',
    category: 'Замиокулькасы',
    price: 900,
    stock: 2,
    description: 'Неприхотливое растение с тёмными листьями.'
  },
  {
    id: 'demo-3',
    name: 'Алоказия Полли',
    botanical_name: 'Alocasia × amazonica',
    category: 'Алоказии',
    price: 1500,
    stock: 1,
    description: 'Контрастные листья с выразительными прожилками.'
  }
];

const emptyForm = {
  plant_id: '',
  title: '',
  size_label: '',
  price: '',
  stock: '1',
  is_individual: true,
  description_override: '',
  avito_url: '',
  status: 'available',
  plant_name: '',
  botanical_name: '',
  cultivar: '',
  category_id: '',
  plant_description: '',
  care: ''
};

export default function App() {
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('Все растения');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

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
  const [adminOffers, setAdminOffers] = useState([]);
  const [adminPlants, setAdminPlants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [newPhotos, setNewPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');

  // Проверка прав администратора
  async function checkAdmin(user) {
    if (!user || !supabase) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase
      .from('app_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Ошибка проверки администратора:', error);
      setIsAdmin(false);
      return;
    }

    setIsAdmin(Boolean(data));
  }

  // Авторизация и восстановление пароля
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const currentSession = data.session;

      setSession(currentSession);

      if (currentSession?.user) {
        await checkAdmin(currentSession.user);
      }

      setAuthReady(true);
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

    return () => listener.subscription.unsubscribe();
  }, []);

  // Вход
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

    const { data: adminData, error: adminError } = await supabase
      .from('app_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (adminError || !adminData) {
      await supabase.auth.signOut();
      setAuthError('У этого аккаунта нет прав администратора.');
      setAuthLoading(false);
      return;
    }

    setSession(data.session);
    setIsAdmin(true);
    setLoginOpen(false);
    setPassword('');
    setAuthLoading(false);
  }

  // Запрос письма для сброса пароля
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
      {
        redirectTo: window.location.origin
      }
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

  // Сохранение нового пароля
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

  // Выход
  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setIsAdmin(false);
    setAdminOpen(false);
  }

  // Загрузка публичного каталога
  async function loadCatalog() {
    if (!supabase) {
      setOffers(demoPlants);
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
        .select(
          'id,title,size_label,price,stock,status,description_override,plants!inner(id,name,botanical_name,category_id,is_active,plant_categories(name)),offer_photos(storage_path,sort_order)'
        )
        .eq('status', 'available')
        .gt('stock', 0)
        .order('created_at', { ascending: false })
    ]);

    if (cats) {
      setCategories(cats);
    }

    if (error) {
      console.error(error);
      setOffers(demoPlants);
      setUsingDemo(true);
    } else {
      setUsingDemo(false);

      const mapped = (data || [])
        .filter(o => o.plants?.is_active)
        .map(o => ({
          id: o.id,
          name: o.title || o.plants?.name || 'Растение',
          botanical_name: o.plants?.botanical_name,
          category: o.plants?.plant_categories?.name || 'Прочие растения',
          price: o.price,
          stock: o.stock,
          status: o.status,
          description: o.description_override || '',
          photo: o.offer_photos
            ?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
            ?.storage_path
        }));

      setOffers(mapped);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  // Загрузка данных для админки
  async function loadAdminData() {
    if (!supabase) return;

    const [
      { data: plants, error: plantsError },
      { data: offersData, error: offersError }
    ] = await Promise.all([
      supabase
        .from('plants')
        .select('id,name,botanical_name,cultivar,category_id,description,care,is_active,plant_categories(name)')
        .order('created_at', { ascending: false }),

      supabase
        .from('plant_offers')
        .select('id,plant_id,title,size_label,price,stock,is_individual,status,description_override,avito_url,qr_code,plants(name,botanical_name),offer_photos(storage_path,sort_order)')
        .order('created_at', { ascending: false })
    ]);

    if (plantsError || offersError) {
      setAdminError(
        'Не удалось загрузить данные: ' +
        (plantsError?.message || offersError?.message)
      );
      return;
    }

    setAdminPlants(plants || []);
    setAdminOffers(offersData || []);
  }

  useEffect(() => {
    if (adminOpen && isAdmin) {
      loadAdminData();
    }
  }, [adminOpen, isAdmin]);

  // Новое предложение
  function startNew() {
    setEditingId(null);
    setForm(emptyForm);
    setNewPhotos([]);
    setAdminMessage('');
    setAdminError('');
  }

  // Редактирование предложения
  function startEdit(offer) {
    setEditingId(offer.id);

    setForm({
      ...emptyForm,
      plant_id: offer.plant_id || '',
      title: offer.title || '',
      size_label: offer.size_label || '',
      price: offer.price ?? '',
      stock: String(offer.stock ?? 1),
      is_individual: Boolean(offer.is_individual),
      description_override: offer.description_override || '',
      avito_url: offer.avito_url || '',
      status: offer.status || 'available'
    });

    setNewPhotos([]);
    setAdminMessage('');
    setAdminError('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Сохранение предложения и фотографий
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

    setSaving(true);

    try {
      let plantId = form.plant_id;

      // Если создаём новое растение
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
        title: form.title.trim() || null,
        size_label: form.size_label.trim() || null,
        price: Number(form.price),
        stock: form.is_individual
          ? 1
          : Math.max(0, Number(form.stock) || 0),
        is_individual: form.is_individual,
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

      // Загружаем фотографии
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
        editingId
          ? 'Изменения сохранены.'
          : 'Растение добавлено в каталог.'
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

  // Скрыть или вернуть предложение в каталог
  async function changeOfferStatus(offer, status) {
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

  const visible = useMemo(
    () =>
      offers.filter(p =>
        (category === 'Все растения' || p.category === category) &&
        `${p.name} ${p.botanical_name || ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [offers, category, query]
  );

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon"><Leaf size={21} /></span>
          <span>зелёная<span className="brand-light">комната</span></span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="top-note">Небольшая коллекция растений</span>

          {authReady && (
            isAdmin ? (
              <>
                <button
                  onClick={() => {
                    setAdminOpen(!adminOpen);
                    startNew();
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

            <button
              style={headerButton}
              onClick={() => setAdminOpen(false)}
            >
              <ArrowLeft size={15} /> В каталог
            </button>
          </div>

          <div style={adminPanel}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <h3 style={{ margin: 0 }}>
                {editingId ? 'Редактирование предложения' : 'Новое растение'}
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
                  <label style={fieldLabel}>
                    Существующее растение (если уже добавлял)
                  </label>

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
                        required={!form.plant_id}
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

              <div style={formGrid}>
                <div>
                  <label style={fieldLabel}>Название предложения</label>
                  <input
                    style={fieldInput}
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Можно оставить пустым"
                  />
                </div>

                <div>
                  <label style={fieldLabel}>Размер / описание экземпляра</label>
                  <input
                    style={fieldInput}
                    value={form.size_label}
                    onChange={e =>
                      setForm({ ...form, size_label: e.target.value })
                    }
                    placeholder="Например, 3 листа, горшок 9 см"
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
                    value={form.stock}
                    disabled={form.is_individual}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
              </div>

              <label style={{
                ...fieldLabel,
                display: 'flex',
                alignItems: 'center',
                gap: 9
              }}>
                <input
                  type="checkbox"
                  checked={form.is_individual}
                  onChange={e =>
                    setForm({
                      ...form,
                      is_individual: e.target.checked,
                      stock: e.target.checked ? '1' : form.stock
                    })
                  }
                />
                Это отдельный уникальный экземпляр
              </label>

              <label style={fieldLabel}>
                Описание именно этого предложения
              </label>
              <textarea
                style={fieldInput}
                rows="3"
                value={form.description_override}
                onChange={e =>
                  setForm({ ...form, description_override: e.target.value })
                }
                placeholder="Особенности конкретного растения"
              />

              <label style={fieldLabel}>
                Ссылка на Avito (необязательно)
              </label>
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

              <label style={fieldLabel}>Фотографии</label>
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

              <button
                type="submit"
                disabled={saving}
                style={submitButton}
              >
                <Save
                  size={16}
                  style={{ verticalAlign: 'middle', marginRight: 7 }}
                />
                {saving
                  ? 'Сохраняем…'
                  : editingId
                    ? 'Сохранить изменения'
                    : 'Добавить в каталог'}
              </button>
            </form>

            {adminError && <p style={errorText}>{adminError}</p>}
            {adminMessage && <p style={successText}>{adminMessage}</p>}
          </div>

          <div style={{ marginTop: 30 }}>
            <h3>Предложения в каталоге</h3>

            {adminOffers.length === 0 ? (
              <p className="empty">Пока нет предложений.</p>
            ) : (
              adminOffers.map(o => (
                <div key={o.id} style={offerRow}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{o.title || o.plants?.name || 'Растение'}</strong>

                    <div style={{
                      fontSize: 12,
                      color: '#788575',
                      marginTop: 4
                    }}>
                      {Number(o.price).toLocaleString('ru-RU')} ₽ · {o.stock} шт. · {
                        o.status === 'available' ? 'В наличии' :
                        o.status === 'sold' ? 'Продано' :
                        o.status === 'hidden' ? 'Скрыто' : 'Черновик'
                      }
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
        </main>
      ) : (
        <>
          <main>
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
                  <h2>Растения в наличии</h2>
                </div>

                <span className="count">{visible.length} позиций</span>
              </div>

              <div className="toolbar">
                <div className="search">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Найти растение..."
                  />
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
                  {visible.map(p => (
                    <article className="plant-card" key={p.id}>
                      <div className="plant-photo">
                        {p.photo && supabase ? (
                          <img
                            src={
                              supabase.storage
                                .from('plant-photos')
                                .getPublicUrl(p.photo).data.publicUrl
                            }
                            alt={p.name}
                          />
                        ) : (
                          <div className="photo-placeholder">
                            <Leaf size={42} />
                            <span>растение</span>
                          </div>
                        )}

                        <button className="heart" aria-label="В избранное">
                          <Heart size={18} />
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

                        <div className="card-bottom">
                          <strong>
                            {Number(p.price).toLocaleString('ru-RU')} ₽
                          </strong>

                          <span>
                            {p.stock > 1 ? `${p.stock} шт.` : '1 экземпляр'}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  Пока здесь нет растений. Они появятся после добавления в каталог.
                </div>
              )}
            </section>
          </main>

          <footer>
            © {new Date().getFullYear()} Зелёная комната
            <span>Выращено с заботой</span>
          </footer>
        </>
      )}

      {/* Создание нового пароля */}
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

              <button
                type="submit"
                disabled={authLoading}
                style={submitButton}
              >
                {authLoading ? 'Сохраняем…' : 'Сохранить пароль'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Вход и восстановление пароля */}
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

              <button
                type="submit"
                disabled={authLoading}
                style={submitButton}
              >
                {authLoading
                  ? 'Подожди…'
                  : resetEmailMode
                    ? 'Отправить письмо'
                    : 'Войти'}
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

const errorText = {
  color: '#b64b42',
  fontSize: 13
};

const successText = {
  color: '#405c43',
  fontSize: 13
};
