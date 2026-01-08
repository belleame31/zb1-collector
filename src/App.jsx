import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Search, Heart, Check, Plus, X, Settings, Loader2, Upload, Database, Camera } from 'lucide-react';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const CLOUDINARY_PRESET = "zb1_preset"; 
const CLOUDINARY_NAME = "your_cloud_name"; 

// Initialize Firebase
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
  const [isUploading, setIsUploading] = useState(false);
  
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
    setIsUploading(true);
    const form = e.target;
    try {
      const imageUrl = await uploadToCloudinary(form.photo.files[0]);
      await addDoc(collection(db, 'cards'), {
        memberId: form.member.value,
        memberName: MEMBERS.find(m => m.id === form.member.value).name,
        album: form.album.value,
        type: form.type.value,
        imageUrl,
        createdAt: serverTimestamp()
      });
      form.reset();
      setIsAdminOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleStatus = async (key, id) => {
    const list = userData[key] || [];
    const newList = list.includes(id) ? list.filter(i => i !== id) : [...list, id];
    await setDoc(doc(db, 'users', user.uid), { ...userData, [key]: newList });
  };

  const filteredCards = cards.filter(c => 
    (activeMember === 'all' || c.memberId === activeMember) &&
    (c.memberName.toLowerCase().includes(searchQuery.toLowerCase()) || c.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-blue-50">
      <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="bg-white border-b sticky top-0 z-40 p-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="font-black text-xl tracking-tighter text-blue-600">ZB1.COLLECT</h1>
          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Global Catalogue</p>
        </div>
        <button onClick={() => setIsAdminOpen(true)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {isAdminOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Add to Database</h2>
              <button onClick={() => setIsAdminOpen(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddCard} className="space-y-4">
              <select name="member" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400">
                {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input name="album" placeholder="Album Name" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400" required />
              <input name="type" placeholder="Type (e.g. Luckydraw, Album PC)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-400" required />
              <div className="relative group border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <input type="file" name="photo" id="photo" className="hidden" accept="image/*" required />
                <label htmlFor="photo" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-600">Upload Front Image</span>
                </label>
              </div>
              <button disabled={isUploading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isUploading ? <Loader2 className="animate-spin" /> : 'Confirm Addition'}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4">
        <div className="mb-6 flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by member or version..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-none bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setActiveMember('all')} className={`px-5 py-2 rounded-full text-xs font-black transition-all ${activeMember === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>ALL</button>
            {MEMBERS.map(m => (
              <button key={m.id} onClick={() => setActiveMember(m.id)} className={`px-5 py-2 rounded-full text-xs font-black transition-all whitespace-nowrap ${activeMember === m.id ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white text-slate-400 border border-slate-100'}`}>
                {m.name.split(' ').pop()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredCards.map(card => (
            <div key={card.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 group">
              <div className="aspect-[3/4] relative overflow-hidden bg-slate-200">
                <img src={card.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {userData.collected?.includes(card.id) && (
                  <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in">
                    <div className="bg-white p-2 rounded-full shadow-xl"><Check className="text-blue-600 w-6 h-6" /></div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-slate-800 text-sm truncate">{card.memberName}</h3>
                  <button onClick={() => toggleStatus('wishlist', card.id)}>
                    <Heart className={`w-4 h-4 transition-colors ${userData.wishlist?.includes(card.id) ? 'fill-red-500 text-red-500' : 'text-slate-300'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium truncate mb-4">{card.album} • {card.type}</p>
                <button 
                  onClick={() => toggleStatus('collected', card.id)}
                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    userData.collected?.includes(card.id) 
                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                    : 'bg-slate-900 text-white hover:bg-blue-600'
                  }`}
                >
                  {userData.collected?.includes(card.id) ? 'Collected' : 'I own this'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

