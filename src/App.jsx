import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Search, Heart, Check, Plus, X, Settings, Loader2, Camera, RotateCw, Maximize2, Filter, Trash2, Edit3, Save, Sparkles, Users } from 'lucide-react';

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
  
  const [activeFilters, setActiveFilters] = useState({ memberIds: [], album: 'all', type: 'all', search: '' });
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

  const handleAdminSubmit = async (e, selectedMemberIds) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) return alert("Please select at least one member.");
    
    setStatus('Archiving...');
    const form = e.target;
    try {
      let frontUrl = editingCard?.imageUrl || null;
      let backUrl = editingCard?.imageUrlBack || null;

      if (form.frontPhoto.files[0]) frontUrl = await uploadToCloudinary(form.frontPhoto.files[0]);
      if (form.backPhoto.files[0]) backUrl = await uploadToCloudinary(form.backPhoto.files[0]);

      const selectedMemberObjects = MEMBERS.filter(m => selectedMemberIds.includes(m.id));

      const cardData = {
        memberIds: selectedMemberIds,
        memberNames: selectedMemberObjects.map(m => m.name.toUpperCase()),
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
    if (!window.confirm("Delete this card permanently?")) return;
    try {
      await deleteDoc(doc(db, 'cards', editingCard.id));
      setAdminModalMode(null);
    } catch (err) { alert(err.message); }
  };

  const toggleFilterMember = (id) => {
    setActiveFilters(prev => {
      const isSelected = prev.memberIds.includes(id);
      return {
        ...prev,
        memberIds: isSelected 
          ? prev.memberIds.filter(mId => mId !== id) 
          : [...prev.memberIds, id]
      };
    });
  };

  const toggleUserStatus = async (key, id) => {
    const list = userData[key] || [];
    const newList = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
    await setDoc(doc(db, 'users', user.uid), { ...userData, [key]: newList });
  };

  const filteredCards = cards.filter(c => {
    const cardMemberIds = c.memberIds || [c.memberId];
    const matchMember = activeFilters.memberIds.length === 0 || 
                         cardMemberIds.some(id => activeFilters.memberIds.includes(id));
    
    const mAlb = activeFilters.album === 'all' || c.album === activeFilters.album;
    const mTyp = activeFilters.type === 'all' || c.type === activeFilters.type;
    const mSrc = ( (c.memberNames?.join(' ') || c.memberName) + (c.type||'') + (c.album||'')).toLowerCase().includes(activeFilters.search.toLowerCase());
    
    return matchMember && mAlb && mTyp && mSrc;
  });

  if (loading) return <div className="h-screen flex items-center justify-center bg-sky-50"><Loader2 className="animate-spin text-sky-400 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-sky-50/20 pb-20 font-sans text-slate-700">
      
      {/* Pastel Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-sky-100 sticky top-0 z-40 px-4 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-400 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-sky-100">Z</div>
          <h1 className="font-black text-xs tracking-[0.2em] text-sky-900 uppercase">ARCHIVE.ONE</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsAdminMode(!isAdminMode)} 
             className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isAdminMode ? 'bg-sky-500 text-white shadow-md' : 'bg-white text-sky-300 border border-sky-50'}`}
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

      {/* FILTER BAR */}
      <div className="sticky top-[65px] z-30 px-4 py-4 bg-gradient-to-b from-white to-transparent">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-300 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search database..." 
              value={activeFilters.search}
              onChange={(e) => setActiveFilters({...activeFilters, search: e.target.value})}
              className="w-full pl-11 pr-12 py-3.5 rounded-2xl border-none bg-white shadow-xl shadow-sky-900/5 outline-none focus:ring-2 focus:ring-sky-200 font-bold text-sm placeholder:text-sky-200/50 uppercase tracking-tighter"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
            <FilterPill active={activeFilters.memberIds.length === 0} onClick={() => setActiveFilters({...activeFilters, memberIds: []})} label="ALL MEMBERS" />
            {MEMBERS.map(m => (
              <FilterPill 
                key={m.id} 
                active={activeFilters.memberIds.includes(m.id)} 
                onClick={() => toggleFilterMember(m.id)} 
                label={m.name} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {adminModalMode && <AdminModal mode={adminModalMode} status={status} MEMBERS={MEMBERS} onSubmit={handleAdminSubmit} onDelete={handleDelete} onClose={() => setAdminModalMode(null)} previews={previews} onPreview={handleFilePreview} editingCard={editingCard} />}
      {fullscreenCard && <FullscreenModal card={fullscreenCard} onClose={() => setFullscreenCard(null)} isCollected={userData.collected?.includes(fullscreenCard.id)} onToggleStatus={toggleUserStatus} />}

      {/* GALLERY */}
      <main className="max-w-7xl mx-auto px-4 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-10">
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
              <h2 className="text-[10px] font-black text-sky-200 uppercase tracking-[0.3em]">Vault Matches Zero</h2>
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

// --- COMPONENTS ---

function FilterPill({ active, onClick, label }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-[9px] font-black tracking-[0.15em] transition-all border whitespace-nowrap ${
        active 
        ? 'bg-sky-400 text-white border-sky-400 shadow-lg shadow-sky-100' 
        : 'bg-white text-sky-300 border-sky-50'
      }`}
    >
      {label.toUpperCase()}
    </button>
  );
}

function Photocard({ card, isCollected, isWishlist, onToggleStatus, onFullscreen, isAdminMode, onEdit }) {
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Use space instead of & for unit cards as requested
  const displayNames = (card.memberNames?.join(' ') || card.memberName).toUpperCase();

  return (
    <div className="group flex flex-col animate-in fade-in zoom-in duration-300">
      <div className="perspective-1000 w-full mb-5">
        <div 
          className={`relative aspect-[5.5/8.5] w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => card.imageUrlBack && setIsFlipped(!isFlipped)}
        >
          <div className="absolute inset-0 backface-hidden rounded-3xl overflow-hidden bg-white shadow-2xl shadow-sky-900/5 border border-white">
            <img src={card.imageUrl} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               {isAdminMode && (
                 <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-9 h-9 flex items-center justify-center bg-sky-500 text-white rounded-xl shadow-lg"><Edit3 className="w-4 h-4" /></button>
               )}
               <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="w-9 h-9 flex items-center justify-center bg-white/95 text-sky-500 rounded-xl shadow-lg"><Maximize2 className="w-4 h-4" /></button>
            </div>
            {isCollected && <div className="absolute inset-0 bg-sky-400/10 flex items-center justify-center"><div className="bg-white p-3 rounded-full shadow-2xl scale-125"><Check className="text-sky-400 w-5 h-5 stroke-[4px]" /></div></div>}
          </div>
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl overflow-hidden bg-sky-50 shadow-lg border border-white">
            <img src={card.imageUrlBack || card.imageUrl} className="w-full h-full object-cover grayscale-[0.4]" />
          </div>
        </div>
      </div>

      <div className="px-1 text-center">
        <div className="flex justify-between items-start gap-1 mb-1">
           <h3 className="font-black text-slate-800 text-[10px] leading-tight tracking-tight uppercase line-clamp-2 w-full">{displayNames}</h3>
           <button onClick={() => onToggleStatus('wishlist', card.id)} className="shrink-0">
             <Heart className={`w-3.5 h-3.5 transition-all ${isWishlist ? 'fill-rose-400 text-rose-400' : 'text-sky-100'}`} />
           </button>
        </div>
        <p className="text-[8px] text-sky-300 font-black uppercase truncate mb-4 tracking-widest">{card.album} • {card.type}</p>
        <button 
          onClick={() => onToggleStatus('collected', card.id)} 
          className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${isCollected ? 'bg-sky-50 text-sky-400 border border-sky-100' : 'bg-slate-900 text-white'}`}
        >
          {isCollected ? 'COLLECTED' : 'OWN THIS'}
        </button>
      </div>
    </div>
  );
}

function AdminModal({ mode, status, MEMBERS, onSubmit, onDelete, onClose, previews, onPreview, editingCard }) {
  const [selectedMembers, setSelectedMembers] = useState(editingCard?.memberIds || []);

  const toggleMember = (id) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-sky-900/40 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-xl rounded-t-[3rem] sm:rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-black text-sky-900 tracking-tighter uppercase">{mode === 'add' ? 'New Archive' : 'Edit Archive'}</h2>
          <button onClick={onClose} className="p-3 bg-sky-50 text-sky-300 rounded-full hover:bg-sky-400 hover:text-white transition-all"><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={(e) => onSubmit(e, selectedMembers)} className="space-y-12">
          <div className="grid grid-cols-2 gap-6 sm:gap-10">
            {['front', 'back'].map(side => (
              <div key={side} className="space-y-4">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-sky-200 text-center block">{side}</span>
                <div className="relative aspect-[5.5/8.5] bg-sky-50/50 border-2 border-dashed border-sky-100 rounded-[2rem] flex items-center justify-center overflow-hidden hover:border-sky-400 transition-colors cursor-pointer group">
                  {previews[side] ? <img src={previews[side]} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-3 opacity-30"><Camera className="w-10 h-10 text-sky-400" /><span className="text-[8px] font-black">BROWSE</span></div>}
                  <input type="file" name={`${side}Photo`} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => onPreview(e, side)} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-8">
             <div>
               <label className="text-[9px] font-black uppercase text-sky-200 mb-4 block ml-1 tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Tag Members</label>
               <div className="grid grid-cols-3 gap-2.5">
                 {MEMBERS.map(m => (
                   <button 
                     key={m.id}
                     type="button"
                     onClick={() => toggleMember(m.id)}
                     className={`py-3 rounded-xl text-[8px] font-black tracking-widest transition-all border ${
                       selectedMembers.includes(m.id) 
                       ? 'bg-sky-400 text-white border-sky-400 shadow-lg shadow-sky-100' 
                       : 'bg-white text-sky-200 border-sky-50'
                     }`}
                   >
                     {m.name.toUpperCase()}
                   </button>
                 ))}
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-6">
                <div><label className="text-[9px] font-black uppercase text-sky-200 mb-2 block ml-1 tracking-widest">Album Era</label><input name="album" defaultValue={editingCard?.album || ''} placeholder="e.g. Cinema" className="w-full p-4 bg-sky-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-sky-100" required /></div>
                <div><label className="text-[9px] font-black uppercase text-sky-200 mb-2 block ml-1 tracking-widest">Specifics</label><input name="type" defaultValue={editingCard?.type || ''} placeholder="e.g. Lucky" className="w-full p-4 bg-sky-50 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-sky-100" required /></div>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 pt-4">
            {mode === 'edit' && <button type="button" onClick={onDelete} disabled={!!status} className="w-full sm:flex-1 py-5 bg-rose-50 text-rose-400 rounded-[2rem] font-black text-[10px] tracking-widest uppercase hover:bg-rose-100 transition-colors">Discard</button>}
            <button type="submit" disabled={!!status} className="w-full sm:flex-[2] py-5 bg-sky-500 text-white rounded-[2rem] font-black text-[10px] tracking-widest uppercase shadow-2xl shadow-sky-100 flex items-center justify-center gap-3">
              {status ? <Loader2 className="animate-spin w-5 h-5" /> : (mode === 'add' ? 'Confirm Addition' : 'Update Archive')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FullscreenModal({ card, onClose, isCollected, onToggleStatus }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const displayNames = (card.memberNames?.join(' ') || card.memberName).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
      <button onClick={onClose} className="fixed top-8 right-8 p-4 bg-sky-50 text-sky-400 rounded-full z-[110] shadow-sm hover:scale-110 transition-all"><X /></button>
      
      <div className="w-full max-w-[320px] sm:max-w-[480px] mb-12 mt-16 shrink-0 group">
        <div className="perspective-1000 w-full">
          <div 
            className={`relative aspect-[5.5/8.5] w-full transition-transform duration-1000 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
            onClick={() => card.imageUrlBack && setIsFlipped(!isFlipped)}
          >
            <div className="absolute inset-0 backface-hidden rounded-[3rem] overflow-hidden bg-white shadow-2xl border-4 border-white">
              <img src={card.imageUrl} className="w-full h-full object-cover" />
              {isCollected && <div className="absolute top-8 right-8 bg-sky-400 text-white p-4 rounded-3xl shadow-2xl shadow-sky-200"><Check className="w-8 h-8 stroke-[4px]" /></div>}
            </div>
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[3rem] overflow-hidden bg-sky-50 shadow-2xl border-4 border-white">
              <img src={card.imageUrlBack || card.imageUrl} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center space-y-8 max-w-sm w-full pb-16">
        <h2 className="text-4xl sm:text-5xl font-black text-sky-900 tracking-tighter leading-none">{displayNames}</h2>
        <div className="flex gap-2.5 justify-center">
          <span className="px-6 py-2.5 bg-sky-50 text-sky-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]">{card.album}</span>
          <span className="px-6 py-2.5 bg-sky-50 text-sky-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]">{card.type}</span>
        </div>
        <button 
          onClick={() => onToggleStatus('collected', card.id)}
          className={`w-full py-6 rounded-[2.5rem] font-black text-xs tracking-[0.25em] shadow-2xl transition-all active:scale-95 ${
            isCollected ? 'bg-sky-400 text-white shadow-sky-200' : 'bg-slate-900 text-white'
          }`}
        >
          {isCollected ? 'ARCHIVED & OWNED' : 'MARK AS COLLECTED'}
        </button>
      </div>
    </div>
  );
}

