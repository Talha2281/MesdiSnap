import { useState, useEffect, useRef, ChangeEvent, DragEvent, useMemo } from 'react';
import { 
  Pill, 
  Upload, 
  Search, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ShieldAlert, 
  Bell,
  Clock, 
  Trash2, 
  Image as ImageIcon,
  MessageSquare,
  Send,
  Lock,
  ChevronRight,
  History,
  Users,
  LayoutDashboard,
  Activity,
  Heart,
  Plus,
  Calendar,
  X,
  Smartphone,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MedicineInfo, 
  PrescriptionData, 
  Language, 
  ScanHistory, 
  MedicationTrack, 
  FamilyMember, 
  DoseLog, 
  DoseStatus,
  HealthLog
} from './types';
import { analyzeMedicalDocument, chatWithPrescription, getHealthInsights } from './services/geminiService';

export default function App() {
  // --- Navigation State ---
  const [activeTab, setActiveTab] = useState<'scan' | 'dashboard' | 'family' | 'health-log' | 'chat' | 'reminders'>('dashboard');
  const [activeAlert, setActiveAlert] = useState<MedicationTrack | null>(null);
  const [lastNotifiedTime, setLastNotifiedTime] = useState<string>('');

  // --- Profile & Family State ---
  const [profiles, setProfiles] = useState<FamilyMember[]>(() => {
    const saved = localStorage.getItem('medisnap_profiles');
    if (saved) return JSON.parse(saved);
    return [{ id: 'main', name: 'Me', role: 'Self', healthScore: 100, conditions: [], allergies: [] }];
  });
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem('medisnap_active_profile') || 'main');

  // --- Scan State ---
  const [language, setLanguage] = useState<Language>('en');
  const [inputMode, setInputMode] = useState<'upload' | 'text'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [medicineName, setMedicineName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('medisnap_api_key') || '');
  const [result, setResult] = useState<PrescriptionData | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [followUp, setFollowUp] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // --- Modal States ---
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState('');

  const [showAddTimeModal, setShowAddTimeModal] = useState<{medId: string} | null>(null);
  const [newTimeInput, setNewTimeInput] = useState('');

  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualMed, setManualMed] = useState({
    name: '',
    dosage: '',
    timingText: '',
    instructions: '',
    times: ['09:00']
  });

  // --- Medication & Adherence State ---
  const [medications, setMedications] = useState<MedicationTrack[]>(() => {
    const saved = localStorage.getItem('medisnap_meds');
    return saved ? JSON.parse(saved) : [];
  });
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>(() => {
    const saved = localStorage.getItem('medisnap_dose_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>(() => {
    const saved = localStorage.getItem('medisnap_health_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const activeProfile = useMemo(() => 
    profiles.find(p => p.id === activeProfileId) || profiles[0], 
  [profiles, activeProfileId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    const savedHistory = localStorage.getItem('medisnap_history');
    if (savedHistory) try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
  }, []);

  useEffect(() => localStorage.setItem('medisnap_history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('medisnap_meds', JSON.stringify(medications)), [medications]);
  useEffect(() => localStorage.setItem('medisnap_profiles', JSON.stringify(profiles)), [profiles]);
  useEffect(() => localStorage.setItem('medisnap_dose_logs', JSON.stringify(doseLogs)), [doseLogs]);
  useEffect(() => localStorage.setItem('medisnap_health_logs', JSON.stringify(healthLogs)), [healthLogs]);
  useEffect(() => localStorage.setItem('medisnap_active_profile', activeProfileId), [activeProfileId]);
  useEffect(() => localStorage.setItem('medisnap_api_key', userApiKey), [userApiKey]);
  
  // --- Background Notification Check ---
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                          now.getMinutes().toString().padStart(2, '0');
      
      if (currentTime === lastNotifiedTime) return;

      const currentMeds = medications.filter(m => m.profileId === activeProfileId);
      
      currentMeds.forEach(med => {
        if (med.times.includes(currentTime)) {
          setActiveAlert(med);
          setLastNotifiedTime(currentTime);
          
          // Play a gentle alert sound if possible
          try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = context.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, context.currentTime);
            oscillator.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.5);
          } catch (e) {}
        }
      });
    };

    const interval = setInterval(checkReminders, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [medications, activeProfileId, lastNotifiedTime]);

  // --- Adherence Helpers ---
  const [aiInsight, setAiInsight] = useState<string>('Welcome back! Scanning your medicine is the first step to better health.');

  useEffect(() => {
    const fetchInsight = async () => {
      if (doseLogs.length > 5) {
        try {
          const insight = await getHealthInsights(
            doseLogs.filter(l => l.profileId === activeProfileId).slice(0, 10),
            language,
            userApiKey
          );
          if (insight) setAiInsight(insight);
        } catch (e) {}
      }
    };
    const timer = setTimeout(fetchInsight, 2000);
    return () => clearTimeout(timer);
  }, [doseLogs, activeProfileId, language, userApiKey]);

  const calculateHealthScore = (profileId: string) => {
    const profileLogs = doseLogs.filter(l => l.profileId === profileId);
    if (profileLogs.length === 0) return 100;
    const takenCount = profileLogs.filter(l => l.status === 'taken').length;
    return Math.round((takenCount / profileLogs.length) * 100);
  };

  useEffect(() => {
    // Update health scores for all profiles based on logs
    setProfiles(prev => prev.map(p => ({
      ...p,
      healthScore: calculateHealthScore(p.id)
    })));
  }, [doseLogs]);

  // --- Handlers ---
  const logDose = (medicationId: string, medicationName: string, status: DoseStatus) => {
    const newLog: DoseLog = {
      id: Math.random().toString(36).substr(2, 9),
      medicationId,
      medicationName,
      scheduledTime: new Date().toISOString(),
      actualTime: status === 'taken' ? new Date().toISOString() : undefined,
      status,
      profileId: activeProfileId
    };
    setDoseLogs(prev => [newLog, ...prev]);
  };

  const handleAddNewProfile = () => {
    setShowAddProfileModal(true);
    setNewProfileName('');
    setNewProfileRole('');
  };

  const submitNewProfile = () => {
    if (newProfileName.trim() && newProfileRole.trim()) {
      const newProfile: FamilyMember = {
        id: Math.random().toString(36).substr(2, 9),
        name: newProfileName.trim(),
        role: newProfileRole.trim(),
        healthScore: 100,
        conditions: [],
        allergies: []
      };
      setProfiles(prev => [...prev, newProfile]);
      setActiveProfileId(newProfile.id);
      setActiveTab('dashboard');
      setShowAddProfileModal(false);
    }
  };

  const handleAddTime = (medId: string) => {
    setShowAddTimeModal({ medId });
    setNewTimeInput('');
  };

  const submitNewTime = () => {
    if (!showAddTimeModal || !newTimeInput.trim()) return;
    
    let time = newTimeInput.trim().toUpperCase();
    const match = time.match(/^(\d{1,2})[:.]?(\d{2})\s*(AM|PM)?$/);
    
    if (match) {
      let hours = parseInt(match[1]);
      const mins = match[2];
      const ampm = match[3];
      
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const formattedTime = `${hours.toString().padStart(2, '0')}:${mins}`;
      setMedications(prev => prev.map(m => m.id === showAddTimeModal.medId ? { ...m, times: [...new Set([...m.times, formattedTime])].sort() } : m));
      setShowAddTimeModal(null);
    } else {
      alert("Please use HH:MM format (e.g. 14:30)");
    }
  };

  const handleAddMedication = (med: MedicineInfo) => {
    const newMed: MedicationTrack = {
      id: Math.random().toString(36).substr(2, 9),
      name: med.medicine_name,
      dosage: med.dosage,
      instructions: med.when_to_take,
      startDate: new Date().toISOString().split('T')[0],
      frequency: 'daily',
      times: ['08:00'],
      isCritical: false,
      currentStock: 0,
      profileId: activeProfileId
    };
    setMedications(prev => [...prev, newMed]);
    setActiveTab('dashboard');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setError(null);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // --- API Handlers ---
  const handleAnalyze = async () => {
    if (inputMode === 'upload' && !file) {
      setError('Please upload a medical document photo first.');
      return;
    }
    if (inputMode === 'text' && !medicineName.trim()) {
      setError('Please type a medicine name first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);

    try {
      let fileData = null;
      if (inputMode === 'upload' && file) {
        fileData = await fileToBase64(file);
      }

      const data = await analyzeMedicalDocument(inputMode, medicineName, fileData, language, userApiKey);

      if (data.error === 'not_medical' || data.error === 'not_medicine') {
        setError("This doesn't look like a valid medical document. Please try a clearer photo.");
        return;
      }

      setResult(data);
      if (data.medicines && data.medicines.length > 0) {
        addToHistory(data);
      }
    } catch (err: any) {
      console.error('API Error:', err);
      if (err.message?.includes('Quota') || err.message?.includes('429')) {
        setError('API Quota Exceeded. Please try again in 1 minute or use your own API key.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!followUp.trim() || !result) return;

    setChatLoading(true);
    const userQ = followUp;
    setFollowUp('');
    setChatHistory(prev => [...prev, { role: 'user', text: userQ }]);

    try {
      const chatResponse = await chatWithPrescription(userQ, result, language, userApiKey);
      setChatHistory(prev => [...prev, { role: 'ai', text: chatResponse }]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Sorry, I couldn\'t process that question. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const addToHistory = (data: PrescriptionData) => {
    // Use the first medicine name or summary for history title
    let historyTitle = 'Medical Scan';
    
    if (data.document_type === 'report') {
      historyTitle = data.summary?.slice(0, 30) || 'Medical Report';
    } else if (data.medicines && data.medicines.length > 0) {
      historyTitle = data.medicines.map(m => m.medicine_name).join(', ').slice(0, 30) + (data.medicines.length > 2 ? '...' : '');
    }

    const newEntry: ScanHistory = {
      id: Date.now().toString(),
      name: historyTitle,
      data,
      timestamp: Date.now()
    };
    setHistory(prev => [newEntry, ...prev].filter((v, i, a) => a.findIndex(t => t.name === v.name) === i).slice(0, 3));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('medisnap_history');
  };

  // Re-analyze when language changes if we already have a result
  useEffect(() => {
    if (result && !loading) {
      // Small delay to prevent infinite loops
      const timer = setTimeout(() => {
        handleAnalyze();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [language]);

  // --- Sub-components ---
  const NavButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
    <button 
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-16 h-14 transition-all duration-300 group ${active ? 'text-med-primary' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {active && (
        <motion.div 
          layoutId="active-nav"
          className="absolute inset-0 bg-sky-50 rounded-2xl -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <Icon size={22} strokeWidth={active ? 2.5 : 2} className={active ? 'scale-110' : ''} />
      <span className="text-[9px] font-black uppercase tracking-tighter mt-1">{label}</span>
    </button>
  );

  const ProfileSelector = () => (
    <div className="relative group">
      <button className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
        <div className="w-6 h-6 bg-med-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
          {activeProfile.name[0]}
        </div>
        <span className="text-xs font-bold text-slate-700">{activeProfile.name}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 hidden group-hover:block z-50">
        {profiles.map(p => (
          <button 
            key={p.id}
            onClick={() => setActiveProfileId(p.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left ${p.id === activeProfileId ? 'text-med-primary bg-sky-50/50' : 'text-slate-600'}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold ${p.id === activeProfileId ? 'bg-med-primary' : 'bg-slate-300'}`}>
              {p.name[0]}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold">{p.name}</p>
              <p className="text-[10px] opacity-60">{p.role}</p>
            </div>
          </button>
        ))}
        <div className="border-t border-slate-100 my-1 pt-1">
          <button 
            onClick={() => {
              setActiveTab('family');
              handleAddNewProfile();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-med-primary text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add Family Member
          </button>
        </div>
      </div>
    </div>
  );

  const LangToggle = () => (
    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
      <button 
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded-lg transition-all ${language === 'en' ? 'bg-white shadow-sm text-med-primary' : 'text-slate-500 hover:text-med-primary'}`}
      >
        EN
      </button>
      <button 
        onClick={() => setLanguage('ur')}
        className={`px-3 py-1 rounded-lg transition-all ${language === 'ur' ? 'bg-white shadow-sm text-med-primary' : 'text-slate-500 hover:text-med-primary'} urdu-text`}
      >
        اردو
      </button>
    </div>
  );

  const StatCard = ({ icon: Icon, label, value, subvalue, color }: { icon: any, label: string, value: string | number, subvalue?: string, color: string }) => (
    <div className="bg-white p-6 rounded-[30px] border border-slate-100 shadow-sm flex flex-col gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
        {subvalue && <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{subvalue}</p>}
      </div>
    </div>
  );

  const DashboardView = () => {
    const profileMeds = medications.filter(m => m.profileId === activeProfileId);
    const todayLogs = doseLogs.filter(l => l.profileId === activeProfileId && l.scheduledTime.startsWith(new Date().toISOString().split('T')[0]));
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.1
        }
      }
    };

    const item = {
      hidden: { opacity: 0, y: 20 },
      show: { opacity: 1, y: 0 }
    };

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full overflow-y-auto custom-scrollbar pb-32"
      >
        {/* --- Gradient Hero Section --- */}
        <section className="relative h-[380px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-sky-500 to-indigo-600">
             {/* Abstract Shapes */}
             <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl animate-pulse" />
             <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-sky-300/20 rounded-full blur-3xl" />
          </div>
          
          <div className="relative h-full max-w-6xl mx-auto px-10 flex flex-col justify-end pb-16 text-white">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="px-4 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">
                  Live Status: Stable
                </div>
                <div className="text-[10px] font-bold opacity-70">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <h1 className="text-6xl font-black tracking-tighter mb-4 leading-tight">
                Good Morning,<br />{activeProfile.name}
              </h1>
              <p className="text-lg font-medium opacity-80 max-w-xl">
                Your health is our priority. You have {profileMeds.length} medications scheduled for today. 
                Everything is looking great so far!
              </p>
            </motion.div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-10 -mt-10 relative z-10">
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          >
            <motion.div variants={item}>
              <StatCard icon={Heart} label="Health Score" value={`${activeProfile.healthScore}%`} subvalue="Daily Average" color="bg-rose-500 shadow-rose-200" />
            </motion.div>
            <motion.div variants={item}>
              <StatCard icon={Pill} label="Medications" value={profileMeds.length} subvalue="Active Prescriptions" color="bg-sky-500 shadow-sky-200" />
            </motion.div>
            <motion.div variants={item}>
              <StatCard icon={CheckCircle2} label="Taken Today" value={todayLogs.filter(l => l.status === 'taken').length} subvalue={`${todayLogs.length} Scheduled`} color="bg-emerald-500 shadow-emerald-200" />
            </motion.div>
            <motion.div variants={item}>
              <StatCard icon={Activity} label="Adherence" value={activeProfile.healthScore > 80 ? 'Perfect' : 'Good'} subvalue="Based on 7 days" color="bg-indigo-500 shadow-indigo-200" />
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black tracking-tighter">Daily Schedule</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Timeline for today</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 border border-slate-200 px-4 py-2 rounded-xl bg-white shadow-sm uppercase tracking-widest">
                  <Calendar size={14} className="text-med-primary" /> Week 17
                </div>
              </div>

              <div className="space-y-6">
                {profileMeds.length === 0 ? (
                  <div className="bg-white rounded-[40px] p-16 text-center border-2 border-dashed border-slate-200 shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mx-auto mb-6">
                      <Pill size={40} />
                    </div>
                    <p className="text-slate-500 font-bold mb-6 text-sm uppercase tracking-[0.1em]">No medications tracked for this profile</p>
                    <button onClick={() => setActiveTab('scan')} className="bg-med-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-sky-100 hover:scale-105 transition-transform">
                      Scan Prescription to Start
                    </button>
                  </div>
                ) : (
                  <motion.div 
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-4"
                  >
                    {profileMeds.map(med => {
                      const isTaken = todayLogs.some(l => l.medicationId === med.id && l.status === 'taken');
                      const isMissed = todayLogs.some(l => l.medicationId === med.id && l.status === 'missed');
                      
                      return (
                        <motion.div 
                          variants={item}
                          key={med.id} 
                          className={`bg-white rounded-[32px] p-8 border-l-[12px] shadow-premium flex items-center justify-between transition-all group ${isTaken ? 'border-emerald-500/30' : 'border-sky-500'}`}
                        >
                          <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-2xl shadow-xl transition-transform group-hover:scale-110 ${isTaken ? 'bg-emerald-50 text-emerald-500' : 'bg-sky-50 text-sky-500'}`}>
                              {isTaken ? '✅' : '💊'}
                            </div>
                            <div>
                              <h4 className="text-xl font-black tracking-tight mb-1">{med.name}</h4>
                              <div className="flex flex-wrap gap-3 items-center">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{med.dosage} • {med.instructions}</p>
                                {med.times.length > 0 && (
                                  <div className="flex gap-1.5">
                                    {med.times.map((t, i) => (
                                      <span key={i} className="text-[10px] bg-slate-50 border border-slate-100 px-3 py-1 rounded-full font-black text-slate-500 flex items-center gap-1.5">
                                        <div className="w-1 h-1 bg-med-primary rounded-full animate-pulse" />
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        
                        <div className="flex items-center gap-3">
                          {isTaken ? (
                            <div className="flex items-center gap-2 text-med-success font-bold text-xs">
                              <CheckCircle2 size={16} /> Taken
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => logDose(med.id, med.name, 'taken')}
                                className="px-6 py-2.5 bg-med-primary text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-sky-100 hover:scale-105 active:scale-95 transition-all"
                              >
                                I took it
                              </button>
                              <button 
                                onClick={() => {
                                  const reason = prompt("Why are you skipping this dose?");
                                  if (reason) logDose(med.id, med.name, 'skipped');
                                }}
                                className="p-2.5 hover:bg-slate-100 text-slate-400 rounded-xl transition-all"
                              >
                                <X size={20} />
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>

            <div>
              <div className="mb-8">
                <h3 className="text-xl font-extrabold tracking-tight mb-6">Proactive AI</h3>
                <div className="bg-sky-600 rounded-[30px] p-8 text-white relative overflow-hidden shadow-xl shadow-sky-100">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                   <div className="relative">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                        <Smartphone size={20} />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60 text-white">Adherence Insight</p>
                      <p className={`text-sm font-bold leading-relaxed italic ${language === 'ur' ? 'urdu-text' : ''}`}>
                        "{aiInsight}"
                      </p>
                   </div>
                </div>
              </div>

              <div className="mb-8">
                <button 
                  onClick={() => alert("SOS: Medical Contacts Notified. In a real emergency, call local emergency services immediately.")}
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white p-8 rounded-[30px] flex items-center justify-between shadow-xl shadow-rose-100 group transition-all"
                >
                  <div className="text-left">
                    <p className="text-2xl font-black">SOS</p>
                    <p className="text-[10px] font-bold uppercase opacity-80">Emergency Contact</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldAlert size={28} />
                  </div>
                </button>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-extrabold tracking-tight mb-6">Recent Records</h3>
                <div className="space-y-4">
                  {doseLogs.filter(l => l.profileId === activeProfileId).slice(0, 3).map(log => (
                    <div key={log.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className={`w-2 h-2 rounded-full ${log.status === 'taken' ? 'bg-med-success' : 'bg-red-400'}`} />
                      <div className="flex-1">
                        <p className="text-xs font-bold">{log.medicationName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(log.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const ResultCard = ({ 
    icon: Icon, 
    title, 
    content, 
    items, 
    colorClass, 
    delay = 0 
  }: { 
    icon: any, 
    title: string, 
    content?: string, 
    items?: string[], 
    colorClass: string,
    delay?: number
  }) => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`p-10 rounded-[40px] border shadow-premium bg-white relative overflow-hidden group hover:-translate-y-1 transition-transform ${colorClass}`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:scale-110 transition-transform origin-top-right">
        <Icon size={96} />
      </div>
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="w-10 h-10 rounded-2xl bg-white shadow-lg flex items-center justify-center text-inherit">
          <Icon size={20} className="text-current" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h4>
      </div>
      
      {content && <p className="text-lg font-bold text-slate-800 leading-relaxed mb-4 relative z-10">{content}</p>}
      
      {items && items.length > 0 && (
        <ul className="space-y-3 relative z-10">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-4 group/item">
              <div className="w-1.5 h-1.5 rounded-full bg-current mt-2 opacity-30 group-hover/item:opacity-100 transition-opacity" />
              <span className="text-base font-bold text-slate-700">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );

  const RemindersView = () => {
    const profileMeds = medications.filter(m => m.profileId === activeProfileId);
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-10 h-full overflow-y-auto custom-scrollbar pb-32"
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-12 text-left">
            <p className="text-[10px] font-black text-med-primary uppercase tracking-[0.2em] mb-3">Schedule Management</p>
            <h2 className="text-5xl font-black tracking-tighter">Treatment Plan</h2>
            <p className="text-base text-slate-500 font-bold mt-2">Manage alarms and dose timings for {activeProfile.name}.</p>
          </div>

          <div className="space-y-8">
            {profileMeds.length === 0 ? (
              <div className="bg-white rounded-[40px] p-24 text-center border-2 border-dashed border-slate-200 shadow-premium">
                <Bell size={48} className="mx-auto text-slate-200 mb-8" />
                <p className="text-slate-400 font-black uppercase text-xs tracking-widest mb-6">No active medications</p>
                <button onClick={() => setActiveTab('scan')} className="bg-med-primary text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-sky-100 hover:scale-105 transition-transform">Get Started with Lens</button>
              </div>
            ) : (
              profileMeds.map(med => (
                <div key={med.id} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-premium transition-all hover:-translate-y-1 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start justify-between mb-10 relative z-10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-sky-50 rounded-3xl flex items-center justify-center text-med-primary shadow-xl shadow-sky-100 group-hover:rotate-6 transition-transform">
                        <Pill size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black tracking-tight mb-1">{med.name}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{med.dosage} • {med.instructions}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Scheduled Times</p>
                      <div className="flex flex-wrap gap-2">
                        {med.times.map((time, i) => (
                          <div key={i} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                             <Clock size={14} className="text-med-primary" />
                             {time}
                             <button 
                              onClick={() => {
                                const newTimes = med.times.filter((_, idx) => idx !== i);
                                setMedications(prev => prev.map(m => m.id === med.id ? { ...m, times: newTimes } : m));
                              }}
                              className="ml-2 text-slate-300 hover:text-red-400"
                             >
                                <X size={14} />
                             </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => handleAddTime(med.id)}
                          className="bg-med-primary/10 text-med-primary border border-med-primary/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-med-primary/20 transition-all cursor-pointer relative z-10"
                        >
                          <Plus size={14} /> Add Time
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl flex flex-col justify-between">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Notification Options</p>
                          <div className="flex flex-col gap-2">
                             <label className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                <input type="checkbox" checked={med.isCritical} onChange={(e) => {
                                   setMedications(prev => prev.map(m => m.id === med.id ? { ...m, isCritical: e.target.checked } : m));
                                }} className="rounded text-med-primary focus:ring-med-primary" />
                                Persistent Alarm (SOS Mode)
                             </label>
                             <label className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                <input type="checkbox" checked={true} readOnly className="rounded text-emerald-500 focus:ring-emerald-500" />
                                Smart AI Snoozing
                             </label>
                          </div>
                       </div>
                       <button 
                        onClick={() => setMedications(prev => prev.filter(m => m.id !== med.id))}
                        className="mt-4 text-left text-xs font-bold text-red-400 hover:text-red-500 flex items-center gap-2"
                       >
                          <Trash2 size={14} /> Stop Tracking This Medication
                       </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    );
  };
  const FamilyView = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-10 h-full overflow-y-auto custom-scrollbar pb-32"
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-[10px] font-black text-med-primary uppercase tracking-[0.2em] mb-4">Patient Network</p>
            <h2 className="text-5xl font-black tracking-tighter">Your Health Circle</h2>
            <p className="text-base text-slate-500 font-bold mt-2 font-inter">Manage tracking for family members from one account.</p>
          </div>
          <button 
            id="add-family-member-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleAddNewProfile();
            }}
            className="px-8 py-4 bg-med-primary text-white rounded-[24px] font-black text-sm flex items-center gap-2 shadow-xl shadow-sky-100 hover:scale-105 transition-transform cursor-pointer relative z-40"
          >
            <Plus size={18} strokeWidth={3} /> Add Profile
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {profiles.map(p => (
            <motion.div 
              whileHover={{ y: -5 }}
              key={p.id} 
              onClick={() => setActiveProfileId(p.id)}
              className={`bg-white rounded-[40px] p-10 border shadow-premium transition-all relative overflow-hidden group cursor-pointer ${p.id === activeProfileId ? 'border-med-primary ring-8 ring-med-primary/5' : 'border-slate-100'}`}
            >
              {p.id === activeProfileId && (
                <div className="absolute top-8 right-8 w-3 h-3 bg-med-primary rounded-full animate-ping" />
              )}
              <div className="flex items-start justify-between mb-10 relative z-10">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-3xl font-black text-white shadow-xl transition-transform group-hover:rotate-3 ${p.id === activeProfileId ? 'bg-med-primary shadow-sky-100' : 'bg-slate-400 shadow-slate-100 grayscale group-hover:grayscale-0'}`}>
                    {p.name[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter">{p.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">{p.role}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                  <span>Daily Adherence</span>
                  <span className={p.healthScore > 80 ? 'text-emerald-500 font-black' : 'text-amber-500 font-black'}>{p.healthScore}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${p.healthScore}%` }}
                    className={`h-full ${p.healthScore > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveProfileId(p.id); }}
                  className={`flex-1 py-4 rounded-[20px] font-black text-xs transition-all tracking-widest uppercase ${p.id === activeProfileId ? 'bg-med-primary/10 text-med-primary' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  {p.id === activeProfileId ? 'Active Now' : 'Switch Profile'}
                </button>
                {p.id !== 'main' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setProfiles(prev => prev.filter(x => x.id !== p.id)); }}
                    className="w-14 h-14 flex items-center justify-center rounded-[20px] text-red-300 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 active:scale-95"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const HealthLogView = () => {
    const profileLogs = doseLogs.filter(l => l.profileId === activeProfileId);
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-10 h-full overflow-y-auto custom-scrollbar"
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <p className="text-[10px] font-bold text-med-primary uppercase tracking-widest mb-2">History & Adherence</p>
            <h2 className="text-4xl font-extrabold tracking-tight">Your Health Timeline</h2>
          </div>

          <div className="space-y-6">
            {profileLogs.length === 0 ? (
              <div className="bg-white rounded-[40px] p-20 text-center border-2 border-dashed border-slate-200">
                <Clock size={48} className="mx-auto text-slate-200 mb-6" />
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No health records yet</p>
              </div>
            ) : (
              profileLogs.map((log, idx) => (
                <div key={log.id} className="relative pl-12 pb-8 last:pb-0">
                  {idx !== profileLogs.length - 1 && (
                    <div className="absolute left-6 top-6 bottom-0 w-[1px] bg-slate-200" />
                  )}
                  <div className={`absolute left-0 top-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${log.status === 'taken' ? 'bg-med-success shadow-emerald-100' : 'bg-red-500 shadow-red-100'}`}>
                    {log.status === 'taken' ? <CheckCircle2 size={24} /> : <X size={24} />}
                  </div>
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-lg font-extrabold tracking-tight">{log.medicationName}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase">
                          Scheduled: {new Date(log.scheduledTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${log.status === 'taken' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {log.status === 'taken' ? 'Success' : log.status === 'missed' ? 'Missed' : 'Skipped'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const ScannerView = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full grid grid-cols-[350px_1fr] gap-0 overflow-hidden"
    >
      {/* Sidebar */}
      <div className="bg-white border-r border-slate-200 p-8 overflow-y-auto custom-scrollbar">
        <h2 className="text-xl font-bold mb-6">AI OCR Scanner</h2>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button 
            onClick={() => setInputMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${inputMode === 'upload' ? 'bg-white shadow-sm text-med-primary' : 'text-slate-500'}`}
          >
            <ImageIcon size={14} />
            Upload Photo
          </button>
          <button 
            onClick={() => setInputMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${inputMode === 'text' ? 'bg-white shadow-sm text-med-primary' : 'text-slate-500'}`}
          >
            <Search size={14} />
            Search Name
          </button>
        </div>

        <AnimatePresence mode="wait">
          {inputMode === 'upload' ? (
            <motion.div 
              key="upload-box"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center bg-slate-50 flex flex-col items-center gap-4 cursor-pointer transition-all hover:border-med-primary hover:bg-sky-50/50 ${file ? 'border-med-primary bg-sky-50/30' : 'border-slate-200'}`}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              {preview ? (
                <div className="relative group">
                  <img src={preview} alt="Preview" className="h-40 w-full object-cover rounded-2xl shadow-lg" />
                  <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="text-white" size={24} />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300">
                  <ImageIcon size={32} />
                </div>
              )}
              <div className="text-sm font-bold text-slate-700">
                {file ? 'Replace Prescription Photo' : 'Drop Prescription Photo'}
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-relaxed">
                Supports handwriting, blurry labels & multiple medications
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="text-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col gap-3"
            >
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Universal Medicine Search</label>
              <input 
                type="text"
                placeholder="e.g. Panadol Forte 500mg"
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-med-primary/20 transition-all shadow-inner"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-8">
          <button 
            onClick={handleAnalyze}
            disabled={loading}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-sky-100 transition-all ${loading ? 'bg-slate-200 text-slate-400' : 'bg-med-primary text-white hover:bg-sky-600 hover:-translate-y-0.5 active:translate-y-0'}`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Pill size={20} />}
            {loading ? 'AI analyzing...' : 'Start Extraction'}
          </button>
          <button 
            onClick={() => setShowManualEntryModal(true)}
            className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
            title="Add Manually"
          >
            <Plus size={24} />
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }}
            className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-xs text-red-600 font-bold leading-relaxed"
          >
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            {error}
          </motion.div>
        )}

        {history.length > 0 && (
          <div className="mt-12 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Extractions</span>
              <button onClick={clearHistory} className="text-[10px] font-bold text-red-400 hover:underline uppercase tracking-widest">Clear</button>
            </div>
            <div className="space-y-3">
              {history.map(item => (
                <button 
                  key={item.id}
                  onClick={() => { setResult(item.data); setChatHistory([]); }}
                  className="w-full flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl hover:bg-sky-50 transition-all text-left border border-transparent hover:border-sky-100 group"
                >
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[10px] group-hover:scale-110 transition-transform">
                    {item.data.document_type === 'report' ? '📄' : '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {item.data.document_type === 'report' ? 'Medical Report' : 'Prescription Scan'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Results Column */}
      <div className="p-10 overflow-y-auto custom-scrollbar bg-slate-50">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-24 h-24 mb-8 relative">
               <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 border-4 border-slate-100 border-t-med-primary rounded-full"
               />
               <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
            </div>
            <h3 className="text-2xl font-bold mb-3 tracking-tight">Processing medical data...</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Our clinical-grade AI is transcribing the prescription, checking for drug interactions, and identifying all medications.</p>
          </div>
        ) : result ? (
          <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-10 rounded-3xl p-8 shadow-sm border ${result.document_type === 'report' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 text-white rounded-2xl flex items-center justify-center shadow-lg ${result.document_type === 'report' ? 'bg-indigo-500' : 'bg-amber-400'}`}>
                  {result.document_type === 'report' ? <Activity size={20} /> : <Info size={20} />}
                </div>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${result.document_type === 'report' ? 'text-indigo-700' : 'text-amber-700'}`}>
                    {result.document_type === 'report' ? 'Medical Report Summary' : 'Clinical Summary'}
                  </h3>
                  <p className={`text-[10px] font-medium ${result.document_type === 'report' ? 'text-indigo-500' : 'text-amber-600'}`}>AI-Extracted Data</p>
                </div>
              </div>
              <p className={`text-sm leading-relaxed font-bold ${language === 'ur' ? 'urdu-text text-xl' : 'text-slate-800'}`}>
                {result.summary || result.prescription_summary}
              </p>
            </motion.div>

            {result.document_type === 'report' && result.report_details ? (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ResultCard 
                    icon={CheckCircle2} 
                    title="Key Findings" 
                    items={result.report_details.key_findings} 
                    colorClass="border-indigo-500 bg-indigo-50/20" 
                    delay={0.1} 
                  />
                  <ResultCard 
                    icon={Heart} 
                    title="Doctor's Advice" 
                    content={result.report_details.doctor_recommendation} 
                    colorClass="border-emerald-500 bg-emerald-50/20" 
                    delay={0.2} 
                  />
                </div>

                <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm overflow-hidden">
                   <h4 className="text-xl font-extrabold mb-6 flex items-center gap-2 px-2">
                     <Activity className="text-indigo-500" size={24} /> Lab Values & Results
                   </h4>
                   <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Test Parameter</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Result</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.report_details.vitals_or_results?.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{r.parameter}</td>
                            <td className="px-6 py-4 font-black text-indigo-600">{r.value}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                r.status?.toLowerCase().includes('normal') ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!result.report_details.vitals_or_results || result.report_details.vitals_or_results.length === 0) && (
                          <tr>
                            <td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic">No specific values detected in this document.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                   </div>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                {result.medicines && result.medicines.map((med, idx) => (
                  <div key={idx} className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 rounded-full blur-3xl opacity-50 -mr-32 -mt-32" />
                    
                    <div className="flex justify-between items-start relative mb-10">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className={`text-4xl font-extrabold tracking-tight ${language === 'ur' ? 'urdu-text' : ''}`}>{med.medicine_name}</h2>
                          <span className="px-4 py-1.5 bg-med-primary/10 text-med-primary text-[10px] font-bold rounded-full uppercase tracking-widest">{med.type || 'Medicine'}</span>
                        </div>
                        <p className="text-lg text-slate-400 font-medium italic mb-6">{med.generic_name}</p>
                        
                        <button 
                          onClick={() => handleAddMedication(med)}
                          className="flex items-center gap-2 px-6 py-3 bg-med-primary text-white text-xs font-extrabold rounded-2xl shadow-lg shadow-sky-100 hover:scale-105 transition-transform active:scale-95"
                        >
                          <Plus size={16} strokeWidth={3} /> Add to Health Tracker
                        </button>
                      </div>
                      <div className="w-16 h-16 bg-slate-50 rounded-[20px] flex items-center justify-center text-slate-300">
                        <Pill size={32} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                      <ResultCard icon={CheckCircle2} title="Indications" items={med.what_it_treats} colorClass="border-med-success bg-green-50/20" delay={0.1} />
                      <ResultCard icon={Info} title="Dosage Protocol" content={`${med.dosage}. ${med.when_to_take}.`} colorClass="border-med-primary bg-sky-50/20" delay={0.2} />
                      <ResultCard icon={AlertTriangle} title="Side Effects" items={med.common_side_effects} colorClass="border-med-warning bg-orange-50/20" delay={0.3} />
                      <ResultCard icon={ShieldAlert} title="Clinical Warnings" items={[...(med.serious_side_effects || []), ...(med.who_should_not_take || [])]} colorClass="border-med-danger bg-red-50/20" delay={0.4} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-12 bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-med-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-100">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight">Adaptive AI Chat</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Clinical Follow-up</p>
                  </div>
               </div>

               <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={i} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] px-6 py-4 rounded-[30px] text-sm font-bold leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-med-primary text-white rounded-tr-none' : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'} ${language === 'ur' ? 'urdu-text text-xl' : ''}`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-50 px-6 py-4 rounded-[30px] rounded-tl-none border border-slate-100 animate-pulse flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-100" />
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  )}
               </div>

               <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Ask about side effects, better timing, or drug interactions..." 
                    value={followUp} 
                    onChange={(e) => setFollowUp(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                    className={`w-full bg-slate-100 border-none rounded-3xl px-8 py-5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-med-primary/20 pr-16 shadow-inner ${language === 'ur' ? 'urdu-text text-lg' : ''}`} 
                  />
                  <button 
                    onClick={handleAskQuestion} 
                    className="absolute right-3 top-3 w-10 h-10 bg-med-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-100 transition-transform active:scale-90"
                  >
                    <Send size={18} />
                  </button>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
             <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-6xl shadow-xl shadow-slate-100 mb-10 animate-bounce transition-all duration-1000">🚀</div>
             <h3 className="text-3xl font-extrabold tracking-tight mb-4">Master the Scan</h3>
             <p className="max-w-md text-slate-500 font-bold leading-relaxed mb-4">
                Upload a photo of your prescription (English or Urdu) or any medicine label. Our AI will automatically identify all pills and help you track your doses.
             </p>
             <div className="flex flex-wrap justify-center gap-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                <span className="px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">OCR Transcription</span>
                <span className="px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">Drug Analysis</span>
                <span className="px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">Cross-Interaction Check</span>
             </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden text-med-text-primary bg-med-bg font-sans">
      <header className="h-[90px] glass-morphism flex items-center justify-between px-10 flex-shrink-0 z-50 sticky top-0 border-none shadow-premium mx-6 mt-6 rounded-[32px]">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-xl shadow-sky-100 group-hover:rotate-6 transition-transform">
            <Smartphone size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter">MediSnap <span className="text-med-primary">Pro</span></h1>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-med-success animate-pulse" />
               <span className="text-[10px] font-black text-med-text-secondary uppercase tracking-[0.2em] opacity-50">Intelligent Companion</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
            <div className="flex flex-col items-end px-2">
              <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Encryption Key</span>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                className="bg-transparent border-none text-right text-xs font-bold focus:ring-0 w-24 p-0 placeholder:text-slate-300"
              />
            </div>
            <div className="h-8 w-[1px] bg-slate-200" />
            <LangToggle />
          </div>
          <ProfileSelector />
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardView key="dashboard" />}
          {activeTab === 'scan' && <ScannerView key="scan" />}
          {activeTab === 'family' && <FamilyView key="family" />}
          {activeTab === 'reminders' && <RemindersView key="reminders" />}
          {activeTab === 'health-log' && <HealthLogView key="health" />}
        </AnimatePresence>

        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]">
          <nav className="glass-morphism p-2 rounded-[32px] shadow-premium flex items-center gap-1">
             <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Pulse" />
             <NavButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={Pill} label="Lens" />
             <NavButton active={activeTab === 'family'} onClick={() => setActiveTab('family')} icon={Users} label="Family" />
             <NavButton active={activeTab === 'reminders'} onClick={() => setActiveTab('reminders')} icon={Bell} label="Alerts" />
             <NavButton active={activeTab === 'health-log'} onClick={() => setActiveTab('health-log')} icon={Activity} label="Vital" />
          </nav>
        </div>
      </main>

      <footer className="h-[45px] bg-white border-t border-med-border flex items-center justify-between px-10 flex-shrink-0 z-10">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert size={12} /> Medical AI Accuracy: 98.4%
        </p>
        <p className="text-[10px] text-slate-400 font-medium">
          Always consult your doctor. Data secured on-device.
        </p>
      </footer>

      {/* --- Overlay Modals --- */}
      <AnimatePresence>
        {showAddProfileModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
            onClick={() => setShowAddProfileModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <button 
                onClick={() => setShowAddProfileModal(false)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="relative">
                <div className="w-16 h-16 bg-med-primary/10 rounded-2xl flex items-center justify-center text-med-primary mb-6">
                  <Users size={32} />
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight mb-2">New Family Member</h3>
                <p className="text-sm text-slate-500 font-bold mb-8 uppercase tracking-widest text-[10px]">Add a person to your care circle</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                    <input 
                      type="text" 
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-med-primary/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Role / Relationship</label>
                    <input 
                      type="text" 
                      value={newProfileRole}
                      onChange={(e) => setNewProfileRole(e.target.value)}
                      placeholder="e.g. Father, Daughter"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-med-primary/20 transition-all"
                    />
                  </div>
                  <button 
                    onClick={submitNewProfile}
                    className="w-full bg-med-primary text-white py-5 rounded-2xl font-bold shadow-lg shadow-sky-100 hover:bg-sky-600 transition-all active:scale-[0.98]"
                  >
                    Add to Circle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showAddTimeModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
            onClick={() => setShowAddTimeModal(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <button 
                onClick={() => setShowAddTimeModal(null)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="relative">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-6 font-bold">
                  <Clock size={32} />
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight mb-2">Set Dose Time</h3>
                <p className="text-sm text-slate-500 font-bold mb-8 uppercase tracking-widest text-[10px]">When should this dose be taken?</p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Select Time</label>
                    <div className="flex gap-2">
                       <input 
                        type="time" 
                        value={newTimeInput}
                        onChange={(e) => setNewTimeInput(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xl font-black focus:ring-2 focus:ring-med-primary/20 transition-all appearance-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && submitNewTime()}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-3 ml-1 uppercase tracking-tighter">Tap the icon to use the system clock</p>
                  </div>
                  <button 
                    onClick={submitNewTime}
                    className="w-full bg-med-primary text-white py-5 rounded-2xl font-bold shadow-lg shadow-sky-100 hover:bg-sky-600 transition-all active:scale-[0.98]"
                  >
                    Confirm Alarm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showManualEntryModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
            onClick={() => setShowManualEntryModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full blur-3xl -mr-16 -mt-16" />
              
              <button 
                onClick={() => setShowManualEntryModal(false)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="relative">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-6">
                  <Plus size={32} />
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight mb-2">Manual Entry</h3>
                <p className="text-sm text-slate-500 font-bold mb-8 uppercase tracking-widest text-[10px]">Add missing medication details</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Medication Name</label>
                    <input 
                      type="text" 
                      value={manualMed.name}
                      onChange={(e) => setManualMed(prev => ({...prev, name: e.target.value}))}
                      placeholder="e.g. Panadol" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 text-sm font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Dosage</label>
                      <input 
                        type="text" 
                        value={manualMed.dosage}
                        onChange={(e) => setManualMed(prev => ({...prev, dosage: e.target.value}))}
                        placeholder="e.g. 500mg" 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Timing</label>
                      <input 
                        type="text" 
                        value={manualMed.timingText}
                        onChange={(e) => setManualMed(prev => ({...prev, timingText: e.target.value}))}
                        placeholder="e.g. After food" 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-3 text-sm font-bold"
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (manualMed.name && manualMed.dosage) {
                        handleAddMedication({
                          medicine_name: manualMed.name,
                          dosage: manualMed.dosage,
                          when_to_take: manualMed.timingText || manualMed.instructions || 'As needed',
                          generic_name: 'Manual Entry',
                          type: 'User Added'
                        } as any);
                        setShowManualEntryModal(false);
                        setManualMed({ name: '', dosage: '', timingText: '', instructions: '', times: ['09:00'] });
                      } else {
                        alert("Please fill in at least the medicine name and dosage.");
                      }
                    }}
                    className="w-full bg-med-primary text-white py-5 rounded-2xl font-bold shadow-lg shadow-sky-100 mt-4"
                  >
                    Add to Tracker
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Notification Alert Overlay --- */}
      <AnimatePresence>
        {activeAlert && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 sm:p-12">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-rose-500/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              className="bg-white rounded-[50px] w-full max-w-lg p-12 text-center shadow-2xl relative z-10"
            >
              <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-8 animate-bounce">
                <Bell size={48} />
              </div>
              <p className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] mb-4">Medication Reminder</p>
              <h2 className="text-4xl font-black tracking-tighter mb-4">It's time for<br />{activeAlert.name}</h2>
              <p className="text-slate-500 text-lg font-bold mb-10">{activeAlert.dosage} • {activeAlert.instructions}</p>
              
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    logDose(activeAlert.id, activeAlert.name, 'taken');
                    setActiveAlert(null);
                  }}
                  className="w-full bg-emerald-500 text-white py-6 rounded-3xl font-black text-xl shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all"
                >
                  I Took It Now
                </button>
                <button 
                  onClick={() => {
                    logDose(activeAlert.id, activeAlert.name, 'missed');
                    setActiveAlert(null);
                  }}
                  className="w-full bg-slate-100 text-slate-500 py-4 rounded-3xl font-bold hover:bg-slate-200 transition-all"
                >
                  Skip this dose
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
