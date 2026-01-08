import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Search, Heart, Check, Plus, X, Settings, Loader2, Camera, RotateCw, Maximize2, Filter, Trash2, Edit3, Save, Sparkles } from 'lucide-react';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const CLOUDINARY_NAME = "dkedelokp"; 
const CLOUDINARY_PRESET = "zb1_uploads"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MEMBERS = [
  { id: 'hanbin', name: 'Sung Han Bin' }, 
  { id: 'jiwoong', name: 'Kim Ji Woong' },
  { id: 'zhanghao', name: 'Zhang Hao' }, 
  { id: 'matthew', name: 'Seok Matthew' },
  { id: 'taerae', name: 'Kim Tae Rae' }, 
  { id: 'ricky', name: 'Ricky' },
  { id: 'gyuvin', name: 'Kim Gyu Vin' }, 
  { id: 'gunwook', name: 'Park Gun Wook' },
  { id: 'yujin', name: 'Han Yu Jin' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [userData, setUserData] = useState({ collected: [], wishlist: [] });
  const [loading, setLoading] = useState(true);
  
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminModalMode, setAdminModalMode] = useState(null); 
  const [editingCard, setEditingCard] = useState(null);
  const [status, setStatus] = useState('');
  const [fullscreenCard, setFullscreenCard] = useState(null);
  const [activeFilters, setActiveFilters] = useState({ memberId: 'all', album: 'all', type: 'all', search: '' });
  const [previews, setPreviews] = useState({ front: null, back: null });

  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'cards'), orderBy('createdAt', 'desc'));
    const unsubCards = onSnapshot(q, (s) => {
      setCards(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (s) => {
      if (s.exists()) setUserData(s.data());
    });
    return () => { unsubCards(); unsubUser(); };
  }, [user]);

  const uniqueAlbums = useMemo(() => ['all', ...new Set(cards.map(c => c.album).filter(Boolean))], [cards]);
  const uniqueTypes = useMemo(() => ['all', ...new Set(cards.map(c => c.type).filter(Boolean))], [cards]);

  const handleFilePreview = (e, side) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviews(prev => ({ ...prev, [side]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    return data.secure_url;
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processing...');
    const form = e.target;
    try {
      let frontUrl = editingCard?.imageUrl || null;
      let backUrl = editingCard?.imageUrlBack || null;

      if (form.frontPhoto.files[0]) frontUrl = await uploadToCloudinary(form.frontPhoto.files[0]);
      if (form.backPhoto.files[0]) backUrl = await uploadToCloudinary(form.backPhoto.files[0]);

      const cardData = {
        memberId: form.member.value,
        memberName: MEMBERS.find(m => m.id === form.member.value).name,
        album: form.album.value,
        type: form.type.value,
        imageUrl: frontUrl,
        imageUrlBack: backUrl,
      };

      if (adminModalMode === 'add') {
        await addDoc(collection(db, 'cards'), { ...cardData, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'cards', editingCard.id), cardData);
      }

      setPreviews({ front: null, back: null });
      setAdminModalMode(null);
      setEditingCard(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setStatus('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this photocard forever?")) return;
    try {
      await deleteDoc(doc(db, 'cards', editingCard.id));
      setAdminModalMode(null);
    } catch (err) { alert(err.message); }
  };

  const toggleUserStatus = async (key, id) => {
    const list = userData[key] || [];
    const newList = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
    await setDoc(doc(db, 'users', user.uid), { ...userData, [key]: newList });
  };

  const filteredCards = cards.filter(c => {
    const mMem = activeFilters.memberId === 'all' || c.memberId === activeFilters.memberId;
    const mAlb = activeFilters.album === 'all' || c.album === activeFilters.album;
    const mTyp = activeFilters.type === 'all' || c.type === activeFilters.type;
    const mSrc = (c.memberName + (c.type||'') + (c.album||'')).toLowerCase().includes(activeFilters.search.toLowerCase());
    return mMem && mAlb && mTyp && mSrc;
  });

  if (loading) return <div className="h-screen flex items-center justify-center bg-sky-50"><Loader2 className="animate-spin text-sky-400 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-sky-50/20 pb-20 font-sans text-slate-700">
      
      {/* Pastel Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-sky-100 sticky top-0 z-40 px-4 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-400 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-sky-100">Z</div>
          <h1 className="font-black text-xs tracking-widest text-sky-900 uppercase">Archive.ONE</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsAdminMode(!isAdminMode)} 
             className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isAdminMode ? 'bg-sky-500 text-white' : 'bg-white text-sky-300 border border-sky-50'}`}
           >
             <Settings className="w-4 h-4" />
           </button>
           {isAdminMode && (
              <button 
                onClick={() => { setAdminModalMode('add'); setEditingCard(null); setPreviews({ front: null, back: null }); }} 
                className="w-9 h-9 bg-white text-sky-500 rounded-xl shadow-sm border border-sky-50 hover:bg-sky-500 hover:text-white transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
           )}
        </div>
      </header>

      {/* SEARCH & FILTERS */}
      <div className="sticky top-[65px] z-30 px-4 py-4 bg-gradient-to-b from-white to-transparent">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-300 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              value={activeFilters.search}
              onChange={(e) => setActiveFilters({...activeFilters, search: e.target.value})}
              className="w-full pl-11 pr-12 py-3.5 rounded-2xl border-none bg-white shadow-xl shadow-sky-900/5 outline-none focus:ring-2 focus:ring-sky-200 font-medium text-sm placeholder:text-sky-200"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
            <FilterPill active={activeFilters.memberId === 'all'} onClick={() => setActiveFilters({...activeFilters, memberId: 'all'})} label="ALL MEMBERS" />
            {MEMBERS.map(m => (
              <FilterPill 
                key={m.id} 
                active={activeFilters.memberId === m.id} 
                onClick={() => setActiveFilters({...activeFilters, memberId: m.id})} 
                label={m.name.toUpperCase()} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {adminModalMode && <AdminModal mode={adminModalMode} status={status} MEMBERS={MEMBERS} onSubmit={handleAdminSubmit} onDelete={handleDelete} onClose={() => setAdminModalMode(null)} previews={previews} onPreview={handleFilePreview} editingCard={editingCard} />}
      {fullscreenCard && <FullscreenModal card={fullscreenCard} onClose={() => setFullscreenCard(null)} isCollected={userData.collected?.includes(fullscreenCard.id)} onToggleStatus={toggleUserStatus} />}

      {/* MAIN GALLERY */}
      <main className="max-w-7xl mx-auto px-4 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-8">
          {filteredCards.map(card => (
            <Photocard 
              key={card.id} 
              card={card} 
              isAdminMode={isAdminMode}
              isCollected={userData.collected?.includes(card.id)}
              isWishlist={userData.wishlist?.includes(card.id)}
              onToggleStatus={toggleUserStatus}
              onFullscreen={() => setFullscreenCard(card)}
              onEdit={() => {
                setEditingCard(card);
                setAdminModalMode('edit');
                setPreviews({ front: card.imageUrl, back: card.imageUrlBack });
              }}
            />
          ))}
        </div>

        {filteredCards.length === 0 && (
           <div className="py-32 text-center">
              <Sparkles className="w-10 h-10 text-sky-100 mx-auto mb-4" />
              <h2 className="text-sm font-bold text-sky-900 opacity-40 uppercase tracking-widest">No matching results</h2>
           </div>
        )}
      </main>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// --- HELPER COMPONENTS ---

function FilterPill({ active, onClick, label }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-[9px] font-black tracking-[0.1em] transition-all border whitespace-nowrap ${
        active 
        ? 'bg-sky-400 text-white border-sky-400 shadow-lg shadow-sky-100' 
        : 'bg-white text-sky-300 border-sky-50'
      }`}
    >
      {label}
    </button>
  );
}

function Photocard({ card, isCollected, isWishlist, onToggleStatus, onFullscreen, isAdminMode, onEdit }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="group flex flex-col animate-in fade-in zoom-in duration-300">
      <div className="perspective-1000 w-full mb-4">
        <div 
          className={`relative aspect-[5.5/8.5] w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => card.imageUrlBack && setIsFlipped(!isFlipped)}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden bg-white shadow-xl shadow-sky-900/5 border border-white">
            <img src={card.imageUrl} className="w-full h-full object-cover" loading="lazy" />
            
            <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
               {isAdminMode && (
                 <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-8 h-8 flex items-center justify-center bg-sky-500 text-white rounded-lg shadow-lg"><Edit3 className="w-3.5 h-3.5" /></button>
               )}
               <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="w-8 h-8 flex items-center justify-center bg-white/90 text-sky-500 rounded-lg shadow-lg"><Maximize2 className="w-3.5 h-3.5" /></button>
            </div>

            {isCollected && (
              <div className="absolute inset-0 bg-sky-400/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <div className="bg-white p-2.5 rounded-full shadow-xl"><Check className="text-sky-400 w-5 h-5 stroke-[3.5px]" /></div>
              </div>
            )}
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl overflow-hidden bg-sky-50 shadow-lg border border-white">
            <img src={card.imageUrlBack || card.imageUrl} className="w-full h-full object-cover grayscale-[0.4]" />
          </div>
        </div>
      </div>

      <div className="px-1 text-center">
        <div className="flex justify-between items-start gap-1 mb-1">
           <h3 className="font-bold text-slate-800 text-[11px] sm:text-xs truncate">{card.memberName}</h3>
           <button onClick={() => onToggleStatus('wishlist', card.id)} className="shrink-0">
             <Heart className={`w-3.5 h-3.5 transition-all ${isWishlist ? 'fill-rose-400 text-rose-400' : 'text-sky-100'}`} />
           </button>
        </div>
        <p className="text-[9px] text-sky-200 font-bold uppercase truncate mb-3 tracking-tighter">{card.album} • {card.type}</p>
        <button 
          onClick={() => onToggleStatus('collected', card.id)} 
          className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            isCollected 
            ? 'bg-sky-50 text-sky-400 border border-sky-100' 
            : 'bg-slate-900 text-white'
          }`}
        >
          {isCollected ? 'IN ARCHIVE' : 'I OWN THIS'}
        </button>
      </div>
    </div>
  );
}

function AdminModal({ mode, status, MEMBERS, onSubmit, onDelete, onClose, previews, onPreview, editingCard }) {
  return (
    <div className="fixed inset-0 z-50 bg-sky-900/30 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-3xl p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-black text-sky-900 tracking-tighter">{mode === 'add' ? 'New Photocard' : 'Edit Details'}</h2>
          <button onClick={onClose} className="p-2.5 bg-sky-50 text-sky-400 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-10">
          <div className="grid grid-cols-2 gap-4 sm:gap-8">
            {['front', 'back'].map(side => (
              <div key={side} className="space-y-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-sky-200 text-center block">{side}</span>
                <div className="relative aspect-[5.5/8.5] bg-sky-50/50 border-2 border-dashed border-sky-100 rounded-2xl flex items-center justify-center overflow-hidden hover:border-sky-300 transition-colors cursor-pointer">
                  {previews[side] ? <img src={previews[side]} className="w-full h-full object-cover" /> : <Camera className="text-sky-100 w-8 h-8" />}
                  <input type="file" name={`${side}Photo`} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => onPreview(e, side)} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-5">
             <div><label className="text-[9px] font-black uppercase text-sky-200 mb-2 block ml-1">Assigned Member</label><select name="member" defaultValue={editingCard?.memberId || MEMBERS[0].id} className="w-full p-4 bg-sky-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-sky-100">{MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
             <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[9px] font-black uppercase text-sky-200 mb-2 block ml-1">Album Era</label><input name="album" defaultValue={editingCard?.album || ''} placeholder="e.g. Cinema" className="w-full p-4 bg-sky-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-sky-100" required /></div>
                <div><label className="text-[9px] font-black uppercase text-sky-200 mb-2 block ml-1">Specific Version</label><input name="type" defaultValue={editingCard?.type || ''} placeholder="e.g. Lucky" className="w-full p-4 bg-sky-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-sky-100" required /></div>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            {mode === 'edit' && <button type="button" onClick={onDelete} disabled={!!status} className="w-full sm:flex-1 py-4.5 bg-rose-50 text-rose-400 rounded-2xl font-black text-[10px] tracking-widest uppercase">Delete Card</button>}
            <button type="submit" disabled={!!status} className="w-full sm:flex-[2] py-4.5 bg-sky-500 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-xl shadow-sky-100 flex items-center justify-center gap-2">
              {status ? <Loader2 className="animate-spin w-4 h-4" /> : (mode === 'add' ? 'Confirm Addition' : 'Save Update')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FullscreenModal({ card, onClose, isCollected, onToggleStatus }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 overflow-y-auto">
      <button onClick={onClose} className="fixed top-6 right-6 p-3 bg-sky-50 text-sky-400 rounded-full z-[110] shadow-sm"><X /></button>
      
      <div className="w-full max-w-[320px] sm:max-w-[440px] mb-8 mt-12 shrink-0">
        <div className="perspective-1000 w-full">
          <div 
            className={`relative aspect-[5.5/8.5] w-full transition-transform duration-1000 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
            onClick={() => card.imageUrlBack && setIsFlipped(!isFlipped)}
          >
            <div className="absolute inset-0 backface-hidden rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-4 border-white">
              <img src={card.imageUrl} className="w-full h-full object-cover" />
              {isCollected && <div className="absolute top-6 right-6 bg-sky-400 text-white p-3 rounded-2xl shadow-xl"><Check className="w-6 h-6 stroke-[4.5px]" /></div>}
            </div>
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[2.5rem] overflow-hidden bg-sky-50 shadow-2xl border-4 border-white">
              <img src={card.imageUrlBack || card.imageUrl} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center space-y-6 max-w-sm w-full pb-10">
        <h2 className="text-4xl font-black text-sky-900 tracking-tighter">{card.memberName}</h2>
        <div className="flex gap-2 justify-center">
          <span className="px-5 py-2 bg-sky-50 text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest">{card.album}</span>
          <span className="px-5 py-2 bg-sky-50 text-sky-400 rounded-full text-[10px] font-black uppercase tracking-widest">{card.type}</span>
        </div>
        <button 
          onClick={() => onToggleStatus('collected', card.id)}
          className={`w-full py-5 rounded-[2rem] font-black text-xs tracking-[0.1em] shadow-xl transition-all active:scale-95 ${
            isCollected ? 'bg-sky-400 text-white shadow-sky-100' : 'bg-slate-900 text-white'
          }`}
        >
          {isCollected ? 'IN COLLECTION' : 'MARK AS COLLECTED'}
        </button>
        {card.imageUrlBack && (
          <p className="flex items-center justify-center gap-2 text-[10px] font-black text-sky-200 uppercase tracking-widest">
            <RotateCw className="w-3.5 h-3.5" /> Tap card to see back
          </p>
        )}
      </div>
    </div>
  );
}

