import React, { useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useParams,
  useSearchParams,
  Navigate
} from 'react-router-dom';
import { 
  auth, 
  db, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  Star, 
  Phone, 
  MessageSquare, 
  User, 
  Hammer, 
  PaintBucket, 
  Zap, 
  Droplets, 
  LayoutGrid, 
  Drill, 
  Home, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ArrowLeft,
  Settings,
  LogOut,
  Languages,
  Plus,
  Mail,
  Lock,
  Smartphone,
  ChevronRight,
  Shield,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './i18n';
import toast, { Toaster } from 'react-hot-toast';

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  phone?: string;
  role: 'customer' | 'worker';
  location?: string;
  area?: string;
  district?: string;
  subscriptionStatus?: 'none' | 'trialing' | 'active' | 'canceled' | 'past_due';
  subscriptionId?: string;
  trialEndDate?: any;
  createdAt: any;
}

interface ServicePrice {
  name: string;
  price: number;
}

interface WorkerProfile {
  uid: string;
  name: string;
  phone: string;
  skills: string[];
  experience: number;
  availability: boolean;
  rating: number;
  reviewCount: number;
  location: string;
  area?: string;
  district?: string;
}

interface Booking {
  id: string;
  customerId: string;
  workerId: string;
  customerName?: string;
  workerName?: string;
  service: string;
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  rating?: number;
  createdAt: any;
  updatedAt: any;
  otherPartyName?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

const AP_DISTRICTS = [
  'anantapur', 'chittoor', 'east_godavari', 'guntur', 'krishna', 'kurnool', 
  'prakasam', 'srikakulam', 'nellore', 'visakhapatnam', 'vizianagaram', 
  'west_godavari', 'ysr_kadapa', 'parvathipuram_manyam', 'alluri_sitharama_raju', 
  'anakapalli', 'kakinada', 'konaseema', 'eluru', 'ntr', 'bapatla', 'palnadu', 
  'nandyal', 'sri_sathya_sai', 'annamayya', 'tirupati'
];

const NELLORE_AREAS = [
  'vedayapalem', 'magunta_layout', 'dargamitta', 'nellore_city', 'kovur', 
  'ramji_nagar', 'balaji_nagar', 'stonehouse_pet', 'santhapet', 'atmakur', 
  'gudur', 'kavali', 'naidupeta', 'sullurpeta', 'venkatagiri'
];

// --- Components ---

const ErrorBoundary = ({ children }: { children: ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message) {
        try {
          const parsed = JSON.parse(event.error.message);
          if (parsed.error && parsed.operationType) {
            setHasError(true);
            setErrorInfo(JSON.stringify(parsed, null, 2));
          }
        } catch (e) {
          // Not a Firestore error
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-6 bg-red-50 min-h-screen flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6">A database error occurred. Please check your permissions.</p>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-left text-xs overflow-auto max-w-full mb-6">
          {errorInfo}
        </pre>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white rounded-full font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const LoginView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          name: result.user.displayName,
          email: result.user.email,
          role: 'customer',
          createdAt: serverTimestamp()
        });
        toast.success('Account created successfully!');
      } else {
        toast.success('Welcome back!');
      }
      navigate('/');
    } catch (error: any) {
      console.error("Google login error:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (error.code === 'auth/operation-not-allowed') {
        toast.error("Google authentication is not enabled in Firebase Console. Please enable it.");
      } else {
        toast.error(error.message);
      }
    }
  };

  return (
    <div className="pt-24 pb-24 px-4 max-w-lg mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
        <div className="w-20 h-20 bg-orange-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
          <img 
            src="/logo.png" 
            alt="ReparoH Logo" 
            className="w-12 h-12 object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/reparoh/100/100';
            }}
          />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('login')} / {t('signup')}</h1>
        <p className="text-gray-500 mb-10 text-sm">
          Join our community of workers and customers
        </p>

        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          {t('login_google')}
        </button>
      </div>
    </div>
  );
};

const Navbar = ({ user, profile }: { user: FirebaseUser | null, profile: UserProfile | null }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'te' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-50 px-4 py-3 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-4">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
          <img 
            src="/logo.png" 
            alt="ReparoH Logo" 
            className="w-full h-full object-contain p-1.5"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/reparoh/100/100';
            }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-orange-600 tracking-tight leading-none">
            {t('app_name')}
          </span>
          <span className="text-[11px] text-gray-400 font-medium truncate max-w-[180px] mt-1">
            {t('app_tagline')}
          </span>
        </div>
      </Link>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleLanguage}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="Switch Language"
        >
          <Languages size={20} className="text-gray-600" />
        </button>

        {user ? (
          <div className="flex items-center gap-2">
            <Link to="/profile" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <User size={20} className="text-gray-600" />
            </Link>
            <button 
              onClick={async () => {
                await signOut(auth);
                navigate('/');
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <LogOut size={20} className="text-gray-600" />
            </button>
          </div>
        ) : (
          <Link 
            to="/login"
            className="text-sm font-medium text-orange-600 px-4 py-2 border border-orange-600 rounded-full hover:bg-orange-50 transition-colors"
          >
            {t('login')}
          </Link>
        )}
      </div>
    </nav>
  );
};

const CategoryCard = ({ icon: Icon, label, color, onClick }: { icon: any, label: string, color: string, onClick: () => void | Promise<void>, key?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 gap-2 hover:scale-105 active:scale-95 transition-transform"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
  </button>
);

const HomeView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState('nellore');
  const [selectedArea, setSelectedArea] = useState('nellore_city');

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/workers?search=${encodeURIComponent(searchQuery.trim())}&district=${selectedDistrict}&area=${selectedArea}`);
    }
  };

  const categories = [
    { id: 'construction', icon: Hammer, label: t('construction'), color: 'bg-orange-500' },
    { id: 'painting', icon: PaintBucket, label: t('painting'), color: 'bg-blue-500' },
    { id: 'electrical', icon: Zap, label: t('electrical'), color: 'bg-yellow-500' },
    { id: 'plumbing', icon: Droplets, label: t('plumbing'), color: 'bg-cyan-500' },
    { id: 'woodwork', icon: LayoutGrid, label: t('woodwork'), color: 'bg-amber-700' },
    { id: 'tiles', icon: Drill, label: t('tiles_granite'), color: 'bg-stone-500' },
    { id: 'borewell', icon: Droplets, label: t('borewell'), color: 'bg-blue-700' },
    { id: 'interiors', icon: Home, label: t('interiors'), color: 'bg-purple-500' },
    { id: 'cleaning', icon: Trash2, label: t('cleaning'), color: 'bg-green-500' },
  ];

  return (
    <div className="pt-28 pb-24 px-4 max-w-lg mx-auto">
      <div className="flex flex-col items-center text-center mb-10 pt-4">
        <div className="w-48 h-48 bg-white rounded-[2.5rem] flex items-center justify-center overflow-hidden mb-6 shadow-2xl shadow-orange-100/60 border border-gray-50">
          <img 
            src="/logo.png" 
            alt="ReparoH Logo" 
            className="w-full h-full object-contain p-4"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/reparoh/300/300';
            }}
          />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{t('app_name')}</h1>
        <p className="text-orange-600 font-bold text-sm mb-6 tracking-[0.2em] uppercase">
          {t('app_tagline_secondary')}
        </p>
        <p className="text-gray-500 text-base leading-relaxed px-6 font-medium">
          {t('app_tagline')}
        </p>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <MapPin size={18} className="text-orange-600" />
            <select 
              className="bg-transparent text-sm font-medium outline-none cursor-pointer"
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                if (e.target.value !== 'nellore') setSelectedArea('all');
              }}
            >
              {AP_DISTRICTS.map(dist => (
                <option key={dist} value={dist}>{t(dist)}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-400">{t('location_nellore')}</span>
        </div>
        
        {selectedDistrict === 'nellore' && (
          <div className="flex items-center gap-2 text-gray-500 ml-6">
            <select 
              className="bg-transparent text-xs font-medium outline-none cursor-pointer"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="all">{t('select_area')}</option>
              {NELLORE_AREAS.map(area => (
                <option key={area} value={area}>{t(area)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <form onSubmit={handleSearch} className="relative mb-8 flex gap-2">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder={t('search_services')}
            className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
        <button 
          type="submit"
          className="px-6 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
        >
          {t('search')}
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button 
          onClick={() => navigate(`/workers?district=${selectedDistrict}&area=${selectedArea}`)}
          className="flex flex-col items-center justify-center p-6 bg-orange-600 text-white rounded-3xl shadow-lg shadow-orange-200 gap-2"
        >
          <Search size={32} />
          <span className="font-bold">{t('find_worker')}</span>
        </button>
        <button 
          onClick={() => navigate('/join')}
          className="flex flex-col items-center justify-center p-6 bg-white text-orange-600 border-2 border-orange-600 rounded-3xl shadow-sm gap-2"
        >
          <Plus size={32} />
          <span className="font-bold">{t('join_as_worker')}</span>
        </button>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4">{t('categories')}</h2>
      <div className="grid grid-cols-3 gap-3">
        {categories.map((cat) => (
          <CategoryCard 
            key={cat.id} 
            icon={cat.icon} 
            label={cat.label} 
            color={cat.color}
            onClick={() => navigate(`/workers?category=${cat.id}&district=${selectedDistrict}&area=${selectedArea}`)}
          />
        ))}
      </div>
    </div>
  );
};

const WorkerListView = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const initialDistrict = searchParams.get('district') || 'nellore';
  const initialArea = searchParams.get('area') || 'all';

  const categories = [
    { id: 'construction', label: t('construction') },
    { id: 'painting', label: t('painting') },
    { id: 'electrical', label: t('electrical') },
    { id: 'plumbing', label: t('plumbing') },
    { id: 'woodwork', label: t('woodwork') },
    { id: 'tiles', label: t('tiles_granite') },
    { id: 'borewell', label: t('borewell') },
    { id: 'interiors', label: t('interiors') },
    { id: 'cleaning', label: t('cleaning') },
  ];
  
  const [workers, setWorkers] = useState<(WorkerProfile & { userLocation: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [selectedArea, setSelectedArea] = useState(initialArea);

  useEffect(() => {
    setSelectedDistrict(initialDistrict);
    setSelectedArea(initialArea);
  }, [initialDistrict, initialArea]);

  const [localSearch, setLocalSearch] = useState(search || '');

  const handleLocalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (localSearch.trim()) {
      params.set('search', localSearch.trim());
    } else {
      params.delete('search');
    }
    navigate(`/workers?${params.toString()}`);
  };

  useEffect(() => {
    setLocalSearch(search || '');
  }, [search]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      }
    };
    fetchProfile();

    let q = query(collection(db, 'workers'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const workerData = snapshot.docs
        .map((workerDoc) => {
          const data = workerDoc.data() as WorkerProfile;
          return {
            ...data,
            userLocation: data.location,
          };
        })
        .filter(w => w.availability === true);
      setWorkers(workerData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workers');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const categoryMatch = !category || (Array.isArray(w.skills) && w.skills.some(s => typeof s === 'string' && s.toLowerCase() === category.toLowerCase()));
      const districtMatch = selectedDistrict === 'all' || w.district === selectedDistrict;
      const areaMatch = selectedArea === 'all' || w.area === selectedArea;
      
      let searchMatch = true;
      if (search) {
        const term = search.toLowerCase();
        searchMatch = w.name.toLowerCase().includes(term) || 
                      (Array.isArray(w.skills) && w.skills.some(s => typeof s === 'string' && s.toLowerCase().includes(term)));
      }
      
      return categoryMatch && districtMatch && areaMatch && searchMatch;
    });
  }, [workers, category, selectedDistrict, selectedArea, search]);

  const handleWorkerClick = (workerUid: string) => {
    if (profile?.role === 'worker' && currentUser?.uid !== workerUid) {
      toast.error('Workers cannot view other workers details');
      return;
    }
    navigate(`/worker/${workerUid}`);
  };

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">{t('nearby_workers')}</h1>
        </div>

        <form onSubmit={handleLocalSearch} className="relative">
          <input 
            type="text" 
            placeholder={t('search_services')}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl border-none focus:ring-2 focus:ring-orange-500 outline-none text-sm"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </form>
        
        <div className="flex gap-2">
          <select 
            className="flex-1 bg-gray-100 p-3 rounded-xl text-xs font-medium outline-none"
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              if (e.target.value !== 'nellore') setSelectedArea('all');
            }}
          >
            <option value="all">{t('select_district')}</option>
            {AP_DISTRICTS.map(dist => (
              <option key={dist} value={dist}>{t(dist)}</option>
            ))}
          </select>
          {selectedDistrict === 'nellore' && (
            <select 
              className="flex-1 bg-gray-100 p-3 rounded-xl text-xs font-medium outline-none"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="all">{t('select_area')}</option>
              {NELLORE_AREAS.map(area => (
                <option key={area} value={area}>{t(area)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 hide-scrollbar">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.delete('category');
            setSearchParams(params);
          }}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${
            !category 
              ? 'bg-orange-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          {t('all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('category', cat.id);
              setSearchParams(params);
            }}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${
              category === cat.id 
                ? 'bg-orange-600 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWorkers.map((worker) => (
            <motion.div 
              key={worker.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleWorkerClick(worker.uid)}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer"
            >
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl">
                {worker.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{worker.name}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <MapPin size={12} />
                  <span>{worker.area ? t(worker.area) : t(worker.district || 'nellore')}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <Phone size={10} />
                  <span>{currentUser ? worker.phone : '••••••••••'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-yellow-600">
                    <Star size={12} fill="currentColor" />
                    <span>{worker.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700">{worker.experience}y Exp</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 max-w-[80px] justify-end">
                {worker.skills.slice(0, 2).map(skill => (
                  <span key={skill} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const WorkerProfileView = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasBooking, setHasBooking] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchWorker = async () => {
      try {
        const workerDoc = await getDoc(doc(db, 'workers', id));
        if (workerDoc.exists()) {
          setWorker(workerDoc.data() as WorkerProfile);
        }

        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            setProfile(profileData);

            // Restrict worker to worker details
            if (profileData.role === 'worker' && id !== currentUser.uid) {
              toast.error('Workers cannot view other worker profiles');
              navigate('/');
              return;
            }
          }

          // Check for any booking
          const q = query(
            collection(db, 'bookings'), 
            where('customerId', '==', currentUser.uid)
          );
          const bookingSnap = await getDocs(q);
          const hasExistingBooking = bookingSnap.docs.some(d => {
            const data = d.data();
            return data.workerId === id;
          });
          setHasBooking(hasExistingBooking);
        }

        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `workers/${id}`);
      }
    };
    fetchWorker();
  }, [id, currentUser, navigate]);

  const handleBooking = async () => {
    if (!currentUser) {
      toast.error('Please login to book');
      navigate('/login');
      return;
    }
    if (!worker) return;

    if (profile?.role === 'worker') {
      toast.error('Workers cannot book services');
      return;
    }

    // Customers pay per booking
    navigate(`/subscription?workerId=${worker.uid}`);
  };

  const handleDeleteWorker = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'workers', id));
      toast.success('Worker profile deleted');
      navigate('/workers');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workers/${id}`);
    }
  };

  if (loading) return <div className="pt-20 text-center">Loading...</div>;
  if (!worker) return <div className="pt-20 text-center">Worker not found</div>;

  const canViewDetails = hasBooking || currentUser?.uid === worker.uid || currentUser?.email === 'vasu.kannaluri@gmail.com';

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-2">Delete Worker Profile?</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this worker profile? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteWorker}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <button onClick={() => navigate(-1)} className="mb-6 p-2 hover:bg-gray-100 rounded-full">
        <ArrowLeft size={24} />
      </button>

      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-bold text-3xl">
            {worker.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{worker.name}</h1>
            <div className="flex items-center gap-1 text-gray-500">
              <MapPin size={16} />
              <span>{worker.area ? t(worker.area) : worker.location}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">{t('experience')}</div>
            <div className="font-bold text-gray-900">{worker.experience}y</div>
          </div>
          <div className="text-center border-l border-gray-100">
            <div className="text-sm text-gray-500 mb-1">{t('rating')}</div>
            <div className="font-bold text-gray-900 flex items-center justify-center gap-1">
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              {worker.rating.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="font-bold text-gray-900 mb-3">{t('skills')}</h3>
          <div className="flex flex-wrap gap-2">
            {worker.skills.map(skill => (
              <span key={skill} className="bg-orange-50 text-orange-700 px-4 py-1.5 rounded-full text-sm font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-8 p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone size={20} className="text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">{t('mobile_number')}</div>
              <div className="font-bold text-gray-900">
                {canViewDetails ? worker.phone : '••••••••••'}
              </div>
            </div>
          </div>
          {canViewDetails ? (
            <a 
              href={`tel:${worker.phone}`}
              className="p-3 bg-white text-orange-600 rounded-xl shadow-sm border border-gray-100 hover:bg-orange-50 transition-colors"
            >
              <Phone size={20} />
            </a>
          ) : (
            <button 
              onClick={handleBooking}
              className="text-xs font-bold text-orange-600 bg-orange-100 px-3 py-2 rounded-lg hover:bg-orange-200 transition-colors"
            >
              Book to View
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => {
              if (canViewDetails) {
                navigate(`/chat/${worker.uid}`);
              } else {
                toast.error('Please book the worker first to enable chat');
              }
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-colors ${canViewDetails ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
          >
            <MessageSquare size={20} />
            {t('chat')}
          </button>
          <button 
            onClick={handleBooking}
            className="flex-[2] flex items-center justify-center gap-2 py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-colors"
          >
            <CheckCircle2 size={20} />
            {t('book_now')}
          </button>
        </div>

        {currentUser?.email === 'vasu.kannaluri@gmail.com' && (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors"
          >
            <Trash2 size={20} />
            {t('delete_worker')}
          </button>
        )}
      </div>
    </div>
  );
};

const JoinWorkerForm = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    skills: '',
    experience: '',
    district: 'nellore',
    area: 'nellore_city',
    location: 'Nellore, AP',
  });

  useEffect(() => {
    if (currentUser) {
      const fetchProfile = async () => {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFormData(prev => ({
            ...prev,
            fullName: data.name || currentUser.displayName || '',
            phone: data.phone || currentUser.phoneNumber || '',
          }));
        }
      };
      fetchProfile();
    }
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const workerData = {
        uid: currentUser.uid,
        name: formData.fullName,
        phone: formData.phone,
        skills: formData.skills.split(',').map(s => s.trim().toLowerCase()),
        experience: Number(formData.experience),
        location: formData.location,
        district: formData.district,
        area: formData.area,
        availability: true,
        rating: 5.0,
        reviewCount: 0
      };

      await setDoc(doc(db, 'workers', currentUser.uid), workerData);
      await updateDoc(doc(db, 'users', currentUser.uid), { 
        role: 'worker',
        name: formData.fullName,
        phone: formData.phone,
        district: formData.district,
        area: formData.area
      });
      
      toast.success('Welcome to the team!');
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workers/${currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('join_as_worker')}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <User size={18} className="text-orange-600" />
            Basic Information
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('full_name')}</label>
            <input 
              required
              type="text" 
              className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
              value={formData.fullName}
              onChange={e => setFormData({...formData, fullName: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('mobile_number')}</label>
            <input 
              required
              type="tel" 
              className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Hammer size={18} className="text-orange-600" />
            Skills & Experience
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('skills')} (comma separated)</label>
            <input 
              required
              type="text" 
              placeholder="Plumbing, Electrical, Painting"
              className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
              value={formData.skills}
              onChange={e => setFormData({...formData, skills: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('experience')} (years)</label>
            <input 
              required
              type="number" 
              className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
              value={formData.experience}
              onChange={e => setFormData({...formData, experience: e.target.value})}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <MapPin size={18} className="text-orange-600" />
            Location
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('district')}</label>
              <select 
                required
                className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.district}
                onChange={e => setFormData({...formData, district: e.target.value})}
              >
                {AP_DISTRICTS.map(dist => (
                  <option key={dist} value={dist}>{t(dist)}</option>
                ))}
              </select>
            </div>
            {formData.district === 'nellore' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('area')}</label>
                <select 
                  required
                  className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.area}
                  onChange={e => setFormData({...formData, area: e.target.value})}
                >
                  {NELLORE_AREAS.map(area => (
                    <option key={area} value={area}>{t(area)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('location')}</label>
            <input 
              required
              type="text" 
              placeholder={t('location_placeholder')}
              className="w-full p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 mt-4 hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : t('submit')}
        </button>
      </form>
    </div>
  );
};

const BookingsView = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<(Booking & { otherPartyName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    let q;
    if (currentUser.email === 'vasu.kannaluri@gmail.com') {
      // Admin sees all bookings
      q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, async (snap) => {
        const b = await Promise.all(snap.docs.map(async d => {
          const data = d.data() as Booking;
          const workerDoc = await getDoc(doc(db, 'users', data.workerId));
          const customerDoc = await getDoc(doc(db, 'users', data.customerId));
          return { 
            ...data, 
            id: d.id, 
            otherPartyName: `From: ${customerDoc.data()?.name || 'Customer'} To: ${workerDoc.data()?.name || 'Worker'}` 
          };
        }));
        setBookings(b);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Regular user/worker sees their own
      const q1 = query(collection(db, 'bookings'), where('customerId', '==', currentUser.uid));
      const q2 = query(collection(db, 'bookings'), where('workerId', '==', currentUser.uid));

      const unsub1 = onSnapshot(q1, async (snap) => {
        const b1 = await Promise.all(snap.docs.map(async d => {
          const data = d.data() as Booking;
          const workerDoc = await getDoc(doc(db, 'users', data.workerId));
          return { ...data, id: d.id, otherPartyName: workerDoc.data()?.name || 'Worker' };
        }));
        setBookings(prev => {
          const filtered = prev.filter(b => b.workerId === currentUser.uid);
          const combined = [...filtered, ...b1];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        });
        setLoading(false);
      });

      const unsub2 = onSnapshot(q2, async (snap) => {
        const b2 = await Promise.all(snap.docs.map(async d => {
          const data = d.data() as Booking;
          const customerDoc = await getDoc(doc(db, 'users', data.customerId));
          return { ...data, id: d.id, otherPartyName: customerDoc.data()?.name || 'Customer' };
        }));
        setBookings(prev => {
          const filtered = prev.filter(b => b.customerId === currentUser.uid);
          const combined = [...filtered, ...b2];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          return unique.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        });
        setLoading(false);
      });

      return () => { unsub1(); unsub2(); };
    }
  }, [currentUser]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { 
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${id}`);
    }
  };

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('my_bookings')}</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{booking.service}</h3>
                  <p className="text-sm text-gray-500">{booking.otherPartyName}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {t(booking.status)}
                </span>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Link 
                  to={`/chat/${currentUser?.uid === booking.workerId ? booking.customerId : booking.workerId}`}
                  className="flex-1 py-2 bg-orange-100 text-orange-600 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} />
                  Chat
                </Link>
              </div>

              {currentUser?.uid === booking.workerId && booking.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => updateStatus(booking.id, 'accepted')}
                    className="flex-1 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold"
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => updateStatus(booking.id, 'cancelled')}
                    className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold"
                  >
                    Decline
                  </button>
                </div>
              )}

              {booking.status === 'accepted' && (
                <button 
                  onClick={() => updateStatus(booking.id, 'in-progress')}
                  className="w-full mt-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold"
                >
                  Start Work
                </button>
              )}

              {booking.status === 'in-progress' && (
                <button 
                  onClick={() => updateStatus(booking.id, 'completed')}
                  className="w-full mt-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold"
                >
                  Mark Completed
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BookingHistoryView = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<(Booking & { otherPartyName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'past' | 'cancelled'>('current');

  useEffect(() => {
    if (!currentUser) return;

    const q1 = query(collection(db, 'bookings'), where('customerId', '==', currentUser.uid));
    const q2 = query(collection(db, 'bookings'), where('workerId', '==', currentUser.uid));

    const unsub1 = onSnapshot(q1, async (snap) => {
      const b1 = await Promise.all(snap.docs.map(async d => {
        const data = d.data() as Booking;
        const workerDoc = await getDoc(doc(db, 'users', data.workerId));
        return { ...data, id: d.id, otherPartyName: workerDoc.data()?.name || 'Worker' };
      }));
      setBookings(prev => {
        const filtered = prev.filter(b => b.workerId === currentUser.uid);
        return [...filtered, ...b1].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      });
      setLoading(false);
    });

    const unsub2 = onSnapshot(q2, async (snap) => {
      const b2 = await Promise.all(snap.docs.map(async d => {
        const data = d.data() as Booking;
        const customerDoc = await getDoc(doc(db, 'users', data.customerId));
        return { ...data, id: d.id, otherPartyName: customerDoc.data()?.name || 'Customer' };
      }));
      setBookings(prev => {
        const filtered = prev.filter(b => b.customerId === currentUser.uid);
        return [...filtered, ...b2].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      });
      setLoading(false);
    });

    return () => { unsub1(); unsub2(); };
  }, [currentUser]);

  const filteredBookings = useMemo(() => {
    if (activeTab === 'current') {
      return bookings.filter(b => ['pending', 'accepted', 'in-progress'].includes(b.status));
    } else if (activeTab === 'past') {
      return bookings.filter(b => b.status === 'completed');
    } else {
      return bookings.filter(b => b.status === 'cancelled');
    }
  }, [bookings, activeTab]);

  const handleRate = async (bookingId: string, workerId: string, rating: number) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { rating });
      
      const workerRef = doc(db, 'workers', workerId);
      const workerSnap = await getDoc(workerRef);
      if (workerSnap.exists()) {
        const data = workerSnap.data() as WorkerProfile;
        const newReviewCount = (data.reviewCount || 0) + 1;
        const newRating = ((data.rating || 0) * (data.reviewCount || 0) + rating) / newReviewCount;
        
        await updateDoc(workerRef, {
          rating: Number(newRating.toFixed(1)),
          reviewCount: newReviewCount
        });
      }
      toast.success(t('rating_submitted'));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('booking_history')}</h1>
      
      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-2xl">
        {(['current', 'past', 'cancelled'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t(`${tab}_bookings`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
              <Clock className="mx-auto text-gray-300 mb-2" size={48} />
              <p className="text-gray-500">{t('no_bookings')}</p>
            </div>
          ) : (
            filteredBookings.map(booking => (
              <div key={booking.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{booking.service}</h3>
                    <p className="text-sm text-gray-500">{booking.otherPartyName}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {booking.createdAt?.toDate ? booking.createdAt.toDate().toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                    booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {t(booking.status)}
                  </span>
                </div>

                <div className="flex gap-2 mt-4 mb-4">
                  <Link 
                    to={`/chat/${currentUser?.uid === booking.workerId ? booking.customerId : booking.workerId}`}
                    className="flex-1 py-2 bg-orange-100 text-orange-600 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Chat
                  </Link>
                </div>

                {booking.status === 'completed' && currentUser?.uid === booking.customerId && !booking.rating && (
                  <div className="mt-4 pt-4 border-t border-gray-50">
                    <p className="text-sm font-bold text-gray-700 mb-3">{t('rate_worker')}</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => handleRate(booking.id, booking.workerId, star)}
                          className="p-1 text-gray-300 hover:text-yellow-400 transition-colors"
                        >
                          <Star size={24} fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {booking.rating && (
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700">{t('rating')}:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          size={16} 
                          fill={star <= booking.rating! ? "#EAB308" : "none"} 
                          className={star <= booking.rating! ? "text-yellow-500" : "text-gray-300"}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ChatView = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const { id: otherId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [otherName, setOtherName] = useState('');

  const chatId = useMemo(() => {
    if (!currentUser || !otherId) return '';
    return [currentUser.uid, otherId].sort().join('_');
  }, [currentUser, otherId]);

  useEffect(() => {
    if (!chatId || !otherId || !currentUser) return;

    const fetchOther = async () => {
      const d = await getDoc(doc(db, 'users', otherId));
      const otherData = d.data() as UserProfile;
      setOtherName(otherData?.name || 'User');

      // Restrict worker to worker chat
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const myData = userDoc.data() as UserProfile;
      if (myData.role === 'worker' && otherData?.role === 'worker' && currentUser.uid !== otherId) {
        toast.error('Workers cannot chat with other workers');
        navigate('/');
        return;
      }
    };
    fetchOther();

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id } as ChatMessage)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => unsubscribe();
  }, [chatId, otherId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !currentUser || !chatId) return;

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: currentUser.uid,
        text: text.trim(),
        createdAt: serverTimestamp()
      });
      setText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
    }
  };

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto h-screen flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">{otherName}</h1>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {messages.map(msg => (
          <div 
            key={msg.id}
            className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-2xl ${
              msg.senderId === currentUser?.uid 
                ? 'bg-orange-600 text-white rounded-tr-none' 
                : 'bg-gray-100 text-gray-900 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input 
          type="text" 
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
        />
        <button 
          type="submit"
          className="p-4 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-200"
        >
          <MessageSquare size={24} />
        </button>
      </form>
    </div>
  );
};

const ProfileView = ({ user, profile }: { user: FirebaseUser | null, profile: UserProfile | null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('profile')}</h1>
        {user?.email === 'vasu.kannaluri@gmail.com' && (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full flex items-center gap-1">
            <Shield size={12} />
            ADMIN MODE
          </span>
        )}
      </div>
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-bold text-2xl">
            {profile?.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.name}</h2>
            <p className="text-sm text-gray-500 capitalize">{profile?.role}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Subscription</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trialing' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                <p className="font-medium text-gray-900 capitalize">{profile?.subscriptionStatus || 'None'}</p>
              </div>
              <button 
                onClick={() => navigate('/subscription')}
                className="text-sm font-bold text-orange-600 hover:text-orange-700"
              >
                {profile?.subscriptionStatus === 'active' || profile?.subscriptionStatus === 'trialing' ? 'Manage' : 'Upgrade'}
              </button>
            </div>
            {profile?.trialEndDate && (profile?.subscriptionStatus === 'trialing' || profile?.subscriptionStatus === 'active') && (
              <p className="text-[10px] text-gray-400 mt-1">
                Trial ends: {profile.trialEndDate instanceof Date ? profile.trialEndDate.toLocaleDateString() : 
                           profile.trialEndDate?.toDate ? profile.trialEndDate.toDate().toLocaleDateString() : 'Soon'}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('email')}</p>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          {profile?.phone && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('mobile_number')}</p>
              <p className="font-medium text-gray-900">{profile.phone}</p>
            </div>
          )}
          {(profile?.district || profile?.area) && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{t('location')}</p>
              <p className="font-medium text-gray-900">
                {profile.area ? t(profile.area) : ''}{profile.area && profile.district ? ', ' : ''}{profile.district ? t(profile.district) : ''}
              </p>
            </div>
          )}
        </div>

        <button 
          onClick={() => navigate('/booking-history')}
          className="w-full py-4 bg-gray-50 text-gray-700 rounded-2xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          <Clock size={20} />
          {t('booking_history')}
        </button>

        {profile?.role === 'customer' ? (
          <button 
            onClick={() => navigate('/join')}
            className="w-full py-4 bg-orange-50 text-orange-600 rounded-2xl font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {t('join_as_worker')}
          </button>
        ) : (
          <button 
            onClick={() => navigate(`/worker/${user?.uid}`)}
            className="w-full py-4 bg-orange-50 text-orange-600 rounded-2xl font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
          >
            <User size={20} />
            {t('view_worker_profile')}
          </button>
        )}

        {user?.email === 'vasu.kannaluri@gmail.com' && (
          <button 
            onClick={() => navigate('/workers')}
            className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
          >
            <Shield size={20} />
            Manage Workers
          </button>
        )}

        <button 
          onClick={async () => {
            await signOut(auth);
            navigate('/');
          }}
          className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={20} />
          {t('logout')}
        </button>
      </div>
    </div>
  );
};

const SubscriptionView = ({ currentUser, profile }: { currentUser: FirebaseUser | null, profile: UserProfile | null }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workerId = searchParams.get('workerId');

  const isWorker = profile?.role === 'worker';
  const price = isWorker ? '₹149' : '₹9';

  const handleSubscribe = async () => {
    if (!currentUser) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          email: currentUser.email,
          mode: isWorker ? 'subscription' : 'payment',
          workerId: workerId
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error(session.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-24 pb-32 px-6 max-w-lg mx-auto">
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Zap className="text-orange-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isWorker ? 'Premium Subscription' : 'Booking Pass'}
        </h1>
        <p className="text-gray-500 mb-8">
          {isWorker ? 'Get unlimited access to all workers and priority support.' : 'Pay securely to confirm your booking and get priority service.'}
        </p>
        
        <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-green-500" size={20} />
            <span className="text-sm font-medium text-gray-700">
              {isWorker ? 'Unlimited Service Bookings' : '1 Confirmed Booking'}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-green-500" size={20} />
            <span className="text-sm font-medium text-gray-700">Direct Chat with Workers</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-500" size={20} />
            <span className="text-sm font-medium text-gray-700">Verified Worker Profiles</span>
          </div>
        </div>

        <div className="mb-8">
          <span className="text-4xl font-bold text-gray-900">{price}</span>
          <span className="text-gray-500">{isWorker ? '/month' : '/booking'}</span>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all disabled:opacity-50"
        >
          {loading ? 'Processing...' : (isWorker ? 'Subscribe Now' : 'Pay ₹9 per Booking')}
        </button>
        <p className="text-xs text-gray-400 mt-4">
          {isWorker ? 'Cancel anytime. No commitment.' : 'Secure payment via Stripe.'}
        </p>
      </div>
    </div>
  );
};

const SuccessView = ({ currentUser }: { currentUser: FirebaseUser | null }) => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const workerId = searchParams.get('workerId');
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser && sessionId) {
      const processSuccess = async () => {
        try {
          if (workerId) {
            // It's a per-booking payment
            const workerDoc = await getDoc(doc(db, 'workers', workerId));
            if (workerDoc.exists()) {
              const worker = workerDoc.data();
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              const profile = userDoc.data();
              
              const bookingData = {
                customerId: currentUser.uid,
                workerId: worker.uid,
                customerName: profile?.name || currentUser.displayName || 'Customer',
                workerName: worker.name,
                service: worker.skills[0],
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              };
              await addDoc(collection(db, 'bookings'), bookingData);
              toast.success('Booking confirmed and paid!');
              navigate('/bookings');
            }
          } else {
            // It's a worker subscription
            await updateDoc(doc(db, 'users', currentUser.uid), {
              subscriptionStatus: 'active',
              trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            });
            toast.success('Subscription activated!');
          }
        } catch (error) {
          console.error('Error processing success:', error);
        }
      };
      processSuccess();
    }
  }, [currentUser, sessionId, workerId, navigate]);

  return (
    <div className="pt-24 pb-32 px-6 max-w-lg mx-auto text-center">
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="text-green-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-500 mb-8">
          {workerId ? 'Your booking has been confirmed. You can now chat with the worker.' : 'Your premium subscription is now active. Enjoy all the benefits!'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
};

const CancelView = () => {
  const navigate = useNavigate();
  return (
    <div className="pt-24 pb-32 px-6 max-w-lg mx-auto text-center">
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <X className="text-red-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-500 mb-8">Your payment was cancelled. No charges were made.</p>
        <button
          onClick={() => navigate('/subscription')}
          className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: u.uid,
              name: u.displayName || 'User',
              role: 'customer',
              location: 'Nellore, AP',
              area: 'nellore_city',
              subscriptionStatus: 'trialing',
              trialEndDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days free trial
              createdAt: serverTimestamp()
            };
            try {
              await setDoc(doc(db, 'users', u.uid), newProfile);
              setProfile(newProfile);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${u.uid}`);
            }
          } else {
            setProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
          <Navbar user={user} profile={profile} />
          
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<HomeView />} />
              <Route path="/workers" element={<WorkerListView currentUser={user} />} />
              <Route path="/worker/:id" element={<WorkerProfileView currentUser={user} />} />
              <Route path="/join" element={<JoinWorkerForm currentUser={user} />} />
              <Route path="/login" element={<LoginView />} />
              <Route path="/bookings" element={user ? <BookingsView currentUser={user} /> : <Navigate to="/" />} />
              <Route path="/chat/:id" element={user ? <ChatView currentUser={user} /> : <Navigate to="/" />} />
              <Route path="/profile" element={<ProfileView user={user} profile={profile} />} />
              <Route path="/booking-history" element={user ? <BookingHistoryView currentUser={user} /> : <Navigate to="/" />} />
              <Route path="/subscription" element={<SubscriptionView currentUser={user} profile={profile} />} />
              <Route path="/subscription/success" element={<SuccessView currentUser={user} />} />
              <Route path="/subscription/cancel" element={<CancelView />} />
            </Routes>
          </AnimatePresence>

          {/* Bottom Navigation */}
          {user && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50">
              <Link to="/" className="flex flex-col items-center gap-1 text-orange-600">
                <Home size={24} />
                <span className="text-[10px] font-bold">Home</span>
              </Link>
              <Link to="/workers" className="flex flex-col items-center gap-1 text-gray-400 hover:text-orange-600 transition-colors">
                <Search size={24} />
                <span className="text-[10px] font-bold">Find</span>
              </Link>
              <Link to="/bookings" className="flex flex-col items-center gap-1 text-gray-400 hover:text-orange-600 transition-colors">
                <Clock size={24} />
                <span className="text-[10px] font-bold">Bookings</span>
              </Link>
              <Link to="/profile" className="flex flex-col items-center gap-1 text-gray-400 hover:text-orange-600 transition-colors">
                <User size={24} />
                <span className="text-[10px] font-bold">Profile</span>
              </Link>
              {user.email === 'vasu.kannaluri@gmail.com' && (
                <Link to="/workers" className="flex flex-col items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors">
                  <Shield size={24} />
                  <span className="text-[10px] font-bold">Manage</span>
                </Link>
              )}
            </div>
          )}
          
          <Toaster position="bottom-center" />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
