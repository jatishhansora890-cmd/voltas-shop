import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  Plus,
  Trash2,
  Save,
  BarChart3,
  User,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Settings,
  ToggleLeft,
  ToggleRight,
  Target,
  CalendarDays,
  GitMerge,
  ArrowDown,
  Lock,
  Unlock,
  Pencil,
  Calendar,
  Download,
  FolderPlus,
  RefreshCw,
  Wifi,
  WifiOff,
  History,
  Clock,
  MessageCircle,
  FileSpreadsheet,
  Filter,
  Share2,
  X
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  onSnapshot,
  deleteDoc,
  updateDoc
} from "firebase/firestore";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCAoiDnT3sSeGdKpt-jKBEoQmhLt4JKizg",
  authDomain: "voltas-vadodara.firebaseapp.com",
  projectId: "voltas-vadodara",
  storageBucket: "voltas-vadodara.firebasestorage.app",
  messagingSenderId: "891841914552",
  appId: "1:891841914552:web:31a4c6e0c49ac6fddff64d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'voltas-prod-live';

// --- Constants ---

const AREAS = [
  "CRF",
  "Pre-assembly",
  "Door foaming",
  "Cabinet foaming",
  "CF final",
  "WD final"
];

const PROCESS_FLOW = {
  mainLine: ["Pre-assembly", "Cabinet foaming", "CF final"],
  independent: ["CRF", "Door foaming", "WD final"]
};

// --- INITIAL DATA ---
const INITIAL_MASTER_DATA = {
  CRF_MACHINES: {
    "Komatsu Press": ["Side Panel", "Back Panel", "Bottom Plate"],
    "Thermoforming": ["Inner Liner", "Door Liner"],
    "Extrusion": ["Profile"],
    "Paint Shop": ["Paint Part 1"]
  },
  CF_LINE: {
    "Hard Top": ["100L", "200L", "300L", "400L", "500L"],
    "Glass Top": ["200L", "300L", "400L", "500L"]
  },
  WD_LINE: {
    "Standard": ["Floor Standing", "Table Top", "Bottom Loading"]
  }
};

const INITIAL_SHIFT_CONFIG = {
    shifts: [
        { id: 1, name: "Shift A", start: "08:00", end: "16:00" },
        { id: 2, name: "Shift B", start: "16:00", end: "00:00" },
        { id: 3, name: "Shift C", start: "00:00", end: "08:00" }
    ],
    supervisors: [
        { name: "Admin", phone: "", shiftId: 1 }
    ]
};

const getDataKeyForArea = (area) => {
  if (area === "CRF") return "CRF";
  if (area === "WD final") return "WD_LINE";
  return "CF_LINE";
};

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, active, colorClass }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
    colorClass ? colorClass : (active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')
  }`}>
    {children}
  </span>
);

export default function App() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting');
  const [view, setView] = useState('entry');
 
  // Data State
  const [entries, setEntries] = useState([]);
  const [masterData, setMasterData] = useState(INITIAL_MASTER_DATA);
  const [activeModels, setActiveModels] = useState({});
  const [monthlyPlans, setMonthlyPlans] = useState({});
  const [dailyPlans, setDailyPlans] = useState({});
  const [shiftConfig, setShiftConfig] = useState(INITIAL_SHIFT_CONFIG);
  const [lastNotifiedHour, setLastNotifiedHour] = useState(null);
 
  // Security State
  const [isPlanUnlocked, setIsPlanUnlocked] = useState(false);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Entry Form State
  const [activeTab, setActiveTab] = useState(AREAS[0]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [supervisorName, setSupervisorName] = useState('');
 
  // Selection States
  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState(''); 
  const [selectedModel, setSelectedModel] = useState(''); 
  const [currentQty, setCurrentQty] = useState('');
  const [currentBatch, setCurrentBatch] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Settings State
  const [settingsGroup, setSettingsGroup] = useState('CF_LINE');
  const [newItemName, setNewItemName] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [targetCategoryForModel, setTargetCategoryForModel] = useState('');
  const [newSupervisorName, setNewSupervisorName] = useState('');
  const [newSupervisorPhone, setNewSupervisorPhone] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState(1);

  // --- UNIFIED REPORT FILTER STATE ---
  const [reportType, setReportType] = useState('daily');
  // Tabs: flow, daily, hourly, export
  const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterArea, setFilterArea] = useState(AREAS[0]);
  const [filterSupervisor, setFilterSupervisor] = useState('');
  // CRF Specific
  const [filterMachine, setFilterMachine] = useState('');
  const [filterPart, setFilterPart] = useState('');
  // Assembly Specific
  const [filterCategory, setFilterCategory] = useState('');
  const [filterModel, setFilterModel] = useState('');

  // Plan Edit Screen State
  const [planMode, setPlanMode] = useState('daily');
  const [planMonth, setPlanMonth] = useState(new Date().toISOString().slice(0, 7));
  const [planDate, setPlanDate] = useState(new Date().toISOString().split('T')[0]);
  const [tempPlanData, setTempPlanData] = useState({});

  // End Shift Report State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportParams, setReportParams] = useState({ shift: 'General Shift', manpower: '', losses: '' });

  // --- Firebase Effects ---

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (e) { console.error("Auth Error", e); setDbStatus('error'); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); if (u) setDbStatus('connected'); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    
    const entriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'production_entries');
    const unsubEntries = onSnapshot(entriesRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => b.timestamp - a.timestamp);
        setEntries(data);
    }, (err) => console.error("Entries Sync Error", err));

    const settingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'app_settings');
    const unsubSettings = onSnapshot(settingsRef, (snapshot) => {
        snapshot.docs.forEach(doc => {
            const d = doc.data();
            if (doc.id === 'masterData') setMasterData(d.data && !Array.isArray(d.data.CRF_MACHINES) ? d.data : INITIAL_MASTER_DATA);
            if (doc.id === 'activeModels') setActiveModels(d.data || {});
            if (doc.id === 'monthlyPlans') setMonthlyPlans(d.data || {});
            if (doc.id === 'dailyPlans') setDailyPlans(d.data || {});
            if (doc.id === 'shiftConfig') setShiftConfig(d.data || INITIAL_SHIFT_CONFIG);
        });
    }, (err) => console.error("Settings Sync Error", err));

    return () => { unsubEntries(); unsubSettings(); };
  }, [user]);

  // --- Handlers ---

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUnlock = (type) => {
    if (passwordInput === '1234') {
      if (type === 'plan') setIsPlanUnlocked(true);
      if (type === 'settings') setIsSettingsUnlocked(true);
      setPasswordInput('');
      showNotification("Unlocked Successfully");
    } else {
      showNotification("Incorrect PIN");
    }
  };

  const updateSettingsDoc = async (docId, newData) => {
      if (!user) return;
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'app_settings', docId);
      await setDoc(ref, { data: newData });
  };

  const toggleModelStatus = async (model) => {
      const newStatus = { ...activeModels, [model]: !activeModels[model] };
      setActiveModels(newStatus);
      await updateSettingsDoc('activeModels', newStatus);
  };

  // --- Settings Handlers ---
  const handleAddSupervisor = async () => {
      if(!newSupervisorName) return;
      const newConfig = { ...shiftConfig };
      if (!newConfig.supervisors) newConfig.supervisors = [];
      newConfig.supervisors = [...newConfig.supervisors, { name: newSupervisorName, phone: newSupervisorPhone, shiftId: parseInt(selectedShiftId) }];
      setShiftConfig(newConfig); setNewSupervisorName(''); setNewSupervisorPhone('');
      await updateSettingsDoc('shiftConfig', newConfig); showNotification("Supervisor Added");
  };

  const handleDeleteSupervisor = async (name) => {
      if(!confirm("Remove Supervisor?")) return;
      const newConfig = { ...shiftConfig };
      newConfig.supervisors = newConfig.supervisors.filter(s => s.name !== name);
      setShiftConfig(newConfig); await updateSettingsDoc('shiftConfig', newConfig);
  };

  const handleWhatsAppReminder = (phone, name) => {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Hello ${name}, reminder to update Voltas Production Hourly Report.`)}`, '_blank');
  };

  const handleSettingsAddCategory = async () => {
    if (!newCategoryInput) return;
    let newMasterData = JSON.parse(JSON.stringify(masterData));
    if (settingsGroup === 'CF_LINE') {
        if (masterData.CF_LINE[newCategoryInput]) { showNotification("Exists"); return; }
        newMasterData.CF_LINE[newCategoryInput] = [];
    } else if (settingsGroup === 'CRF_MACHINES') {
        if (masterData.CRF_MACHINES[newCategoryInput]) { showNotification("Exists"); return; }
        newMasterData.CRF_MACHINES[newCategoryInput] = [];
    }
    setMasterData(newMasterData); setNewCategoryInput(''); 
    await updateSettingsDoc('masterData', newMasterData);
    showNotification("Group Created");
  };

  const handleSettingsAddItem = async () => {
    if (!newItemName) return;
    let newMasterData = JSON.parse(JSON.stringify(masterData));
    let newActiveModels = { ...activeModels, [newItemName]: true };
    if (settingsGroup === 'CF_LINE') {
        if(!targetCategoryForModel) { showNotification("Select Category"); return; }
        newMasterData.CF_LINE[targetCategoryForModel] = [...newMasterData.CF_LINE[targetCategoryForModel], newItemName];
    } else if (settingsGroup === 'CRF_MACHINES') {
        if(!targetCategoryForModel) { showNotification("Select Machine"); return; }
        newMasterData.CRF_MACHINES[targetCategoryForModel] = [...newMasterData.CRF_MACHINES[targetCategoryForModel], newItemName];
    } else if (settingsGroup === 'WD_LINE') {
        newMasterData.WD_LINE["Standard"] = [...newMasterData.WD_LINE["Standard"], newItemName];
    }
    setMasterData(newMasterData); setActiveModels(newActiveModels); setNewItemName('');
    await updateSettingsDoc('masterData', newMasterData); await updateSettingsDoc('activeModels', newActiveModels); showNotification(`Item Added`);
  };

  const handleSettingsDeleteCategory = async (group, categoryName) => {
      if(!confirm(`Delete Group "${categoryName}"?`)) return;
      let newMasterData = JSON.parse(JSON.stringify(masterData));
      if (group === 'CF_LINE') delete newMasterData.CF_LINE[categoryName];
      if (group === 'CRF_MACHINES') delete newMasterData.CRF_MACHINES[categoryName];
      setMasterData(newMasterData); await updateSettingsDoc('masterData', newMasterData);
      showNotification("Group Deleted");
  };

  const handleSettingsDeleteItem = async (group, item, category = null) => {
    if (!confirm(`Delete ${item}?`)) return;
    let newMasterData = JSON.parse(JSON.stringify(masterData));
    if (group === 'CF_LINE' && category) newMasterData.CF_LINE[category] = newMasterData.CF_LINE[category].filter(i => i !== item);
    else if (group === 'CRF_MACHINES' && category) newMasterData.CRF_MACHINES[category] = newMasterData.CRF_MACHINES[category].filter(i => i !== item);
    else if (group === 'WD_LINE') newMasterData.WD_LINE["Standard"] = (newMasterData.WD_LINE["Standard"] || []).filter(i => i !== item);
    setMasterData(newMasterData); await updateSettingsDoc('masterData', newMasterData); showNotification("Deleted");
  };

  // --- Production Logic ---
  const handleAddBatchItem = () => {
    const isCRF = activeTab === 'CRF';
    const isWD = getDataKeyForArea(activeTab) === 'WD_LINE';
    if (!currentQty || parseInt(currentQty) <= 0) return;
    if (isCRF && (!selectedMachine || !selectedSubCategory || !selectedCategory || !selectedModel)) return;
    if (!isCRF && !selectedModel) return;
    let newItem = {
        id: Date.now(),
        qty: parseInt(currentQty),
        machine: isCRF ? selectedMachine : null,
        part: isCRF ? selectedSubCategory : null,
        model: selectedModel,
        category: isCRF ? selectedCategory : (isWD ? "Standard" : selectedCategory)
    };
    setCurrentBatch([...currentBatch, newItem]);
    if(isCRF) { setSelectedModel(''); } else { setSelectedModel(''); }
    setCurrentQty('');
  };

  const removeBatchItem = (id) => setCurrentBatch(currentBatch.filter(item => item.id !== id));

  const handleSubmitProduction = async () => {
    if (!supervisorName || currentBatch.length === 0) return;
    if (!user) { showNotification("Offline"); return; }
    const payload = { timestamp: Date.now(), date: entryDate, area: activeTab, supervisor: supervisorName, items: currentBatch };
    try {
        if (editingId) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'production_entries', editingId), payload);
            showNotification("Entry Updated Successfully!"); setEditingId(null);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'production_entries'), payload);
            showNotification("Production Submitted!");
        }
        setCurrentBatch([]);
    } catch (e) { console.error(e); showNotification("Error Saving Data"); }
  };

  const handleEditEntry = (entry) => {
      setEntryDate(entry.date); setSupervisorName(entry.supervisor); setCurrentBatch(entry.items); setEditingId(entry.id);
      window.scrollTo({ top: 0, behavior: 'smooth' }); showNotification("Loaded entry for editing");
  };

  const handleCancelEdit = () => { setEditingId(null); setCurrentBatch([]); setSupervisorName(''); };

  const handleDeleteEntry = async (id) => {
      if(!confirm("Are you sure?")) return;
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'production_entries', id)); showNotification("Entry Deleted"); } 
      catch(e) { showNotification("Error Deleting"); }
  };

  const handleSavePlan = async () => {
    if (!user) return;
    if (planMode === 'monthly') {
      const newPlans = { ...monthlyPlans, [planMonth]: tempPlanData };
      setMonthlyPlans(newPlans);
      await updateSettingsDoc('monthlyPlans', newPlans); showNotification("Monthly Budget Saved!");
    } else {
      const newPlans = { ...dailyPlans, [planDate]: tempPlanData };
      setDailyPlans(newPlans); await updateSettingsDoc('dailyPlans', newPlans); showNotification(`Plan for ${planDate} Saved!`);
    }
  };

  const handlePlanInputChange = (model, value) => setTempPlanData(prev => ({ ...prev, [model]: parseInt(value) || 0 }));

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) { showNotification("No data"); return; }
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(','), ...data.map(row => headers.map(fieldName => { let val = row[fieldName]; if (typeof val === 'string' && val.includes(',')) val = `"${val}"`; return val; }).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleGenerateReport = () => {
      const todayEntries = entries.filter(e => e.date === entryDate && e.area === activeTab);
      const modelStats = {}; let totalActual = 0; let totalPlan = 0;
      todayEntries.forEach(e => { e.items.forEach(i => { if (!modelStats[i.model]) modelStats[i.model] = 0; modelStats[i.model] += i.qty; totalActual += i.qty; }); });
      const dataKey = getDataKeyForArea(activeTab);
      const isWD = dataKey === 'WD_LINE';
      const todaysPlanObj = dailyPlans[entryDate] || {};
      let allModels = [];
      if(activeTab === 'CRF') allModels = Object.keys(modelStats);
      else { const group = masterData[dataKey]; allModels = isWD ? (group["Standard"] || []) : Object.values(group).flat(); }
      let modelLines = "";
      allModels.forEach(m => {
          const actual = modelStats[m] || 0; const plan = todaysPlanObj[m] || 0;
          if (activeModels[m] === false && actual === 0 && plan === 0) return;
          if (actual > 0 || plan > 0) { modelLines += `${m} :- ${actual}${plan > 0 ? ` / ${plan}` : ''} nos.%0A`; totalPlan += plan; }
      });
      const dateParts = entryDate.split('-'); 
      const message = `*${activeTab.toUpperCase()} PRODUCTION REPORT..*%0A%0A*DATE :-* ${dateParts[2]}/${dateParts[1]}/${dateParts[0]}%0A*Shift :-* ${reportParams.shift}%0A*Man power :-* ${reportParams.manpower}%0A%0A${modelLines}%0A*Total :- ${totalActual} ${totalPlan > 0 ? `/ ${totalPlan}` : ''} nos.*%0A%0AMajor Losses :-${reportParams.losses ? '%0A' + encodeURIComponent(reportParams.losses) : ' Nil'}`;
      window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  // --- DATA FILTERING LOGIC ---
  const getFilteredEntries = () => {
      return entries.filter(e => {
          if (e.area !== filterArea) return false;
          if (e.date < filterStartDate || e.date > filterEndDate) return false;
          if (filterSupervisor && e.supervisor !== filterSupervisor) return false;
          return true;
      });
  };

  // --- REPORT GENERATION (UNIFIED) ---
  const generateReportData = () => {
      const filtered = getFilteredEntries();
      const isCRF = filterArea === 'CRF';
      const plan = dailyPlans[filterStartDate] || {};
      
      // Filter Item-Level
      const processItems = (entry) => {
          return entry.items.filter(item => {
              if (isCRF) {
                  if (filterMachine && item.machine !== filterMachine) return false;
                  if (filterPart && item.part !== filterPart) return false;
              } else {
                  if (filterCategory && item.category !== filterCategory) return false;
                  if (filterModel && item.model !== filterModel) return false;
              }
              return true;
          });
      };

      if (isCRF) {
          const rows = [];
          filtered.forEach(record => {
              processItems(record).forEach(item => {
                  let existing = rows.find(r => r.machine === item.machine && r.part === item.part && r.model === item.model);
                  if (!existing) { existing = { machine: item.machine, part: item.part, model: item.model, actual: 0 }; rows.push(existing); }
                  existing.actual += item.qty;
              });
          });
          return { rows: rows.sort((a,b) => b.actual - a.actual), totalActual: rows.reduce((s, r) => s + r.actual, 0) };
      } else {
          const actuals = {}; let totalActual = 0;
          filtered.forEach(record => {
              processItems(record).forEach(item => {
                  if (!actuals[item.model]) actuals[item.model] = 0;
                  actuals[item.model] += item.qty;
                  totalActual += item.qty;
              });
          });
          // Build comparison rows
          const comparison = [];
          const dataKey = getDataKeyForArea(filterArea);
          let relevantModels = [];
          
          if(isCRF) {
             // Already handled above for rows, but if we need a list
          } else {
             const group = masterData[dataKey];
             if (filterCategory && group[filterCategory]) relevantModels = group[filterCategory];
             else relevantModels = (dataKey === 'WD_LINE') ? group["Standard"] : Object.values(group).flat();
             if (filterModel) relevantModels = relevantModels.filter(m => m === filterModel);
          }

          relevantModels.forEach(model => {
               if (activeModels[model] !== false || plan[model] || actuals[model]) {
                  const basePlan = plan[model] || 0; // Note: Plan is only for Start Date in this view
                  const a = actuals[model] || 0;
                  comparison.push({ model, plan: basePlan, actual: a, percent: basePlan > 0 ? Math.round((a / basePlan) * 100) : 0 });
               }
          });
          return { rows: comparison.sort((a, b) => b.actual - a.actual), totalActual };
      }
  };

  const reportData = useMemo(() => generateReportData(), [entries, filterStartDate, filterEndDate, filterArea, filterSupervisor, filterMachine, filterPart, filterCategory, filterModel, dailyPlans]);

  // --- ADVANCED EXPORT GENERATOR ---
  const generateMatrixReport = () => {
      const start = new Date(filterStartDate);
      const end = new Date(filterEndDate);
      const dates = [];
      for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) dates.push(new Date(d).toISOString().split('T')[0]);

      const isCRF = filterArea === 'CRF';
      const dataKey = getDataKeyForArea(filterArea);
      let allModels = [];
      if (isCRF) {
          if (filterPart) allModels = [filterPart];
          else if (filterMachine && masterData.CRF_MACHINES[filterMachine]) allModels = masterData.CRF_MACHINES[filterMachine];
          else allModels = [...new Set(entries.filter(e => e.area === 'CRF').flatMap(e => e.items.map(i => i.part)))];
      } else {
          const group = masterData[dataKey];
          if (filterCategory) allModels = group[filterCategory] || [];
          else allModels = (dataKey === 'WD_LINE') ? group["Standard"] : Object.values(group).flat();
          if (filterModel) allModels = allModels.filter(m => m === filterModel);
      }
      allModels.sort();
      const grandTotal = { Category: 'Grand Total', 'Tot. Monthly Plan': 0, 'Tot.Act': 0, 'Bal.prod': 0, '% Ach': '' };
      dates.forEach(date => { grandTotal[`${date} Plan`] = 0; grandTotal[`${date} Act`] = 0; });
      
      const reportRows = allModels.map(model => {
          const row = { Category: model };
          const currentMonth = filterStartDate.slice(0, 7);
          const monthlyBudget = (monthlyPlans[currentMonth] && monthlyPlans[currentMonth][model]) || 0; 
          
          const filteredEntries = getFilteredEntries(); 
          
          const calculateSum = (entryList) => {
              return entryList.reduce((sum, e) => {
                  return sum + e.items.reduce((iSum, item) => {
                      if (isCRF) {
                          if (item.part !== model) return iSum; 
                          if (filterMachine && item.machine !== filterMachine) return iSum;
                      } else {
                          if (item.model !== model) return iSum;
                      }
                      return iSum + item.qty;
                  }, 0);
              }, 0);
          };

          const totalActual = calculateSum(filteredEntries);
          const balance = monthlyBudget - totalActual;
          const percent = monthlyBudget > 0 ? Math.round((totalActual / monthlyBudget) * 100) : 0;

          row['Tot. Monthly Plan'] = monthlyBudget;
          row['Tot.Act'] = totalActual; row['Bal.prod'] = balance; row['% Ach'] = `${percent}%`;
          grandTotal['Tot. Monthly Plan'] += monthlyBudget; grandTotal['Tot.Act'] += totalActual;
          grandTotal['Bal.prod'] += balance;

          dates.forEach(date => {
              const dayPlan = (dailyPlans[date] && dailyPlans[date][model]) || 0;
              const dayEntries = filteredEntries.filter(e => e.date === date);
              const dayActual = calculateSum(dayEntries);
              
              row[`${date} Plan`] = dayPlan; row[`${date} Act`] = dayActual;
              grandTotal[`${date} Plan`] += dayPlan; grandTotal[`${date} Act`] += dayActual;
          });
          return row;
      });
      const gtPercent = grandTotal['Tot. Monthly Plan'] > 0 ?
      Math.round((grandTotal['Tot.Act'] / grandTotal['Tot. Monthly Plan']) * 100) : 0;
      grandTotal['% Ach'] = `${gtPercent}%`;
      reportRows.push(grandTotal);
      exportToCSV(reportRows, `Report_${filterArea}_${filterStartDate}`);
  };

  // --- Renderers ---

  const renderHeader = () => (
    <header className="bg-blue-700 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex flex-col"><h1 className="text-xl font-bold tracking-tight">Voltas Production</h1><span className="text-xs text-blue-200">Vadodara Plant Operations</span></div>
        <div className="flex gap-2 items-center">
          {dbStatus === 'connected' ? <Wifi size={16} className="text-green-300"/> : <WifiOff size={16} className="text-red-300"/>}
          {['entry', 'report', 'plan', 'settings'].map(m => (
            <button key={m} onClick={() => setView(m)} className={`p-2 rounded-full transition-all ${view === m ? 'bg-white text-blue-700' : 'bg-blue-600 text-blue-100'}`}>
              {m === 'entry' && <PenTool size={18} />}{m === 'report' && <BarChart3 size={18} />}{m === 'plan' && (isPlanUnlocked ? <Unlock size={18} /> : <Lock size={18} />)}{m === 'settings' && (isSettingsUnlocked ? <Settings size={18} /> : <Lock size={18} />)}
            </button>
          ))}
        </div>
      </div>
    </header>
  );

  const renderEntryScreen = () => {
    const isCRF = activeTab === 'CRF';
    const isWD = getDataKeyForArea(activeTab) === 'WD_LINE';
    const safeCRFData = (masterData.CRF_MACHINES && !Array.isArray(masterData.CRF_MACHINES)) ? masterData.CRF_MACHINES : {};
    const filterActive = (list) => list.filter(item => activeModels[item] !== false);

    const recentEntries = entries.filter(e => e.date === entryDate && e.area === activeTab);
    const currentHour = new Date().getHours();
    const currentHourLabel = `${currentHour.toString().padStart(2, '0')}:00 - ${(currentHour + 1).toString().padStart(2, '0')}:00`;
    const entriesThisHour = recentEntries.filter(e => new Date(e.timestamp).getHours() === currentHour);
    const qtyThisHour = entriesThisHour.reduce((acc, e) => acc + e.items.reduce((s, i) => s + i.qty, 0), 0);

    return (
      <div className="space-y-4 pb-24 relative">
        <div className="bg-white shadow-sm sticky top-[72px] z-40 overflow-x-auto no-scrollbar border-b border-gray-100">
          <div className="flex p-2 gap-2 min-w-max">{AREAS.map(area => (<button key={area} onClick={() => { setActiveTab(area); setSelectedCategory(''); setSelectedSubCategory(''); setSelectedModel(''); setSelectedMachine(''); }} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === area ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600'}`}>{area}</button>))}</div>
        </div>

        <div className="px-4 space-y-4 max-w-md mx-auto mt-4">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
              <div><div className="text-xs font-bold text-blue-100 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Current Hour ({currentHourLabel})</div><div className="text-2xl font-bold">{qtyThisHour} <span className="text-sm font-normal text-blue-200">units</span></div></div>
              <div className="bg-white/20 p-2 rounded-lg"><BarChart3 size={24} className="text-white"/></div>
          </div>

          <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start"><div className="flex-1"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entry Date</label><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full p-2 border rounded text-sm mb-2" /><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supervisor Name</label><div className="relative"><select value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="w-full p-2 border rounded text-sm bg-white appearance-none"><option value="">Select Supervisor...</option>{shiftConfig.supervisors && shiftConfig.supervisors.map((s, idx) => (<option key={idx} value={s.name}>{s.name}</option>))}</select><ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} /></div></div></div>
          </Card>

          <Card className={`p-4 space-y-4 ${editingId ? 'border-2 border-orange-300 bg-orange-50' : ''}`}>
             <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-700 flex items-center gap-2">{editingId ? <><Pencil size={16} className="text-orange-600"/> Edit Mode</> : 'Add Production'}</h3>{editingId && <button onClick={handleCancelEdit} className="text-xs text-red-500 font-bold border border-red-200 px-2 py-1 rounded bg-white">Cancel Edit</button>}{!editingId && <Badge active>{activeTab}</Badge>}</div>
             <div className="grid grid-cols-1 gap-3">
                 {isCRF && (<div><label className="text-xs text-gray-500 font-semibold mb-1 block">Select Machine</label><div className="relative"><select value={selectedMachine} onChange={(e) => { setSelectedMachine(e.target.value); setSelectedSubCategory(''); }} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Machine...</option>{Object.keys(safeCRFData).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
                 {isCRF && (<div className={!selectedMachine ? "opacity-50 pointer-events-none" : ""}><label className="text-xs text-gray-500 font-semibold mb-1 block">Select Part</label><div className="relative"><select value={selectedSubCategory} onChange={(e) => setSelectedSubCategory(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Part...</option>{(selectedMachine && safeCRFData[selectedMachine] ? safeCRFData[selectedMachine] : []).map(opt => (<option key={opt} value={opt}>{opt}</option>))}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
                 {!isWD && (<div><label className="text-xs text-gray-500 font-semibold mb-1 block">Product Category</label><div className="relative"><select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedModel(''); }} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Category...</option>{Object.keys(masterData.CF_LINE).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
                 {(selectedCategory || isWD) && (<div className="animate-in fade-in slide-in-from-top-2 duration-300"><label className="text-xs text-gray-500 font-semibold mb-1 block">{isCRF ? 'For Model (Target)' : 'Model'}</label><div className="relative"><select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Model</option>{filterActive(isWD ? masterData.WD_LINE["Standard"] : (masterData.CF_LINE[selectedCategory] || [])).map(model => (<option key={model} value={model}>{model}</option>))}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
                 <div className="flex gap-3 items-end"><div className="flex-1"><label className="text-xs text-gray-500 font-semibold mb-1 block">Quantity</label><input type="number" value={currentQty} onChange={(e) => setCurrentQty(e.target.value)} placeholder="0" className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500" /></div><button onClick={handleAddBatchItem} className="bg-blue-600 text-white p-3 rounded-lg font-medium flex items-center gap-2"><Plus size={20} /> Add</button></div>
             </div>
          </Card>

          {currentBatch.length > 0 && (<div className="space-y-2 animate-in fade-in slide-in-from-bottom-4"><h3 className="text-sm font-semibold text-gray-500 ml-1">Entries to {editingId ? 'Update' : 'Submit'}</h3>{currentBatch.map((item) => (<div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm"><div>{isCRF ? (<><div className="font-bold text-gray-800">{item.part}</div><div className="text-xs text-gray-500">{item.machine} | {item.category} - {item.model}</div></>) : (<><div className="font-bold text-gray-800">{item.model}</div>{!isWD && <div className="text-xs text-gray-500">{item.category}</div>}</>)}</div><div className="flex items-center gap-4"><span className="text-lg font-bold text-blue-600">{item.qty}</span><button onClick={() => removeBatchItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button></div></div>))}</div>)}

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50"><div className="max-w-md mx-auto p-4 flex gap-2"><button onClick={() => setShowReportModal(true)} className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-green-50 border border-green-200 flex justify-center items-center gap-2"><MessageCircle size={20} className="text-green-600"/> Shift Report</button><button onClick={handleSubmitProduction} className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95 ${!supervisorName || currentBatch.length === 0 ? 'bg-gray-300 pointer-events-none' : 'bg-blue-600 shadow-blue-200'}`}>{editingId ? 'Update Entry' : 'Submit Production'}</button></div></div>
        </div>
        
        {/* Shift Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                 <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Generate WhatsApp Report</h3><button onClick={() => setShowReportModal(false)}><X size={20} className="text-gray-400"/></button></div>
                 <div><label className="text-xs font-bold text-gray-500 uppercase">Shift</label><select className="w-full p-2 border rounded mt-1" value={reportParams.shift} onChange={e => setReportParams({...reportParams, shift: e.target.value})}>{shiftConfig.shifts.map(s => <option key={s.id} value={s.name}>{s.name} ({s.start}-{s.end})</option>)}</select></div>
                 <div><label className="text-xs font-bold text-gray-500 uppercase">Manpower</label><input type="text" placeholder="e.g. 12 Operators" className="w-full p-2 border rounded mt-1" value={reportParams.manpower} onChange={e => setReportParams({...reportParams, manpower: e.target.value})}/></div>
                 <div><label className="text-xs font-bold text-gray-500 uppercase">Major Losses / Remarks</label><textarea rows={3} placeholder="Any breakdowns or issues..." className="w-full p-2 border rounded mt-1" value={reportParams.losses} onChange={e => setReportParams({...reportParams, losses: e.target.value})}/></div>
                 <button onClick={handleGenerateReport} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Share2 size={18}/> Share on WhatsApp</button>
             </div>
          </div>
        )}
      </div>
    );
  };

  const renderReportScreen = () => {
    // Helper to render the Process Flow Diagram
    const renderFlowDiagram = () => (
      <div className="overflow-x-auto pb-4">
        <div className="flex items-center gap-4 min-w-max px-2">
           {PROCESS_FLOW.mainLine.map((step, idx) => (
             <div key={step} className="flex items-center gap-2">
               <div className={`p-4 rounded-xl border-2 ${activeTab === step ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'} min-w-[140px] text-center`}>
                 <div className="font-bold text-gray-700">{step}</div>
                 <div className="text-xs text-gray-500 mt-1">Main Line</div>
               </div>
               {idx < PROCESS_FLOW.mainLine.length - 1 && <ArrowDown className="-rotate-90 text-gray-300" />}
             </div>
           ))}
        </div>
      </div>
    );

    return (
      <div className="space-y-4 pb-24 px-4 max-w-md mx-auto mt-4">
        {/* Report Type Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['flow', 'daily', 'hourly', 'export'].map(t => (
            <button 
              key={t} 
              onClick={() => setReportType(t)} 
              className={`flex-1 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${reportType === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Common Filters */}
        <Card className="p-3 bg-white">
           <div className="flex gap-2 mb-3">
             <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="flex-1 p-2 border rounded text-sm"/>
             {reportType !== 'flow' && <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="flex-1 p-2 border rounded text-sm"/>}
           </div>
           <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="w-full p-2 border rounded text-sm mb-2">
             {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
           </select>
        </Card>

        {/* VIEW: Process Flow */}
        {reportType === 'flow' && (
          <div className="space-y-4">
            {/* ONLY Diagram & Filters, Report Table Removed as requested */}
            <h3 className="text-sm font-bold text-gray-500 uppercase">Process Flow</h3>
            {renderFlowDiagram()}
            
            <div className="text-center p-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
               Select "Daily" or "Plan" tabs to view detailed data.
            </div>
          </div>
        )}

        {/* VIEW: Daily Report (Table) */}
        {reportType === 'daily' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="grid grid-cols-4 bg-gray-50 p-3 text-xs font-bold text-gray-500 border-b">
               <div className="col-span-2">Model/Item</div>
               <div className="text-center">Plan</div>
               <div className="text-center">Actual</div>
             </div>
             <div className="divide-y divide-gray-50">
               {reportData.rows.map((row, idx) => (
                 <div key={idx} className="grid grid-cols-4 p-3 text-sm hover:bg-gray-50">
                   <div className="col-span-2 font-medium text-gray-700">{row.model || `${row.machine} - ${row.part}`}</div>
                   <div className="text-center text-gray-500">{row.plan || '-'}</div>
                   <div className="text-center font-bold text-blue-600">{row.actual}</div>
                 </div>
               ))}
               {reportData.rows.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">No data found</div>}
             </div>
             <div className="p-3 bg-gray-50 border-t flex justify-between font-bold text-sm">
               <span>Total Actual</span>
               <span>{reportData.totalActual}</span>
             </div>
          </div>
        )}

        {/* VIEW: Hourly (simplified placeholder) */}
        {reportType === 'hourly' && (
             <div className="text-center p-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
               Hourly breakdown chart would go here.
            </div>
        )}

        {/* VIEW: Export */}
        {reportType === 'export' && (
           <Card className="p-6 text-center space-y-4">
             <FileSpreadsheet size={48} className="mx-auto text-green-600" />
             <div>
               <h3 className="font-bold text-gray-800">Export Matrix Report</h3>
               <p className="text-sm text-gray-500">Download Excel-compatible CSV with daily breakdown.</p>
             </div>
             <button onClick={generateMatrixReport} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
               <Download size={18}/> Download CSV
             </button>
           </Card>
        )}
      </div>
    );
  };

  const renderPlanScreen = () => {
    // Helper to get models for the current active tab (for planning input)
    const getPlanningModels = () => {
      const dataKey = getDataKeyForArea(activeTab);
      if (activeTab === 'CRF') return []; // CRF usually doesn't have model-based planning in this context
      const group = masterData[dataKey];
      if (dataKey === 'WD_LINE') return group["Standard"] || [];
      return Object.values(group).flat();
    };

    const modelsToPlan = getPlanningModels();
    const currentPlanObj = planMode === 'monthly' ? (monthlyPlans[planMonth] || {}) : (dailyPlans[planDate] || {});

    return (
      <div className="space-y-4 pb-24 px-4 max-w-md mx-auto mt-4">
        {/* Area Selector for Planning */}
        <div className="overflow-x-auto pb-2">
           <div className="flex gap-2 min-w-max">
             {AREAS.map(area => (
               <button 
                 key={area} 
                 onClick={() => { setActiveTab(area); setTempPlanData({}); }} // Clear temp data when switching area
                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === area ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
               >
                 {area}
               </button>
             ))}
           </div>
        </div>

        {/* Plan Mode Tabs: Daily | Monthly | Report (NEW) */}
        <div className="flex bg-gray-200 p-1 rounded-xl">
           {['daily', 'monthly', 'report'].map(mode => (
             <button
               key={mode}
               onClick={() => setPlanMode(mode)}
               className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all ${planMode === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
             >
               {mode}
             </button>
           ))}
        </div>

        {/* MODE: Report (Plan vs Actual) */}
        {planMode === 'report' ? (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <Card className="p-3 border-l-4 border-l-purple-500">
                <div className="text-xs font-bold text-gray-400 uppercase mb-2">Report Settings</div>
                <div className="flex gap-2">
                  <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full p-2 border rounded text-sm" />
                  <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="w-full p-2 border rounded text-sm">
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </Card>

              {/* Reuse reportData logic but displayed for Planning context */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                 <div className="p-3 bg-gray-50 border-b font-bold text-gray-700 text-sm flex justify-between items-center">
                   <span>Plan vs Actual Performance</span>
                   <Badge>{reportData.totalActual} units</Badge>
                 </div>
                 <div className="divide-y divide-gray-50">
                   {reportData.rows.map((row, idx) => (
                     <div key={idx} className="p-3 flex justify-between items-center text-sm">
                       <span className="font-medium text-gray-700">{row.model}</span>
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Plan</div>
                            <div className="font-bold text-gray-700">{row.plan}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Actual</div>
                            <div className={`font-bold ${row.actual < row.plan ? 'text-red-500' : 'text-green-600'}`}>{row.actual}</div>
                          </div>
                       </div>
                     </div>
                   ))}
                   {reportData.rows.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">No data for selected date</div>}
                 </div>
              </div>
           </div>
        ) : (
        /* MODE: Input Entry (Daily / Monthly) */
        <Card className="p-4 space-y-4">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               {planMode === 'daily' ? <CalendarDays size={20} className="text-blue-600"/> : <Calendar size={20} className="text-purple-600"/>}
               <span className="font-bold text-gray-700 capitalize">{planMode} Target</span>
             </div>
             {/* Date Pickers */}
             {planMode === 'daily' ? (
                <input type="date" value={planDate} onChange={(e) => { setPlanDate(e.target.value); setTempPlanData({}); }} className="border rounded p-1 text-sm" />
             ) : (
                <input type="month" value={planMonth} onChange={(e) => { setPlanMonth(e.target.value); setTempPlanData({}); }} className="border rounded p-1 text-sm" />
             )}
           </div>

           <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
             {modelsToPlan.length > 0 ? modelsToPlan.map(model => (
               <div key={model} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                 <span className="text-sm font-medium text-gray-700">{model}</span>
                 <input 
                   type="number" 
                   placeholder={currentPlanObj[model] || "0"} 
                   // If temp data exists, show it, otherwise show saved plan
                   value={tempPlanData[model] !== undefined ? tempPlanData[model] : (currentPlanObj[model] || '')}
                   onChange={(e) => handlePlanInputChange(model, e.target.value)}
                   className="w-24 p-2 border rounded-lg text-right font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                 />
               </div>
             )) : (
               <div className="text-center p-4 text-gray-400 text-sm">
                 No models configured for {activeTab}. Check Settings.
               </div>
             )}
           </div>

           {/* SAVE BUTTON - Ensures plans are saved */}
           <div className="pt-2 border-t">
             <button 
               onClick={handleSavePlan} 
               className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               <Save size={18} />
               Save {planMode} Plan
             </button>
           </div>
        </Card>
        )}
      </div>
    );
  };

  const renderSettingsScreen = () => {
    if (!isSettingsUnlocked) return (
      <div className="p-8 flex flex-col items-center justify-center space-y-4">
        <div className="bg-gray-100 p-4 rounded-full"><Lock size={48} className="text-gray-400"/></div>
        <h3 className="text-lg font-bold text-gray-700">Settings Locked</h3>
        <p className="text-gray-500 text-center text-sm">Please enter the admin PIN to access settings.</p>
        <div className="flex gap-2">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="p-2 border rounded text-center w-32" placeholder="PIN" />
            <button onClick={() => handleUnlock('settings')} className="bg-blue-600 text-white p-2 rounded">Unlock</button>
        </div>
      </div>
    );

    const safeGroupData = (settingsGroup === 'CRF_MACHINES') ? masterData.CRF_MACHINES : masterData.CF_LINE;

    return (
    <div className="space-y-4 pb-24 px-4 max-w-md mx-auto mt-4">
        {/* Supervisor Management */}
        <Card className="p-4 space-y-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><User size={18} /> Manage Supervisors</h3>
            <div className="flex gap-2">
                <input type="text" placeholder="Name" value={newSupervisorName} onChange={(e) => setNewSupervisorName(e.target.value)} className="flex-1 p-2 border rounded text-sm"/>
                <input type="text" placeholder="Phone (91...)" value={newSupervisorPhone} onChange={(e) => setNewSupervisorPhone(e.target.value)} className="w-28 p-2 border rounded text-sm"/>
            </div>
            <select value={selectedShiftId} onChange={(e) => setSelectedShiftId(e.target.value)} className="w-full p-2 border rounded text-sm">
                {shiftConfig.shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start}-{s.end})</option>)}
            </select>
            <button onClick={handleAddSupervisor} className="w-full py-2 bg-blue-600 text-white rounded font-bold text-sm">Add Supervisor</button>
            <div className="space-y-2 mt-2">
                {shiftConfig.supervisors && shiftConfig.supervisors.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                        <div><div className="font-bold text-sm">{s.name}</div><div className="text-xs text-gray-500">{s.phone}</div></div>
                        <div className="flex gap-2">
                           {s.phone && <button onClick={() => handleWhatsAppReminder(s.phone, s.name)} className="text-green-600 bg-green-100 p-1.5 rounded"><MessageCircle size={14}/></button>}
                           <button onClick={() => handleDeleteSupervisor(s.name)} className="text-red-500 bg-red-100 p-1.5 rounded"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>

        {/* Master Data Management */}
        <Card className="p-4 space-y-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><Settings size={18} /> Master Data</h3>
            <div className="flex bg-gray-100 rounded p-1 mb-2">
                {['CF_LINE', 'CRF_MACHINES', 'WD_LINE'].map(k => (
                    <button key={k} onClick={() => setSettingsGroup(k)} className={`flex-1 py-1 text-xs font-bold rounded ${settingsGroup === k ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>{k === 'CF_LINE' ? 'Assembly' : (k === 'WD_LINE' ? 'WD' : 'CRF')}</button>
                ))}
            </div>
            
            {settingsGroup !== 'WD_LINE' && (
            <div className="space-y-2 border-b pb-4">
                <label className="text-xs font-bold text-gray-500 uppercase">Add New Group/Machine</label>
                <div className="flex gap-2">
                    <input type="text" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} placeholder={settingsGroup === 'CF_LINE' ? "New Category (e.g. 600L)" : "New Machine"} className="flex-1 p-2 border rounded text-sm"/>
                    <button onClick={handleSettingsAddCategory} className="bg-green-600 text-white px-3 rounded"><Plus size={18}/></button>
                </div>
            </div>
            )}

            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Add New Item/Model</label>
                {settingsGroup !== 'WD_LINE' && (
                <select value={targetCategoryForModel} onChange={(e) => setTargetCategoryForModel(e.target.value)} className="w-full p-2 border rounded text-sm mb-2">
                    <option value="">Select Target Group...</option>
                    {Object.keys(safeGroupData).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                )}
                <div className="flex gap-2">
                    <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item Name / Model" className="flex-1 p-2 border rounded text-sm"/>
                    <button onClick={handleSettingsAddItem} className="bg-blue-600 text-white px-3 rounded"><Plus size={18}/></button>
                </div>
            </div>

            <div className="mt-4 space-y-4">
                {settingsGroup === 'WD_LINE' ? (
                   <div>
                       <div className="font-bold text-sm bg-gray-100 p-2 rounded text-gray-700">Standard Models</div>
                       {masterData.WD_LINE["Standard"] && masterData.WD_LINE["Standard"].map(m => (
                           <div key={m} className="flex justify-between py-2 pl-2 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50">
                               <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                               <div className="flex gap-3">
                                   <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>{activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                                   <button onClick={() => handleSettingsDeleteItem(settingsGroup, m)} className="text-red-400"><Trash2 size={14}/></button>
                               </div>
                           </div>
                       ))}
                   </div>
                ) : (
                Object.keys(safeGroupData).map(cat => (
                    <div key={cat} className="border border-gray-100 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 p-2 flex justify-between items-center">
                            <span className="font-bold text-sm text-gray-700">{cat}</span>
                            <button onClick={() => handleSettingsDeleteCategory(settingsGroup, cat)} className="text-red-400 hover:bg-red-100 p-1 rounded" title="Delete Group"><Trash2 size={14}/></button>
                        </div>
                        {Array.isArray(safeGroupData[cat]) && safeGroupData[cat].map(m => (
                             <div key={m} className="flex justify-between py-2 pl-2 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50">
                               <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                               <div className="flex gap-3">
                                   <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>{activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                                   <button onClick={() => handleSettingsDeleteItem(settingsGroup, m, cat)} className="text-red-400"><Trash2 size={14}/></button>
                               </div>
                           </div>
                        ))}
                    </div>
                ))
                )}
            </div>
        </Card>
    </div>
    );
  };

  const renderContent = () => {
    switch (view) { case 'entry': return renderEntryScreen(); case 'report': return renderReportScreen(); case 'plan': return renderPlanScreen(); case 'settings': return renderSettingsScreen(); default: return renderEntryScreen(); }
  };

  return (<div className="min-h-screen bg-gray-50 font-sans text-gray-900">{renderHeader()}<main>{renderContent()}</main>{notification && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-[70] animate-in fade-in slide-in-from-bottom-4 flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>{notification}</div>}{!isPlanUnlocked && view === 'plan' && (<div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-4"><div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock size={32}/></div><h2 className="text-2xl font-bold text-gray-800">Plan Locked</h2><p className="text-gray-500">Enter Admin PIN to manage production plans.</p><input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-4 text-center text-2xl tracking-widest border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all" placeholder="••••" maxLength={4}/><button onClick={() => handleUnlock('plan')} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all transform active:scale-95 shadow-lg shadow-blue-200">Unlock Dashboard</button><button onClick={() => setView('entry')} className="text-sm text-gray-400 hover:text-gray-600 font-medium">Go Back</button></div></div>)}</div>);
}
