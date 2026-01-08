import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Search, Heart, Check, Plus, X, Settings, Loader2, Upload, Database, Camera } from 'lucide-react';

// --- CONFIGURATION ---
// These pull from Vercel's "Environment Variables" settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Your specific Cloudinary Details
const CLOUDINARY_NAME = "dkedelokp"; 
const CLOUDINARY_PRESET = "zb1_uploads"; 

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
  const [status, setStatus] = useState(''); // Tracking upload steps
  
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
    }, (err) => alert("Firebase Error: " + err.message));

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (s) => {
      if (s.exists()) setUserData(s.data());
    });
    return () => { unsubCards(); unsubUser(); };
  }, [user]);

  const uploadToCloudinary = async (file) => {
    setStatus('Uploading image to Cloudinary...');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Cloudinary Upload Failed");
    }

    const data = await res.json();
    return data.secure_url;
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    setStatus('Starting...');
    const form = e.target;
    
    try {
      const imageUrl = await uploadToCloudinary(form.photo.files[0]);
      
      setStatus('Saving card details to Database...');
      await addDoc(collection(db, 'cards'), {
        memberId: form.member.value,
        memberName: MEMBERS.find(m => m.id === form.member.value).name,
        album: form.album.value,
        type: form.type.value,
        imageUrl,
        createdAt: serverTimestamp()
      });

      setStatus('');
      alert("Card added successfully!");
      form.reset();
      setIsAdminOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
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
    <div className="h-screen flex items-center justify-center bg-blue-50">
      <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="bg-white border-b sticky top-0 z-40 p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-100">Z</div>
          <div>
            <h1 className="font-black text-lg tracking-tighter text-slate-800 leading-none">ZB1.COLLECT</h1>
            <p className="text-[9px] text-blue-500 font-bold tracking-widest uppercase mt-1">Global Database</p>
          </div>
        </div>
        <button onClick={() => setIsAdminOpen(true)} className="p-2.5 bg-slate-50 border border-slate-100 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {isAdminOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex justify-center items-end sm:items-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800">Add Photocard</h2>
              <button onClick={() => setIsAdminOpen(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Member</label>
                <select name="member" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 appearance-none">
                  {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Album</label>
                  <input name="album" placeholder="e.g. Cinema Paradise" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100" required />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Type</label>
                   <input name="type" placeholder="e.g. POB" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100" required />
                </div>
              </div>
              <div className="relative group border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center bg-slate-50 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer">
                <input type="file" name="photo" id="photo" className="hidden" accept="image/*" required />
                <label htmlFor="photo" className="cursor-pointer flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform">
                    <Camera className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-slate-500">Select Front Image</span>
                </label>
              </div>
              <button 
                disabled={!!status} 
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-3"
              >
                {status ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" />
                    <span className="text-xs uppercase tracking-widest">{status}</span>
                  </>
                ) : 'Upload to Catalogue'}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <div className="mb-10 flex flex-col gap-6">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by member or version..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-5 rounded-[2rem] border-none bg-white shadow-xl shadow-slate-200/50 outline-none focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-300 font-medium"
            />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setActiveMember('all')} className={`px-6 py-2.5 rounded-full text-xs font-black transition-all ${activeMember === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}>ALL</button>
            {MEMBERS.map(m => (
              <button key={m.id} onClick={() => setActiveMember(m.id)} className={`px-6 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${activeMember === m.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border border-slate-100'}`}>
                {m.name.split(' ').pop()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredCards.map(card => (
            <div key={card.id} className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-white group transition-all hover:shadow-2xl hover:-translate-y-1">
              <div className="aspect-[3/4] relative overflow-hidden bg-slate-100">
                <img src={card.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                {userData.collected?.includes(card.id) && (
                  <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] flex items-center justify-center animate-in zoom-in duration-300">
                    <div className="bg-white p-3 rounded-full shadow-2xl scale-110"><Check className="text-blue-600 w-6 h-6 stroke-[3px]" /></div>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-black text-slate-800 text-sm truncate">{card.memberName}</h3>
                  <button onClick={() => toggleStatus('wishlist', card.id)} className="p-1">
                    <Heart className={`w-5 h-5 transition-all ${userData.wishlist?.includes(card.id) ? 'fill-red-500 text-red-500 scale-110' : 'text-slate-200 hover:text-red-200'}`} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-bold truncate mb-5 uppercase tracking-tighter">{card.album} • {card.type}</p>
                <button 
                  onClick={() => toggleStatus('collected', card.id)}
                  className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    userData.collected?.includes(card.id) 
                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                    : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200'
                  }`}
                >
                  {userData.collected?.includes(card.id) ? 'In Collection' : 'Got it!'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCards.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
             <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Database className="w-10 h-10 text-slate-200" />
             </div>
             <h3 className="text-slate-800 font-black text-xl">The Vault is Empty</h3>
             <p className="text-slate-400 text-sm mt-2 mb-6">Start building the ZB1 archive by adding cards.</p>
             <button onClick={() => setIsAdminOpen(true)} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Add First Card</button>
          </div>
        )}
      </main>
    </div>
  );
}

