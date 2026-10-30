
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Leaf, Heart, SlidersHorizontal, Sprout, Lock, LogOut, X
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
    status: 'available',
    description: 'Компактная алоказия с выразительной листвой.'
  },
  {
    id: 'demo-2',
    name: 'Замиокулькас Блэк',
    botanical_name: 'Zamioculcas zamiifolia',
    category: 'Замиокулькасы',
    price: 900,
    stock: 2,
    status: 'available',
    description: 'Неприхотливое растение с тёмными листьями.'
  },
  {
    id: 'demo-3',
    name: 'Алоказия Полли',
    botanical_name: 'Alocasia × amazonica',
    category: 'Алоказии',
    price: 1500,
    stock: 1,
    status: 'available',
    description: 'Контрастные листья с выразительными прожилками.'
  },
];

export default function App() {
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([
    'Все растения',
    'Алоказии',
    'Замиокулькасы',
    'Аглаонемы',
    'Папоротники',
    'Фикусы',
    'Сингониумы',
    'Прочие растения'
  ]);

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

  // Проверка авторизации и обработка ссылок Supabase
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

  // Вход администратора
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
      password,
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
        redirectTo: window.location.origin,
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
      password: newPassword,
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

  // Выход из аккаунта
  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setIsAdmin(false);
  }

  // Загрузка каталога
  useEffect(() => {
    let alive = true;

    async function load() {
      if (!supabase) {
        if (alive) {
          setOffers(demoPlants);
          setUsingDemo(true);
          setLoading(false);
        }
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
          .order('created_at', { ascending: false }),
      ]);

      if (!alive) return;

      if (cats?.length) {
        setCategories(['Все растения', ...cats.map(c => c.name)]);
      }

      if (error) {
        console.error(error);
        setOffers(demoPlants);
        setUsingDemo(true);
      } else {
        const mapped = (data || [])
          .filter(o => o.plants?.is_active)
          .map(o => ({
            id: o.id,
            name: o.title || o.plants?.name || 'Растение',
            botanical_name: o.plants?.botanical_name,
            category:
              o.plants?.plant_categories?.name || 'Прочие растения',
            price: o.price,
            stock: o.stock,
            status: o.status,
            description: o.description_override || '',
            photo: o.offer_photos
              ?.sort((a, b) => a.sort_order - b.sort_order)?.[0]
              ?.storage_path,
          }));

        setOffers(mapped);
      }

      setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

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
          <span className="brand-icon">
            <Leaf size={21} />
          </span>
          <span>
            зелёная<span className="brand-light">комната</span>
          </span>
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="top-note">
            Небольшая коллекция растений
          </span>

          {authReady && (
            isAdmin ? (
              <button onClick={handleLogout} style={headerButton}>
                <LogOut size={15} /> Выйти
              </button>
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

            <span className="count">
              {visible.length} позиций
            </span>
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
            {categories.map(c => (
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

      {/* Форма создания нового пароля */}
      {recoveryMode && (
        <div style={modalBackdrop}>
          <div style={modalBox}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                className="brand-icon"
                style={{ margin: '0 auto 12px' }}
              >
                <Leaf size={22} />
              </div>

              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 500,
                  margin: 0
                }}
              >
                Новый пароль
              </h2>

              <p style={{ color: '#7c8678', fontSize: 13 }}>
                Придумай новый пароль для входа
              </p>
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

              {authError && (
                <p style={{ color: '#b64b42', fontSize: 12 }}>
                  {authError}
                </p>
              )}

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

      {/* Окно входа и запроса письма */}
      {loginOpen && (
        <div
          style={modalBackdrop}
          onClick={() => {
            setLoginOpen(false);
            setResetEmailMode(false);
          }}
        >
          <div
            style={modalBox}
            onClick={e => e.stopPropagation()}
          >
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
              <div
                className="brand-icon"
                style={{ margin: '0 auto 12px' }}
              >
                <Leaf size={22} />
              </div>

              <h2
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 500,
                  margin: 0
                }}
              >
                {resetEmailMode
                  ? 'Восстановление пароля'
                  : 'Вход администратора'}
              </h2>

              <p style={{ color: '#7c8678', fontSize: 13 }}>
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
              <label style={fieldLabel}>
                Электронная почта
              </label>

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

              {authError && (
                <p style={{ color: '#b64b42', fontSize: 12 }}>
                  {authError}
                </p>
              )}

              {authMessage && (
                <p style={{ color: '#405c43', fontSize: 12 }}>
                  {authMessage}
                </p>
              )}

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
  fontSize: 12,
};

const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: '#17231999',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
};

const modalBox = {
  position: 'relative',
  width: '100%',
  maxWidth: 390,
  padding: 30,
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 20px 60px #0003',
};

const closeButton = {
  position: 'absolute',
  top: 12,
  right: 12,
  border: 0,
  background: 'transparent',
  color: '#788575',
  cursor: 'pointer',
};

const fieldLabel = {
  display: 'block',
  margin: '15px 0 7px',
  fontSize: 12,
  color: '#52634f',
};

const fieldInput = {
  width: '100%',
  padding: '12px',
  border: '1px solid #dfe4d9',
  borderRadius: 5,
  font: 'inherit',
  fontSize: 14,
  outlineColor: '#718b65',
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
  cursor: 'pointer',
};

const textButton = {
  border: 0,
  background: 'transparent',
  color: '#405c43',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  textDecoration: 'underline',
};
