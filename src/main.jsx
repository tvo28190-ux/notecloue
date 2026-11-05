import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, ArrowLeft, Check, ChevronDown, Cloud, FileText, LogOut, Menu,
  MoreHorizontal, Pin, Plus, Search, Settings, ShieldCheck, Trash2, X,
  RotateCcw, PanelLeftClose, PanelLeftOpen, Smartphone, Laptop, Sparkles
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase';
import './style.css';

const VIEWS = [
  { id: 'all', label: 'Tất cả ghi chú', icon: FileText },
  { id: 'pinned', label: 'Đã ghim', icon: Pin },
  { id: 'archive', label: 'Lưu trữ', icon: Archive },
  { id: 'trash', label: 'Thùng rác', icon: Trash2 },
];

function formatDate(value) {
  if (!value) return 'Vừa xong';
  const date = new Date(value);
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function excerpt(content) {
  return (content || '').replace(/\s+/g, ' ').trim() || 'Chưa có nội dung';
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [view, setView] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const saveTimer = useRef(null);
  const pendingSaves = useRef(new Map());
  const toastTimer = useRef(null);

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const loadNotes = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingNotes(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) notify('Không tải được ghi chú: ' + error.message);
    else {
      setNotes(data || []);
      setSelectedId((current) => current && data?.some((note) => note.id === current) ? current : null);
    }
    setLoadingNotes(false);
  }, [session?.user?.id, notify]);

  useEffect(() => {
    if (session) loadNotes();
    else {
      setNotes([]);
      setSelectedId(null);
    }
  }, [session?.user?.id, loadNotes]);

  // Nhận thay đổi từ thiết bị khác khi cùng tài khoản đang mở ứng dụng.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return undefined;
    const channel = supabase
      .channel(`notes-sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) setNotes((current) => current.filter((note) => note.id !== deletedId));
          return;
        }
        const incoming = payload.new;
        if (!incoming?.id) return;
        setNotes((current) => current.some((note) => note.id === incoming.id)
          ? current.map((note) => note.id === incoming.id ? { ...note, ...incoming } : note)
          : [incoming, ...current]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return notes
      .filter((note) => {
        if (view === 'trash') return Boolean(note.deleted_at);
        if (note.deleted_at) return false;
        if (view === 'pinned') return note.is_pinned && !note.is_archived;
        if (view === 'archive') return note.is_archived;
        return !note.is_archived;
      })
      .filter((note) => !query || `${note.title} ${note.content}`.toLocaleLowerCase('vi').includes(query))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.updated_at) - new Date(a.updated_at));
  }, [notes, view, search]);

  const selectedNote = notes.find((note) => note.id === selectedId) || null;

  async function handleAuth(event) {
    event.preventDefault();
    if (!authEmail.trim() || authPassword.length < 6) {
      setAuthMessage('Nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.');
      return;
    }
    setAuthBusy(true);
    setAuthMessage('');
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
      : await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
    setAuthBusy(false);
    if (result.error) setAuthMessage(result.error.message);
    else if (authMode === 'signup' && !result.data.session) {
      setAuthMessage('Tài khoản đã được tạo. Hãy mở email để xác nhận, sau đó đăng nhập.');
      setAuthMode('login');
    } else {
      setAuthMessage('');
      setAuthPassword('');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setView('all');
    notify('Đã đăng xuất');
  }

  async function createNote() {
    if (!session?.user?.id) return;
    const { data, error } = await supabase.from('notes').insert({
      user_id: session.user.id,
      title: '',
      content: '',
    }).select().single();
    if (error) return notify('Không tạo được ghi chú: ' + error.message);
    setNotes((current) => [data, ...current]);
    setView('all');
    setSearch('');
    setSelectedId(data.id);
    setMobileListOpen(false);
  }

  function queueSave(id, patch) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, ...patch, updated_at: new Date().toISOString() } : note));
    const queuedPatch = pendingSaves.current.get(id) || {};
    pendingSaves.current.set(id, { ...queuedPatch, ...patch });
    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      const batch = Array.from(pendingSaves.current.entries());
      pendingSaves.current.clear();
      const results = await Promise.all(batch.map(([noteId, changes]) => supabase.from('notes').update(changes).eq('id', noteId)));
      const failed = results.find((result) => result.error)?.error;
      setSaving(pendingSaves.current.size > 0);
      if (failed) notify('Lưu thất bại: ' + failed.message);
    }, 650);
  }

  async function updateImmediate(id, patch) {
    const queuedPatch = pendingSaves.current.get(id) || {};
    pendingSaves.current.delete(id);
    patch = { ...queuedPatch, ...patch };
    const previous = notes.find((note) => note.id === id);
    setNotes((current) => current.map((note) => note.id === id ? { ...note, ...patch, updated_at: new Date().toISOString() } : note));
    const { error } = await supabase.from('notes').update(patch).eq('id', id);
    if (error) {
      if (previous) setNotes((current) => current.map((note) => note.id === id ? previous : note));
      notify('Thao tác thất bại: ' + error.message);
    }
  }

  async function moveToTrash(note) {
    await updateImmediate(note.id, { deleted_at: new Date().toISOString(), is_pinned: false });
    setSelectedId(null);
    setMobileListOpen(true);
    notify('Đã chuyển vào thùng rác');
  }

  async function restoreNote(note) {
    await updateImmediate(note.id, { deleted_at: null });
    notify('Đã khôi phục ghi chú');
  }

  async function permanentlyDelete(note) {
    const { error } = await supabase.from('notes').delete().eq('id', note.id);
    if (error) notify('Không xóa được: ' + error.message);
    else {
      setNotes((current) => current.filter((item) => item.id !== note.id));
      setSelectedId(null);
      notify('Đã xóa vĩnh viễn');
    }
  }

  function chooseView(nextView) {
    setView(nextView);
    setSelectedId(null);
    setSearch('');
    setMobileListOpen(true);
  }

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  if (!authReady) return <div className="boot-screen"><div className="brand-mark"><FileText size={23} /></div><span>Đang mở NoteCloud…</span></div>;

  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  if (!session) {
    return (
      <div className="auth-layout">
        <div className="auth-visual">
          <div className="visual-top"><div className="brand"><span className="brand-mark"><FileText size={20} /></span> notecloud</div><span className="visual-label">YOUR SPACE, EVERYWHERE</span></div>
          <div className="visual-copy">
            <div className="visual-orbit orbit-one"></div><div className="visual-orbit orbit-two"></div>
            <div className="floating-note note-one"><span className="note-dot"></span><b>Ý tưởng mới</b><small>Đừng quên ghi lại nhé</small></div>
            <div className="floating-note note-two"><Pin size={14} /><b>Kế hoạch tuần</b><small>5 việc cần hoàn thành</small></div>
            <div className="visual-title">Ý tưởng ở lại.<br /><em>Bạn tự do di chuyển.</em></div>
            <p>Một nơi nhỏ để lưu giữ những điều quan trọng — đồng bộ trên mọi thiết bị.</p>
          </div>
          <div className="visual-footer"><span><ShieldCheck size={14} /> Riêng tư theo tài khoản</span><span>Được tạo cho những ngày bận rộn</span></div>
        </div>
        <main className="auth-panel">
          <div className="auth-mobile-brand"><span className="brand-mark"><FileText size={20} /></span> notecloud</div>
          <div className="auth-form-wrap">
            <div className="auth-eyebrow">CHÀO MỪNG BẠN</div>
            <h1>{authMode === 'login' ? 'Rất vui được gặp lại.' : 'Tạo không gian của bạn.'}</h1>
            <p className="auth-subtitle">{authMode === 'login' ? 'Đăng nhập để tiếp tục với những ghi chú của bạn.' : 'Chỉ vài bước đơn giản để bắt đầu lưu lại ý tưởng.'}</p>
            <form onSubmit={handleAuth} className="auth-form">
              <label>Email của bạn</label>
              <input type="email" autoComplete="email" placeholder="ban@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
              <div className="password-label"><label>Mật khẩu</label>{authMode === 'login' && <span>Tối thiểu 6 ký tự</span>}</div>
              <input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Nhập mật khẩu" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required minLength={6} />
              {authMessage && <div className="auth-message">{authMessage}</div>}
              <button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? 'Đang xử lý…' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <span>→</span></button>
            </form>
            <div className="auth-switch">{authMode === 'login' ? 'Bạn chưa có tài khoản?' : 'Bạn đã có tài khoản?'} <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}>{authMode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></div>
            <div className="auth-trust"><ShieldCheck size={15} /> Ghi chú của bạn được bảo vệ riêng theo tài khoản.</div>
          </div>
          <div className="auth-bottom">NOTE TO SELF · NOTE TO LIFE</div>
        </main>
      </div>
    );
  }

  const viewTitle = VIEWS.find((item) => item.id === view)?.label || 'Ghi chú';

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
        <div className="sidebar-brand"><div className="brand"><span className="brand-mark"><FileText size={19} /></span> notecloud</div><button className="icon-button hide-sidebar" title="Thu gọn thanh bên" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={18} /></button></div>
        <button className="new-note-button" onClick={createNote}><Plus size={17} /> Ghi chú mới <span>⌘ N</span></button>
        <div className="nav-caption">KHÔNG GIAN CỦA BẠN</div>
        <nav className="main-nav">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const count = id === 'all' ? notes.filter((n) => !n.deleted_at && !n.is_archived).length : id === 'pinned' ? notes.filter((n) => !n.deleted_at && n.is_pinned && !n.is_archived).length : id === 'archive' ? notes.filter((n) => !n.deleted_at && n.is_archived).length : notes.filter((n) => n.deleted_at).length;
            return <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => chooseView(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span><small>{count || ''}</small></button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-card"><div className="sync-icon"><Cloud size={16} /></div><div><b>Đã đồng bộ</b><span>Ghi chú trên mọi thiết bị</span></div><span className="sync-dot"></span></div>
          {installPrompt && <button className="install-link" onClick={installApp}><Smartphone size={16} /> Cài NoteCloud</button>}
          <div className="account-row">
            <div className="avatar">{session.user.email?.[0]?.toUpperCase() || 'N'}</div>
            <div className="account-info"><b>{session.user.email?.split('@')[0]}</b><span>{session.user.email}</span></div>
            <div className="account-menu-wrap"><button className="icon-button account-menu-btn" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={19} /></button>{menuOpen && <div className="account-popover"><div className="popover-email">{session.user.email}</div><button onClick={signOut}><LogOut size={15} /> Đăng xuất</button></div>}</div>
          </div>
        </div>
      </aside>
      {!sidebarOpen && <button className="restore-sidebar icon-button" onClick={() => setSidebarOpen(true)} title="Mở thanh bên"><PanelLeftOpen size={19} /></button>}

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={19} /></button><span className="breadcrumb">Không gian của bạn</span><span className="crumb-slash">/</span><b>{viewTitle}</b></div>
          <div className="topbar-right"><div className="search-box"><Search size={16} /><input placeholder="Tìm trong ghi chú…" value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>⌘ K</kbd></div><span className="online-indicator"><i></i> Trực tuyến</span></div>
        </header>
        <div className={`content-layout ${!mobileListOpen ? 'editor-focused' : ''}`}>
          <section className={`notes-pane ${!mobileListOpen ? 'mobile-hidden' : ''}`}>
            <div className="list-heading"><div><div className="section-kicker">NOTEBOOK</div><h1>{viewTitle}</h1><p>{view === 'trash' ? 'Những ghi chú bạn đã xóa.' : 'Gom những dòng suy nghĩ vào một nơi.'}</p></div><button className="round-add" onClick={createNote} title="Tạo ghi chú"><Plus size={19} /></button></div>
            <div className="list-meta"><span>{visibleNotes.length} ghi chú</span><span>Sắp xếp: Mới cập nhật <ChevronDown size={13} /></span></div>
            <div className="note-list">
              {loadingNotes ? <div className="list-loading"><span className="spinner"></span> Đang tải ghi chú…</div> : visibleNotes.length === 0 ? (
                <div className="empty-list"><div className="empty-illustration"><FileText size={26} /></div><b>{search ? 'Không tìm thấy ghi chú' : view === 'trash' ? 'Thùng rác đang trống' : 'Bắt đầu với một ghi chú'}</b><p>{search ? 'Thử một từ khóa khác nhé.' : 'Viết xuống một ý tưởng, việc cần làm hoặc điều bạn muốn nhớ.'}</p>{view !== 'trash' && !search && <button onClick={createNote}><Plus size={15} /> Tạo ghi chú đầu tiên</button>}</div>
              ) : visibleNotes.map((note) => (
                <button key={note.id} className={`note-card ${selectedId === note.id ? 'selected' : ''}`} onClick={() => { setSelectedId(note.id); setMobileListOpen(false); }}>
                  <div className="note-card-top"><span className="note-date">{formatDate(note.updated_at)}</span><span className="note-card-icons">{note.is_pinned && <Pin size={13} fill="currentColor" />}{note.is_archived && <Archive size={13} />}</span></div>
                  <h3>{note.title.trim() || 'Ghi chú không có tiêu đề'}</h3>
                  <p>{excerpt(note.content)}</p>
                  <div className="note-card-bottom"><span className="note-category-dot"></span><span>{note.deleted_at ? 'Trong thùng rác' : note.is_archived ? 'Đã lưu trữ' : 'Ghi chú'}</span><span className="word-count">{(note.content || '').trim() ? note.content.trim().split(/\s+/).length + ' từ' : 'Trống'}</span></div>
                </button>
              ))}
            </div>
            <div className="list-footer"><Sparkles size={13} /> Một ý tưởng nhỏ cũng đáng được lưu lại.</div>
          </section>

          <section className={`editor-pane ${mobileListOpen ? 'mobile-hidden' : ''}`}>
            {selectedNote ? (
              <>
                <div className="editor-toolbar"><div className="editor-toolbar-left"><button className="icon-button back-to-list" onClick={() => setMobileListOpen(true)}><ArrowLeft size={18} /></button><span className="editor-status">{saving ? <><span className="saving-dot"></span> Đang lưu…</> : <><Check size={13} /> Đã lưu</>}</span></div><div className="editor-actions">
                  {selectedNote.deleted_at ? <button className="toolbar-button" onClick={() => restoreNote(selectedNote)}><RotateCcw size={16} /><span>Khôi phục</span></button> : <>
                    <button className={`toolbar-button ${selectedNote.is_pinned ? 'tool-active' : ''}`} onClick={() => updateImmediate(selectedNote.id, { is_pinned: !selectedNote.is_pinned })}><Pin size={16} /><span>{selectedNote.is_pinned ? 'Bỏ ghim' : 'Ghim'}</span></button>
                    <button className="toolbar-button" onClick={() => { updateImmediate(selectedNote.id, { is_archived: !selectedNote.is_archived }); setSelectedId(null); setMobileListOpen(true); }}><Archive size={16} /><span>{selectedNote.is_archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</span></button>
                  </>}
                  <div className="more-wrap"><button className="icon-button" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={19} /></button>{menuOpen && <div className="account-popover note-popover"><button className="danger-action" onClick={() => { setMenuOpen(false); selectedNote.deleted_at ? permanentlyDelete(selectedNote) : moveToTrash(selectedNote); }}>{selectedNote.deleted_at ? <Trash2 size={15} /> : <Trash2 size={15} />}{selectedNote.deleted_at ? 'Xóa vĩnh viễn' : 'Chuyển vào thùng rác'}</button></div>}</div>
                </div></div>
                <div className="editor-document"><div className="document-meta"><span>{selectedNote.created_at ? 'TẠO NGÀY ' + new Date(selectedNote.created_at).toLocaleDateString('vi-VN') : 'GHI CHÚ MỚI'}</span><span className="meta-divider"></span><span>{(selectedNote.content || '').trim() ? selectedNote.content.trim().split(/\s+/).length + ' TỪ' : 'CHƯA CÓ NỘI DUNG'}</span></div>
                  <input className="title-input" placeholder="Tiêu đề ghi chú" value={selectedNote.title} onChange={(e) => queueSave(selectedNote.id, { title: e.target.value })} disabled={Boolean(selectedNote.deleted_at)} />
                  <textarea className="content-input" placeholder="Bắt đầu viết những điều bạn muốn nhớ…\n\nKhông cần hoàn hảo. Cứ viết ra đã." value={selectedNote.content} onChange={(e) => queueSave(selectedNote.id, { content: e.target.value })} disabled={Boolean(selectedNote.deleted_at)} />
                  <div className="editor-bottom-note"><span>NHỮNG DÒNG SUY NGHĨ CỦA BẠN</span><span>NOTE TO SELF ✳</span></div>
                </div>
              </>
            ) : (
              <div className="editor-welcome"><div className="welcome-art"><div className="welcome-paper"><span></span><span></span><span></span><i></i></div><div className="welcome-spark spark-a">✳</div><div className="welcome-spark spark-b">✦</div></div><div className="welcome-kicker">YOUR QUIET CORNER</div><h2>Một khoảng trống<br /><em>để nghĩ và viết.</em></h2><p>Chọn một ghi chú để tiếp tục, hoặc tạo một ghi chú mới để bắt đầu.</p><button className="primary-button welcome-button" onClick={createNote}><Plus size={16} /> Tạo ghi chú mới</button><div className="device-hint"><Laptop size={15} /> <span>Máy tính</span><span className="hint-dot">·</span><Smartphone size={15} /><span>Điện thoại</span></div></div>
            )}
          </section>
        </div>
      </main>
      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
      {menuOpen && <button className="click-catcher" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}></button>}
    </div>
  );
}

function SetupScreen() {
  return <div className="setup-screen"><div className="setup-card"><div className="brand"><span className="brand-mark"><FileText size={20} /></span> notecloud</div><div className="setup-icon"><Settings size={25} /></div><h1>Cần kết nối cơ sở dữ liệu</h1><p>Ứng dụng đã sẵn sàng. Hãy cấu hình Supabase để bật đăng ký, đăng nhập và đồng bộ ghi chú giữa các thiết bị.</p><ol><li>Mở file <code>.env.example</code> và điền URL cùng anon key từ Supabase.</li><li>Lưu thành file <code>.env</code> trong thư mục dự án.</li><li>Chạy file <code>supabase-schema.sql</code> trong SQL Editor của Supabase.</li><li>Khởi động lại ứng dụng bằng <code>npm run dev</code>.</li></ol><div className="setup-note"><ShieldCheck size={17} /> Không đưa service_role key vào ứng dụng. Chỉ dùng anon/publishable key.</div></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
