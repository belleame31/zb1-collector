import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Search, Heart, Check, Plus, X, Settings, Loader2, Camera, RotateCw, Eye, Sparkles, LayoutGrid } from 'lucide-react';

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
  
  // Admin Form State
  const [previews, setPreviews] = useState({ front: null, back: null });
  const [activeMember, setActiveMember] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
    setStatus('Uploading Images...');
    const form = e.target;
    try {
      const frontUrl = await uploadToCloudinary(form.frontPhoto.files[0]);
      let backUrl = null;
      if (form.backPhoto.files[0]) {
        setStatus('Uploading Back Image...');
        backUrl = await uploadToCloudinary(form.backPhoto.files[0]);
      }
      
      setStatus('Saving to Database...');
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
      alert("Photocard added successfully!");
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

  const filteredCards = cards.filter(c => 
    (activeMember === 'all' || c.memberId === activeMember) &&
    (c.memberName.toLowerCase().includes(searchQuery.toLowerCase()) || (c.type || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 p-5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-200">Z</div>
          <div>
            <h1 className="font-black text-xl tracking-tighter text-slate-800 leading-none">ZB1 COLLECT</h1>
            <p className="text-[10px] text-blue-500 font-bold tracking-widest uppercase mt-1">Digital Archive</p>
          </div>
        </div>
        <button onClick={() => setIsAdminOpen(true)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:shadow-lg hover:shadow-blue-50 transition-all">
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Admin Panel Overlay */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex justify-center items-end sm:items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Add New PC</h2>
              <button onClick={() => setIsAdminOpen(false)} className="p-3 bg-slate-100 rounded-full text-slate-500"><X /></button>
            </div>
            
            <form onSubmit={handleAddCard} className="space-y-8">
              {/* Image Selection & Preview */}
              <div className="grid grid-cols-2 gap-6">
                {['front', 'back'].map((side) => (
                  <div key={side} className="space-y-3">
                    <p className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">{side} of card</p>
                    <div className="relative aspect-[5.5/8.5] bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center overflow-hidden group hover:border-blue-400 transition-colors">
                      {previews[side] ? (
                        <img src={previews[side]} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Camera className="w-8 h-8" />
                          <span className="text-[10px] font-bold">Select Photo</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        name={`${side}Photo`} 
                        required={side === 'front'} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        accept="image/*"
                        onChange={(e) => handleFilePreview(e, side)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Member</label>
                  <select name="member" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 appearance-none font-bold">
                    {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Album</label>
                  <input name="album" placeholder="e.g. Melting Point" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 font-bold" required />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Version / Type</label>
                  <input name="type" placeholder="e.g. Fairytale POB" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 font-bold" required />
                </div>
              </div>

              <button 
                disabled={!!status} 
                className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
              >
                {status ? <><Loader2 className="animate-spin w-5 h-5" /> {status}</> : 'Publish to Archive'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 sm:p-10">
        <div className="mb-12 flex flex-col gap-8">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by member, album or event..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-8 py-6 rounded-[2.5rem] border-none bg-white shadow-2xl shadow-slate-200/40 outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-300 font-semibold text-lg"
            />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setActiveMember('all')} className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${activeMember === 'all' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}>ALL MEMBERS</button>
            {MEMBERS.map(m => (
              <button key={m.id} onClick={() => setActiveMember(m.id)} className={`px-8 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${activeMember === m.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}>
                {m.name.split(' ').pop()}
              </button>
            ))}
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {filteredCards.map(card => (
            <Photocard 
              key={card.id} 
              card={card} 
              isCollected={userData.collected?.includes(card.id)}
              isWishlist={userData.wishlist?.includes(card.id)}
              onToggleStatus={toggleStatus}
            />
          ))}
        </div>

        {filteredCards.length === 0 && (
          <div className="py-32 text-center bg-white rounded-[4rem] shadow-sm border-2 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-blue-500">
                <LayoutGrid className="w-10 h-10" />
             </div>
             <h3 className="text-2xl font-black text-slate-800 tracking-tight">Nothing here yet</h3>
             <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Be the first to contribute to the global ZB1 photocard archive.</p>
          </div>
        )}
      </main>

      {/* Persistent CSS for Flipping Animation */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// Separate Photocard Component for individual state management (flipping)
function Photocard({ card, isCollected, isWishlist, onToggleStatus }) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="group relative flex flex-col">
      {/* 3D Flip Container */}
      <div className="perspective-1000 w-full mb-5">
        <div className={`relative aspect-[5.5/8.5] w-full transition-transform duration-700 preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
             onClick={() => card.imageUrlBack && setIsFlipped(!isFlipped)}>
          
          {/* Front Side */}
          <div className="absolute inset-0 backface-hidden rounded-[1.8rem] overflow-hidden bg-slate-200 shadow-xl shadow-slate-200/50">
            <img src={card.imageUrl} className="w-full h-full object-cover" loading="lazy" />
            {isCollected && (
              <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-white/90 p-4 rounded-full shadow-2xl scale-125"><Check className="text-blue-600 w-6 h-6 stroke-[3px]" /></div>
              </div>
            )}
            {/* Flip Hint */}
            {card.imageUrlBack && (
              <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <RotateCw className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Back Side */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[1.8rem] overflow-hidden bg-slate-100 shadow-xl">
            {card.imageUrlBack ? (
              <img src={card.imageUrlBack} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                <Sparkles className="text-slate-300 w-10 h-10 mb-2" />
                <p className="text-[10px] font-black text-slate-400">ZB1 COLLECT</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info & Actions */}
      <div className="px-1">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-black text-slate-800 text-sm leading-none truncate">{card.memberName}</h3>
          <button onClick={() => onToggleStatus('wishlist', card.id)}>
            <Heart className={`w-5 h-5 transition-all ${isWishlist ? 'fill-red-500 text-red-500 drop-shadow-sm' : 'text-slate-200 hover:text-red-200'}`} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate mb-4">{card.album} • {card.type}</p>
        
        <button 
          onClick={() => onToggleStatus('collected', card.id)}
          className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
            isCollected 
            ? 'bg-blue-50 text-blue-600 border border-blue-100' 
            : 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg shadow-slate-200'
          }`}
        >
          {isCollected ? 'Owned' : 'I have this'}
        </button>
      </div>
    </div>
  );
}

