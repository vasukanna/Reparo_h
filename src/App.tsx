import React, { useState, useEffect, useMemo, ReactNode } from 'react';
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
  service: string;
  status: 'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: any;
  updatedAt: any;
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
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phone.startsWith('+') ? phone : `+91${phone}`, appVerifier);
      setVerificationId(confirmation);
      toast.success('OTP sent to your mobile!');
    } catch (error: any) {
      toast.error(error.message);
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!verificationId) return;
      const result = await verificationId.confirm(otp);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          name: name || result.user.displayName || 'User',
          phone: phone,
          role: 'customer',
          createdAt: serverTimestamp()
        });
      }
      toast.success('Login successful!');
      navigate('/');
    } catch (error: any) {
      toast.error('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          name: name,
          email: email,
          phone: phone,
          role: 'customer',
          createdAt: serverTimestamp()
        });
        toast.success('Account created!');
      }
      navigate('/');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

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
      }
      navigate('/');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="pt-24 pb-24 px-4 max-w-lg mx-auto">
      <div id="recaptcha-container"></div>
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold mb-2">{isLogin ? t('login') : t('signup')}</h1>
        <p className="text-gray-500 mb-8 text-sm">
          {isLogin ? 'Welcome back to ReparoH' : 'Join our community of workers and customers'}
        </p>

        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-2xl">
          <button 
            onClick={() => { setAuthMethod('email'); setVerificationId(null); }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMethod === 'email' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}
          >
            Email
          </button>
          <button 
            onClick={() => { setAuthMethod('phone'); setVerificationId(null); }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMethod === 'phone' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`}
          >
            Mobile
          </button>
        </div>

        {authMethod === 'email' ? (
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    required
                    type="text" 
                    placeholder={t('full_name')}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    required
                    type="tel" 
                    placeholder={t('mobile_number')}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                required
                type="email" 
                placeholder={t('email')}
                className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                required
                type="password" 
                placeholder={t('password')}
                className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : (isLogin ? t('login') : t('signup'))}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {!verificationId ? (
              <form onSubmit={handlePhoneSignIn} className="space-y-4">
                {!isLogin && (
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      required
                      type="text" 
                      placeholder={t('full_name')}
                      className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                )}
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    required
                    type="tel" 
                    placeholder="Mobile Number (with +91)"
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    required
                    type="text" 
                    placeholder="Enter 6-digit OTP"
                    className="w-full pl-12 pr-4 py-4 bg-gray-100 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 outline-none"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '...' : 'Verify OTP'}
                </button>
                <button 
                  type="button"
                  onClick={() => setVerificationId(null)}
                  className="w-full text-sm text-gray-500 font-medium"
                >
                  Change Number
                </button>
              </form>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-gray-100"></div>
          <span className="text-xs text-gray-400 font-medium">{t('or')}</span>
          <div className="flex-1 h-px bg-gray-100"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          {t('login_google')}
        </button>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-orange-600 hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
        </div>
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
              onClick={() => signOut(auth)}
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
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 gap-2"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
  </motion.button>
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

const WorkerListView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const initialDistrict = searchParams.get('district') || 'nellore';
  const initialArea = searchParams.get('area') || 'all';
  
  const [workers, setWorkers] = useState<(WorkerProfile & { userLocation: string })[]>([]);
  const [loading, setLoading] = useState(true);
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
    let q = query(collection(db, 'workers'), where('availability', '==', true));
    if (category) {
      q = query(q, where('skills', 'array-contains', category));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const workerData = snapshot.docs.map((workerDoc) => {
        const data = workerDoc.data() as WorkerProfile;
        return {
          ...data,
          userLocation: data.location,
        };
      });
      setWorkers(workerData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workers');
    });

    return () => unsubscribe();
  }, [category]);

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const districtMatch = selectedDistrict === 'all' || w.district === selectedDistrict;
      const areaMatch = selectedArea === 'all' || w.area === selectedArea;
      
      let searchMatch = true;
      if (search) {
        const term = search.toLowerCase();
        searchMatch = w.name.toLowerCase().includes(term) || 
                      w.skills.some(s => s.toLowerCase().includes(term));
      }
      
      return districtMatch && areaMatch && searchMatch;
    });
  }, [workers, selectedDistrict, selectedArea, search]);

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
              onClick={() => navigate(`/worker/${worker.uid}`)}
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
                  <span>{worker.phone}</span>
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
  const [worker, setWorker] = useState<(WorkerProfile & { name: string, phone: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchWorker = async () => {
      try {
        const workerDoc = await getDoc(doc(db, 'workers', id));
        if (workerDoc.exists()) {
          setWorker(workerDoc.data() as WorkerProfile);
        }
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `workers/${id}`);
      }
    };
    fetchWorker();
  }, [id]);

  const handleBooking = async () => {
    if (!currentUser) {
      toast.error('Please login to book');
      return;
    }
    if (!worker) return;

    try {
      const bookingData = {
        customerId: currentUser.uid,
        workerId: worker.uid,
        service: worker.skills[0],
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'bookings'), bookingData);
      toast.success('Booking request sent!');
      navigate('/bookings');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    }
  };

  const handleDeleteWorker = async () => {
    if (!id) return;
    const confirmed = confirm('Are you sure you want to delete this worker profile?');
    if (!confirmed) return;
    
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

  return (
    <div className="pt-20 pb-24 px-4 max-w-lg mx-auto">
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
              <div className="font-bold text-gray-900">{worker.phone}</div>
            </div>
          </div>
          <a 
            href={`tel:${worker.phone}`}
            className="p-3 bg-white text-orange-600 rounded-xl shadow-sm border border-gray-100 hover:bg-orange-50 transition-colors"
          >
            <Phone size={20} />
          </a>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => navigate(`/chat/${worker.uid}`)}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-100 text-gray-900 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
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
            onClick={handleDeleteWorker}
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
      return;
    }

    try {
      const workerData = {
        uid: currentUser.uid,
        name: formData.fullName,
        phone: formData.phone,
        skills: formData.skills.split(',').map(s => s.trim()),
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
          className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 mt-4 hover:bg-orange-700 transition-colors"
        >
          {t('submit')}
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

    // We need to query where customerId == uid OR workerId == uid
    // Firestore doesn't support OR across fields easily without multiple queries or composite indexes
    // For simplicity in MVP, we'll fetch both and combine
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
    if (!chatId || !otherId) return;

    const fetchOther = async () => {
      const d = await getDoc(doc(db, 'users', otherId));
      setOtherName(d.data()?.name || 'User');
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
          onClick={() => signOut(auth)}
          className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={20} />
          {t('logout')}
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
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
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
              <Route path="/workers" element={<WorkerListView />} />
              <Route path="/worker/:id" element={<WorkerProfileView currentUser={user} />} />
              <Route path="/join" element={<JoinWorkerForm currentUser={user} />} />
              <Route path="/login" element={<LoginView />} />
              <Route path="/bookings" element={user ? <BookingsView currentUser={user} /> : <Navigate to="/" />} />
              <Route path="/chat/:id" element={user ? <ChatView currentUser={user} /> : <Navigate to="/" />} />
              <Route path="/profile" element={<ProfileView user={user} profile={profile} />} />
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
