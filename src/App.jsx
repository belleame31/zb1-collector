import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Search, Heart, Check, Plus, X, Settings, Loader2, Camera, RotateCw, Maximize2, Filter, Sparkles, LayoutGrid } from 'lucide-react';

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
  { id: 'hanbin', name: 'Sung Han Bin' }, { id: 'jiwoong', name: 'Kim Ji Woong' },
  { id: 'zhanghao', name: 'Zhang Hao' }, { id: 'matthew', name: 'Seok Matthew' },
  { id: 'taerae', name: 'Kim Tae Rae' }, { id: 'ricky', name: 'Ricky' },
  { id: 'gyuvin', name: 'Kim Gyu Vin' }, { id: 'gunwook', name: 'Park Gun Wook' },
  { id: 'yujin', name: 'Han Yu Jin' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [userData, setUserData] = useState({ collected: [], wishlist: [] });
  const [loading, setLoading] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [status, setStatus] = useState('');
  
  // Modals
  const [fullscreenCard, setFullscreenCard] = useState(null);

  // Filters
  const [activeFilters, setActiveFilters] = useState({ memberId: 'all', album: 'all', type: 'all', search: '' });

  // Admin Form Previews
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

  const handleAddCard = async (e) => {
    e.preventDefault();
    setStatus('Syncing with Cloud...');
    const form = e.target;
    try {
      const frontUrl = await uploadToCloudinary(form.frontPhoto.files[0]);
      let backUrl = null;
      if (form.backPhoto.files[0]) {
        backUrl = await uploadToCloudinary(form.backPhoto.files[0]);
      }
      
      await addDoc(collection(db, 'cards'), {
        memberId: form.member.value,
        memberName: MEMBERS.find(m => m.id === form.member.value).name,
        album: form.album.value,
        type: form.type.value,
        imageUrl: frontUrl,
        imageUrlBack: backUrl,
        createdAt: serverTimestamp()
      });

      setPreviews({ front: null, back: null });
      alert("Added to Global Archive!");
      setIsAdminOpen(false);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setStatus('');
    }
  };

  const toggleStatus = async (key, id) => {
    const list = userData[key] || [];
    const newList = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
    await setDoc(doc(db, 'users', user.uid), { ...userData, [key]: newList });
  };

  const filteredCards = cards.filter(c => {
    const mMem = activeFilters.memberId === 'all' || c.memberId === activeFilters.memberId;
    const mAlb = activeFilters.album === 'all' || c.album === activeFilters.album;
    const mTyp = activeFilters.type === 'all' || c.type === activeFilters.type;
    const mSrc = c.memberName.toLowerCase().includes(activeFilters.search.toLowerCase()) || 
                 (c.type || '').toLowerCase().includes(activeFilters.search.toLowerCase()) ||
                 (c.album || '').toLowerCase().includes(activeFilters.search.toLowerCase());
    return mMem && mAlb && mTyp && mSrc;
  });

  if (loading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24 font-sans text-slate-900">
      
      {/* Dynamic Navigation */}
      <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-200">Z</div>
          <div className="hidden sm:block">
            <h1 className="font-black text-base tracking-tighter text-slate-800 leading-none uppercase">Archive.ONE</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <button onClick={() => setIsAdminOpen(true)} className="p-2.5 bg-slate-900 text-white rounded-full hover:bg-blue-600 transition-all">
             <Plus className="w-5 h-5" />
           </button>
        </div>
      </header>

      {/* MODALS */}
      {isAdminOpen && <AdminModal status={status} MEMBERS={MEMBERS} onAdd={handleAddCard} onClose={() => setIsAdminOpen(false)} previews={previews} onPreview={handleFilePreview} />}
      {fullscreenCard && <FullscreenModal card={fullscreenCard} onClose={() => setFullscreenCard(null)} isCollected={userData.collected?.includes(fullscreenCard.id)} onToggleStatus={toggleStatus} />}

      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Advanced Filters */}
        <section className="mb-14 space-y-6">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search members, versions, or specific eras..." 
              value={activeFilters.search}
              onChange={(e) => setActiveFilters({...activeFilters, search: e.target.value})}
              className="w-full pl-15 pr-8 py-5 rounded-[2rem] border-none bg-white shadow-2xl shadow-slate-200/20 outline-none focus:ring-4 focus:ring-blue-500/5 font-semibold text-lg"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-50">
             <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Filter By</span>
             </div>
             
             <select 
               className="px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
               value={activeFilters.memberId}
               onChange={(e) => setActiveFilters({...activeFilters, memberId: e.target.value})}
             >
               <option value="all">Member: All</option>
               {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
             </select>

             <select 
               className="px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
               value={activeFilters.album}
               onChange={(e) => setActiveFilters({...activeFilters, album: e.target.value})}
             >
               <option value="all">Era: All</option>
               {uniqueAlbums.filter(a => a !== 'all').map(a => <option key={a} value={a}>{a}</option>)}
             </select>

             <select 
               className="px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-100"
               value={activeFilters.type}
               onChange={(e) => setActiveFilters({...activeFilters, type: e.target.value})}
             >
               <option value="all">Type: All</option>
               {uniqueTypes.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
             </select>

             {(activeFilters.memberId !== 'all' || activeFilters.album !== 'all' || activeFilters.type !== 'all' || activeFilters.search !== '') && (
               <button onClick={() => setActiveFilters({ memberId: 'all', album: 'all', type: 'all', search: '' })} className="text-[10px] font-black text-blue-600 px-4 hover:underline transition-all">RESET</button>
             )}
          </div>
        </section>

        {/* Photocard Gallery */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {filteredCards.map(card => (
            <Photocard 
              key={card.id} 
              card={card} 
              isCollected={userData.collected?.includes(card.id)}
              isWishlist={userData.wishlist?.includes(card.id)}
              onToggleStatus={toggleStatus}
              onFullscreen={() => setFullscreenCard(card)}
            />
          ))}
        </div>

        {filteredCards.length === 0 && (
           <div className="py-40 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-4"><LayoutGrid className="text-slate-300 w-8 h-8" /></div>
              <h2 className="text-xl font-black text-slate-800">Archive matches zero</h2>
              <p className="text-slate-400 text-sm mt-1">Try changing your filters.</p>
           </div>
        )}
      </main>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function Photocard({ card, isCollected, isWishlist, onToggleStatus, onFullscreen }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="group relative flex flex-col">
      <div className="perspective-1000 w-full mb-5">
        <div className={`relative aspect-[5.5/8.5] w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
             onClick={() => card.imageUrlBack && setIsFlipped(!isFlipped)}>
          
          <div className="absolute inset-0 backface-hidden rounded-[1.5rem] overflow-hidden bg-white shadow-xl shadow-slate-200/50 border border-white">
            <img src={card.imageUrl} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
               <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg hover:text-blue-600"><Maximize2 className="w-4 h-4" /></button>
               <button onClick={(e) => { e.stopPropagation(); onToggleStatus('wishlist', card.id); }} className={`p-2.5 rounded-xl shadow-lg transition-all ${isWishlist ? 'bg-red-500 text-white' : 'bg-white/95 text-slate-400'}`}><Heart className={`w-4 h-4 ${isWishlist ? 'fill-current' : ''}`} /></button>
            </div>
            {isCollected && <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] flex items-center justify-center"><div className="bg-white p-3 rounded-full shadow-2xl scale-125"><Check className="text-blue-600 w-5 h-5 stroke-[3px]" /></div></div>}
          </div>

          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[1.5rem] overflow-hidden bg-slate-50 border border-white">
            <img src={card.imageUrlBack || card.imageUrl} className="w-full h-full object-cover grayscale-[0.2]" />
          </div>
        </div>
      </div>

      <div className="px-1">
        <h3 className="font-black text-slate-800 text-sm truncate leading-none mb-1">{card.memberName}</h3>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate mb-4">{card.album} • {card.type}</p>
        <button onClick={() => onToggleStatus('collected', card.id)} className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${isCollected ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
          {isCollected ? 'COLLECTED' : 'ADD TO COLLECTION'}
        </button>
      </div>
    </div>
  );
}

function AdminModal({ status, MEMBERS, onAdd, onClose, previews, onPreview }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xl flex justify-center items-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Add to Archive</h2>
          <button onClick={onClose} className="p-3 bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <form onSubmit={onAdd} className="space-y-10">
          <div className="grid grid-cols-2 gap-8">
            {['front', 'back'].map(side => (
              <div key={side} className="space-y-4 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{side} Side</span>
                <div className="relative aspect-[5.5/8.5] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden hover:border-blue-400 transition-colors">
                  {previews[side] ? <img src={previews[side]} className="w-full h-full object-cover" /> : <div className="text-slate-300 flex flex-col items-center gap-3"><Camera className="w-10 h-10" /><span className="text-[10px] font-black">BROWSE</span></div>}
                  <input type="file" name={`${side}Photo`} required={side === 'front'} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => onPreview(e, side)} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="col-span-full"><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1">Member Name</label><select name="member" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">{MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
             <div><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1">Era / Album</label><input name="album" placeholder="e.g. Cinema Paradise" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" required /></div>
             <div><label className="text-[10px] font-black uppercase text-slate-400 mb-2 block ml-1">Card Variant</label><input name="type" placeholder="e.g. Apple Music POB" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" required /></div>
          </div>
          <button disabled={!!status} className="w-full py-5.5 bg-blue-600 text-white rounded-[2rem] font-black shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 transition-all flex items-center justify-center gap-4 text-xs tracking-widest">
            {status ? <><Loader2 className="animate-spin" /> {status}</> : 'PUBLISH PHOTOCARD'}
          </button>
        </form>
      </div>
    </div>
  );
}

function FullscreenModal({ card, onClose, isCollected, onToggleStatus }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-300">
      <button onClick={onClose} className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50"><X /></button>
      
      <div className="flex flex-col lg:flex-row gap-16 max-w-7xl w-full items-center justify-center">
         
         {/* Photocard Viewport */}
         <div className="perspective-1000 w-full max-w-[400px] sm:max-w-[480px]">
           <div className={`relative aspect-[5.5/8.5] w-full transition-transform duration-1000 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}>
              
              {/* Front Side */}
              <div className="absolute inset-0 backface-hidden rounded-[3rem] overflow-hidden bg-slate-800 shadow-2xl border-4 border-white/10">
                 <img src={card.imageUrl} className="w-full h-full object-cover" alt="" />
                 {isCollected && <div className="absolute top-6 left-6 bg-blue-600 text-white p-3 rounded-2xl shadow-xl"><Check className="w-6 h-6 stroke-[3px]" /></div>}
                 
                 {card.imageUrlBack && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
                     className="absolute bottom-8 right-8 p-5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white transition-all border border-white/20"
                   >
                     <RotateCw className="w-6 h-6" />
                   </button>
                 )}
              </div>

              {/* Back Side */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[3rem] overflow-hidden bg-slate-900 shadow-2xl border-4 border-white/10 flex items-center justify-center">
                 {card.imageUrlBack ? (
                   <img src={card.imageUrlBack} className="w-full h-full object-cover" alt="" />
                 ) : (
                   <Sparkles className="text-slate-700 w-24 h-24" />
                 )}
                 <button 
                   onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                   className="absolute bottom-8 right-8 p-5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white transition-all border border-white/20"
                 >
                   <RotateCw className="w-6 h-6" />
                 </button>
              </div>
           </div>
         </div>

         {/* Meta Section */}
         <div className="flex-1 text-white text-center lg:text-left space-y-10 animate-in slide-in-from-right duration-500 delay-200">
            <div>
               <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px] mb-4">Official ZB1 Archive</p>
               <h2 className="text-5xl lg:text-8xl font-black tracking-tighter mb-6">{card.memberName}</h2>
               <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                  <span className="px-6 py-2.5 bg-white/10 rounded-2xl text-xs font-black border border-white/5 uppercase tracking-widest">{card.album}</span>
                  <span className="px-6 py-2.5 bg-white/10 rounded-2xl text-xs font-black border border-white/5 uppercase tracking-widest">{card.type}</span>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
               <button 
                 onClick={() => onToggleStatus('collected', card.id)}
                 className={`px-12 py-5 rounded-[2rem] font-black transition-all text-xs tracking-[0.2em] shadow-2xl ${isCollected ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 hover:scale-105'}`}
               >
                 {isCollected ? 'OWNED & ARCHIVED' : 'ADD TO MY COLLECTION'}
               </button>
            </div>
         </div>

      </div>
    </div>
  );
}

