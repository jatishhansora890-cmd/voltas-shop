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

  // Report State
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [reportArea, setReportArea] = useState(AREAS[0]);
  const [reportType, setReportType] = useState('daily');
  const [reportModel, setReportModel] = useState('');
  const [productionTimeframe, setProductionTimeframe] = useState('daily');
 
  // Plan Report State
  const [planReportMode, setPlanReportMode] = useState('monthly');
  const [rangeStart, setRangeStart] = useState(new Date().toISOString().split('T')[0]);
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().split('T')[0]);

  // NEW: Advanced Export Filters State
  const [exportRangeStart, setExportRangeStart] = useState(new Date().toISOString().split('T')[0]);
  const [exportRangeEnd, setExportRangeEnd] = useState(new Date().toISOString().split('T')[0]);
  const [exportSupervisor, setExportSupervisor] = useState('');
  const [exportArea, setExportArea] = useState(AREAS[0]);
  // --- NEW FILTERS ---
  const [exportCategory, setExportCategory] = useState('');
  const [exportModel, setExportModel] = useState('');
  const [exportMachine, setExportMachine] = useState('');

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
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Auth Error", e);
        setDbStatus('error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setDbStatus('connected');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
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
            if (doc.id === 'masterData') {
                const dbData = d.data;
                if (dbData && Array.isArray(dbData.CRF_MACHINES)) {
                    setMasterData(INITIAL_MASTER_DATA);
                    updateSettingsDoc('masterData', INITIAL_MASTER_DATA); 
                } else {
                    setMasterData(prev => ({...INITIAL_MASTER_DATA, ...dbData}));
                }
            }
            if (doc.id === 'activeModels') setActiveModels(d.data || {});
            if (doc.id === 'monthlyPlans') setMonthlyPlans(d.data || {});
            if (doc.id === 'dailyPlans') setDailyPlans(d.data || {});
            if (doc.id === 'shiftConfig') setShiftConfig(d.data || INITIAL_SHIFT_CONFIG);
        });
    }, (err) => console.error("Settings Sync Error", err));

    return () => {
        unsubEntries();
        unsubSettings();
    };
  }, [user]);

  useEffect(() => {
      const checkHourlyReminder = () => {
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          if (currentMinute === 0 && lastNotifiedHour !== currentHour) {
              setLastNotifiedHour(currentHour);
              if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("Voltas Production Reminder", {
                      body: "It's time to update the hourly production data!",
                      icon: "/vite.svg" 
                  });
              } else {
                  showNotification("🔔 Reminder: Update Hourly Report!");
              }
          }
      };
      const interval = setInterval(checkHourlyReminder, 15000); 
      return () => clearInterval(interval);
  }, [lastNotifiedHour]);

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

  const handleAddSupervisor = async () => {
      if(!newSupervisorName) return;
      const newConfig = { ...shiftConfig };
      if (!newConfig.supervisors) newConfig.supervisors = [];
      newConfig.supervisors = [...newConfig.supervisors, {
          name: newSupervisorName,
          phone: newSupervisorPhone,
          shiftId: parseInt(selectedShiftId)
      }];
      setShiftConfig(newConfig);
      setNewSupervisorName('');
      setNewSupervisorPhone('');
      await updateSettingsDoc('shiftConfig', newConfig);
      showNotification("Supervisor Added");
  };

  const handleDeleteSupervisor = async (name) => {
      if(!confirm("Remove Supervisor?")) return;
      const newConfig = { ...shiftConfig };
      newConfig.supervisors = newConfig.supervisors.filter(s => s.name !== name);
      setShiftConfig(newConfig);
      await updateSettingsDoc('shiftConfig', newConfig);
  };

  const handleWhatsAppReminder = (phone, name) => {
      const text = `Hello ${name}, this is a reminder to update the Voltas Production Hourly Report for the current hour.`;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
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
    setMasterData(newMasterData); 
    setNewCategoryInput(''); 
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

    setMasterData(newMasterData); 
    setActiveModels(newActiveModels); 
    setNewItemName('');
    await updateSettingsDoc('masterData', newMasterData); 
    await updateSettingsDoc('activeModels', newActiveModels); 
    showNotification(`Item Added`);
  };

  const handleSettingsDeleteCategory = async (group, categoryName) => {
      if(!confirm(`Delete Group "${categoryName}"?`)) return;
      let newMasterData = JSON.parse(JSON.stringify(masterData));
      if (group === 'CF_LINE') delete newMasterData.CF_LINE[categoryName];
      if (group === 'CRF_MACHINES') delete newMasterData.CRF_MACHINES[categoryName];
      setMasterData(newMasterData); 
      await updateSettingsDoc('masterData', newMasterData); 
      showNotification("Group Deleted");
  };

  const handleSettingsDeleteItem = async (group, item, category = null) => {
    if (!confirm(`Delete ${item}?`)) return;
    let newMasterData = JSON.parse(JSON.stringify(masterData));
    if (group === 'CF_LINE' && category) {
        newMasterData.CF_LINE[category] = newMasterData.CF_LINE[category].filter(i => i !== item);
    } else if (group === 'CRF_MACHINES' && category) {
        newMasterData.CRF_MACHINES[category] = newMasterData.CRF_MACHINES[category].filter(i => i !== item);
    } else if (group === 'WD_LINE') {
        newMasterData.WD_LINE["Standard"] = (newMasterData.WD_LINE["Standard"] || []).filter(i => i !== item);
    }
    setMasterData(newMasterData); 
    await updateSettingsDoc('masterData', newMasterData); 
    showNotification("Deleted");
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

    const payload = {
        timestamp: Date.now(),
        date: entryDate,
        area: activeTab,
        supervisor: supervisorName,
        items: currentBatch
    };

    try {
        if (editingId) {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'production_entries', editingId);
            await updateDoc(docRef, payload);
            showNotification("Entry Updated Successfully!");
            setEditingId(null);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'production_entries'), payload);
            showNotification("Production Submitted!");
        }
        setCurrentBatch([]);
    } catch (e) {
        console.error(e);
        showNotification("Error Saving Data");
    }
  };

  const handleEditEntry = (entry) => {
      setEntryDate(entry.date);
      setSupervisorName(entry.supervisor);
      setCurrentBatch(entry.items);
      setEditingId(entry.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showNotification("Loaded entry for editing");
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setCurrentBatch([]);
      setSupervisorName('');
  };

  const handleDeleteEntry = async (id) => {
      if(!confirm("Are you sure you want to permanently delete this entry?")) return;
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'production_entries', id));
          showNotification("Entry Deleted");
      } catch(e) {
          showNotification("Error Deleting");
      }
  };

  const handleSavePlan = async () => {
    if (!user) return;
    if (planMode === 'monthly') {
      const newPlans = { ...monthlyPlans, [planMonth]: tempPlanData };
      setMonthlyPlans(newPlans); await updateSettingsDoc('monthlyPlans', newPlans); showNotification("Monthly Budget Saved!");
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
    const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.setAttribute('href', url); link.setAttribute('download', `${filename}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- GENERATE WHATSAPP REPORT ---
  const handleGenerateReport = () => {
      const todayEntries = entries.filter(e => e.date === entryDate && e.area === activeTab);
      const modelStats = {};
      let totalActual = 0;
      let totalPlan = 0;

      todayEntries.forEach(e => {
          e.items.forEach(i => {
              if (!modelStats[i.model]) modelStats[i.model] = 0;
              modelStats[i.model] += i.qty;
              totalActual += i.qty;
          });
      });

      const dataKey = getDataKeyForArea(activeTab);
      const isWD = dataKey === 'WD_LINE';
      const todaysPlanObj = dailyPlans[entryDate] || {};
      
      let allModels = [];
      if(activeTab === 'CRF') {
          allModels = Object.keys(modelStats);
      } else {
          const group = masterData[dataKey];
          allModels = isWD ? (group["Standard"] || []) : Object.values(group).flat();
      }

      let modelLines = "";
      allModels.forEach(m => {
          const actual = modelStats[m] || 0;
          const plan = todaysPlanObj[m] || 0;
          if (activeModels[m] === false && actual === 0 && plan === 0) return;
          if (actual > 0 || plan > 0) {
              modelLines += `${m} :- ${actual}${plan > 0 ? ` / ${plan}` : ''} nos.%0A`;
              totalPlan += plan;
          }
      });

      const dateParts = entryDate.split('-'); 
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

      const message = `*${activeTab.toUpperCase()} PRODUCTION REPORT..*%0A%0A` +
                      `*DATE :-* ${formattedDate}%0A` +
                      `*Shift :-* ${reportParams.shift}%0A` +
                      `*Man power :-* ${reportParams.manpower}%0A%0A` +
                      `${modelLines}%0A` +
                      `*Total :-  ${totalActual} ${totalPlan > 0 ? `/ ${totalPlan}` : ''} nos.*%0A%0A` +
                      `Major Losses :-${reportParams.losses ? '%0A' + encodeURIComponent(reportParams.losses) : ' Nil'}`;

      window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  // --- NEW: FULL FILTER MATRIX REPORT ---
  const generateMatrixReport = () => {
      // 1. Get Dates
      const start = new Date(exportRangeStart);
      const end = new Date(exportRangeEnd);
      const dates = [];
      for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d).toISOString().split('T')[0]);
      }

      // 2. Identify Models based on Filters (Area, Category, Model, Machine)
      const dataKey = getDataKeyForArea(exportArea);
      const isWD = dataKey === 'WD_LINE';
      let allModels = [];

      if (exportArea === 'CRF') {
          // For CRF, if a Machine is selected, we ideally want Parts associated with it
          // OR simply filter the entries. Let's find unique parts from data + filter by machine logic
          // Getting models/parts list:
          let machineParts = [];
          if (exportMachine && masterData.CRF_MACHINES[exportMachine]) {
              machineParts = masterData.CRF_MACHINES[exportMachine]; // Use master data if machine selected
          }
          
          const uniqueEntryParts = [...new Set(entries.filter(e => e.area === 'CRF').flatMap(e => e.items.map(i => i.model)))];
          
          if (exportMachine) {
              // Intersection of Master Data Parts and Actual Produced Parts (to show activity)
              allModels = machineParts; 
          } else {
              allModels = uniqueEntryParts;
          }
      } else {
          // Assembly / WD
          const group = masterData[dataKey];
          if(isWD) {
             allModels = group["Standard"] || [];
          } else {
             // If Category Filter is ON
             if (exportCategory) {
                 allModels = group[exportCategory] || [];
             } else {
                 allModels = Object.values(group).flat();
             }
          }
      }

      // Apply Single Model Filter
      if (exportModel) {
          allModels = allModels.filter(m => m === exportModel);
      }
      
      allModels.sort();

      // 3. Prepare Data
      const grandTotal = { Category: 'Grand Total', 'Tot. Monthly Plan': 0, 'Tot.Act': 0, 'Bal.prod': 0, '% Ach': '' };
      dates.forEach(date => { grandTotal[`${date} Plan`] = 0; grandTotal[`${date} Act`] = 0; });

      const reportRows = allModels.map(model => {
          const row = { Category: model }; // CSV Key uses 'Category' as header for Model Name
          const currentMonth = exportRangeStart.slice(0, 7);
          const monthlyBudget = (monthlyPlans[currentMonth] && monthlyPlans[currentMonth][model]) || 0;
          
          // --- FILTERED TOTAL ACTUAL CALCULATION ---
          // Filter Entries by: Date Range, Area, Supervisor
          const modelEntries = entries.filter(e => 
              e.area === exportArea && 
              (!exportSupervisor || e.supervisor === exportSupervisor) && 
              e.date >= exportRangeStart && 
              e.date <= exportRangeEnd
          );
          
          // Sum up items, optionally filtering by Machine for CRF
          const totalActual = modelEntries.reduce((sum, e) => {
              const item = e.items.find(i => 
                  i.model === model && 
                  (!exportMachine || i.machine === exportMachine) // MACHINE FILTER HERE
              );
              return sum + (item ? item.qty : 0);
          }, 0);

          const balance = monthlyBudget - totalActual;
          const percent = monthlyBudget > 0 ? Math.round((totalActual / monthlyBudget) * 100) : 0;
          row['Tot. Monthly Plan'] = monthlyBudget; row['Tot.Act'] = totalActual; row['Bal.prod'] = balance; row['% Ach'] = `${percent}%`;
          grandTotal['Tot. Monthly Plan'] += monthlyBudget; grandTotal['Tot.Act'] += totalActual; grandTotal['Bal.prod'] += balance;
          
          // --- DAILY COLUMNS ---
          dates.forEach(date => {
              const dayPlan = (dailyPlans[date] && dailyPlans[date][model]) || 0;
              
              const dayEntries = entries.filter(e => 
                  e.date === date && 
                  e.area === exportArea && 
                  (!exportSupervisor || e.supervisor === exportSupervisor)
              );
              
              const dayActual = dayEntries.reduce((sum, e) => {
                   const item = e.items.find(i => 
                       i.model === model && 
                       (!exportMachine || i.machine === exportMachine) // MACHINE FILTER HERE
                   );
                   return sum + (item ? item.qty : 0);
              }, 0);

              row[`${date} Plan`] = dayPlan; row[`${date} Act`] = dayActual;
              grandTotal[`${date} Plan`] += dayPlan; grandTotal[`${date} Act`] += dayActual;
          });
          return row;
      });

      const gtPercent = grandTotal['Tot. Monthly Plan'] > 0 ? Math.round((grandTotal['Tot.Act'] / grandTotal['Tot. Monthly Plan']) * 100) : 0;
      grandTotal['% Ach'] = `${gtPercent}%`;
      reportRows.push(grandTotal);
      
      // Filename generation
      let fname = `Report_${exportArea}`;
      if(exportCategory) fname += `_${exportCategory}`;
      if(exportModel) fname += `_${exportModel}`;
      if(exportMachine) fname += `_${exportMachine}`;
      fname += `_${exportRangeStart}`;

      exportToCSV(reportRows, fname);
  };

  // --- Reports Data ---
  
  const productionReportData = useMemo(() => {
    const isMonthly = productionTimeframe === 'monthly';
    const filterFn = (entry) => entry.area === reportArea && (isMonthly ? entry.date.startsWith(reportMonth) : entry.date === reportDate);
    const filtered = entries.filter(filterFn);
    const isCRF = reportArea === 'CRF';
    const isDoorFoaming = reportArea === 'Door foaming';
    const plan = isMonthly ? (monthlyPlans[reportMonth] || {}) : (dailyPlans[reportDate] || {});

    if (isCRF) {
        const rows = [];
        filtered.forEach(record => {
            record.items.forEach(item => {
                let existing = rows.find(r => r.machine === item.machine && r.part === item.part && r.model === item.model);
                if (!existing) { existing = { machine: item.machine, part: item.part, model: item.model, actual: 0 }; rows.push(existing); }
                existing.actual += item.qty;
            });
        });
        return { rows: rows.sort((a,b) => b.actual - a.actual), totalActual: rows.reduce((s, r) => s + r.actual, 0) };
    } else {
        const actuals = {};
        let totalActual = 0;
        filtered.forEach(record => {
            record.items.forEach(item => {
                if (!actuals[item.model]) actuals[item.model] = 0;
                actuals[item.model] += item.qty;
                totalActual += item.qty;
            });
        });
        const comparison = [];
        const relevantDataKey = getDataKeyForArea(reportArea);
       
        let relevantModels = [];
        if (masterData[relevantDataKey]) {
            const allModels = Object.values(masterData[relevantDataKey]).flat();
            relevantModels = [...new Set(allModels)];
        }
       
        relevantModels.forEach(model => {
             if (activeModels[model] !== false || plan[model] || actuals[model]) {
                const basePlan = plan[model] || 0;
                const p = isDoorFoaming ? basePlan * 2 : basePlan;
                const a = actuals[model] || 0;
                comparison.push({ model, plan: p, actual: a, percent: p > 0 ? Math.round((a / p) * 100) : (a > 0 ? 100 : 0) });
             }
        });
        return { rows: comparison.sort((a, b) => b.actual - a.actual), totalActual };
    }
  }, [entries, dailyPlans, monthlyPlans, reportDate, reportMonth, reportArea, productionTimeframe, activeModels, masterData]);

  const handleEditPlanFromReport = (mode, dateKey) => {
    if (mode === 'monthly') { setPlanMode('monthly'); setPlanMonth(dateKey); }
    else { setPlanMode('daily'); setPlanDate(dateKey); }
    setIsPlanUnlocked(true);
    setView('plan');
  };

  const processFlowData = useMemo(() => {
    const planData = monthlyPlans[reportMonth] || {}; 
    const periodEntries = entries.filter(e => e.date.startsWith(reportMonth)); 
    const cfModels = masterData.CF_LINE ? Object.values(masterData.CF_LINE).flat() : []; 
    const targetModels = reportModel ? [reportModel] : cfModels;
    
    let totalPlan = 0; 
    targetModels.forEach(m => { if (planData[m]) totalPlan += planData[m]; });
    const areaActuals = {}; 
    AREAS.forEach(area => areaActuals[area] = 0);
    periodEntries.forEach(entry => { 
        if (entry.area === 'CRF') return; 
        entry.items.forEach(item => { 
            if (!reportModel || item.model === reportModel) areaActuals[entry.area] += item.qty; 
        }); 
    });
    return { totalPlan, areaActuals };
  }, [monthlyPlans, entries, reportMonth, reportModel, masterData]);

  const planReportData = useMemo(() => {
    let data = []; const allModels = new Set();
    Object.values(masterData).forEach(group => { if(Array.isArray(group)) return; Object.values(group).forEach(arr => arr.forEach(m => allModels.add(m))) });
    if (planReportMode === 'monthly') {
      const plan = monthlyPlans[reportMonth] || {}; Array.from(allModels).forEach(model => { if (plan[model]) data.push({ model, qty: plan[model] }); });
      return { modelAggregates: data.sort((a,b) => b.qty - a.qty) };
    } else {
      const start = new Date(rangeStart); const end = new Date(rangeEnd); const dates = [];
      for(let d = start; d <= end; d.setDate(d.getDate() + 1)) dates.push(new Date(d).toISOString().split('T')[0]);
      const modelTotals = {}; dates.forEach(date => { const dayPlan = dailyPlans[date] || {}; Object.entries(dayPlan).forEach(([model, qty]) => { modelTotals[model] = (modelTotals[model] || 0) + qty; }); });
      data = Object.entries(modelTotals).map(([model, qty]) => ({ model, qty }));
      const dailyBreakdown = dates.map(date => { const dayPlan = dailyPlans[date] || {}; const total = Object.values(dayPlan).reduce((a, b) => a + b, 0); return { date, total }; });
      return { modelAggregates: data.sort((a,b) => b.qty - a.qty), dailyBreakdown };
    }
  }, [planReportMode, reportMonth, rangeStart, rangeEnd, monthlyPlans, dailyPlans, masterData]);

  const hourlyReportData = useMemo(() => {
    const filtered = entries.filter(e => e.date === reportDate && e.area === reportArea);
    const hoursMap = {}; 
    let dayTotal = 0;

    filtered.forEach(entry => {
        const dateObj = new Date(entry.timestamp);
        const hour = dateObj.getHours(); 
        const label = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`;
        if (!hoursMap[label]) hoursMap[label] = 0;
        const entryQty = entry.items.reduce((sum, item) => sum + item.qty, 0);
        hoursMap[label] += entryQty;
        dayTotal += entryQty;
    });

    const sortedKeys = Object.keys(hoursMap).sort();
    let runningTotal = 0;
    const rows = sortedKeys.map(timeSlot => {
        const qty = hoursMap[timeSlot];
        runningTotal += qty;
        return { 
            time: timeSlot, 
            qty: qty, 
            cumulative: runningTotal,
            percent: dayTotal > 0 ? (qty / dayTotal) * 100 : 0 
        };
    });
    return { rows, total: dayTotal };
  }, [entries, reportDate, reportArea]);

  // --- Renderers ---

  const renderHeader = () => (
    <header className="bg-blue-700 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex flex-col"><h1 className="text-xl font-bold tracking-tight">Voltas Production</h1><span className="text-xs text-blue-200">Vadodara Plant Operations</span></div>
        <div className="flex gap-2 items-center">
          {dbStatus === 'connected' ? <Wifi size={16} className="text-green-300"/> : <WifiOff size={16} className="text-red-300"/>}
          {['entry', 'report', 'plan', 'settings'].map(m => (
            <button key={m} onClick={() => setView(m)} className={`p-2 rounded-full transition-all ${view === m ? 'bg-white text-blue-700' : 'bg-blue-600 text-blue-100'}`}>
              {m === 'entry' && <PenTool size={18} />}
              {m === 'report' && <BarChart3 size={18} />}
              {m === 'plan' && (isPlanUnlocked ? <Unlock size={18} /> : <Lock size={18} />)}
              {m === 'settings' && (isSettingsUnlocked ? <Settings size={18} /> : <Lock size={18} />)}
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
              <div>
                  <div className="text-xs font-bold text-blue-100 uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Current Hour ({currentHourLabel})</div>
                  <div className="text-2xl font-bold">{qtyThisHour} <span className="text-sm font-normal text-blue-200">units</span></div>
              </div>
              <div className="bg-white/20 p-2 rounded-lg"><BarChart3 size={24} className="text-white"/></div>
          </div>

          <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entry Date</label>
                      <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full p-2 border rounded text-sm mb-2" />
                      
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supervisor Name</label>
                      <div className="relative">
                          <select value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="w-full p-2 border rounded text-sm bg-white appearance-none">
                              <option value="">Select Supervisor...</option>
                              {shiftConfig.supervisors && shiftConfig.supervisors.map((s, idx) => (
                                  <option key={idx} value={s.name}>{s.name}</option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                      </div>
                  </div>
              </div>
          </Card>
         
          <Card className={`p-4 space-y-4 ${editingId ? 'border-2 border-orange-300 bg-orange-50' : ''}`}>
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">{editingId ? <><Pencil size={16} className="text-orange-600"/> Edit Mode</> : 'Add Production'}</h3>
                {editingId && <button onClick={handleCancelEdit} className="text-xs text-red-500 font-bold border border-red-200 px-2 py-1 rounded bg-white">Cancel Edit</button>}
                {!editingId && <Badge active>{activeTab}</Badge>}
            </div>
           
            <div className="grid grid-cols-1 gap-3">
              {isCRF && (<div><label className="text-xs text-gray-500 font-semibold mb-1 block">Select Machine</label><div className="relative"><select value={selectedMachine} onChange={(e) => { setSelectedMachine(e.target.value); setSelectedSubCategory(''); }} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Machine...</option>{Object.keys(safeCRFData).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              {isCRF && (<div className={!selectedMachine ? "opacity-50 pointer-events-none" : ""}><label className="text-xs text-gray-500 font-semibold mb-1 block">Select Part</label><div className="relative"><select value={selectedSubCategory} onChange={(e) => setSelectedSubCategory(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Part...</option>{(selectedMachine && safeCRFData[selectedMachine] ? safeCRFData[selectedMachine] : []).map(opt => (<option key={opt} value={opt}>{opt}</option>))}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              {!isWD && (<div><label className="text-xs text-gray-500 font-semibold mb-1 block">Product Category</label><div className="relative"><select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedModel(''); }} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Category...</option>{Object.keys(masterData.CF_LINE).map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              {(selectedCategory || isWD) && (<div className="animate-in fade-in slide-in-from-top-2 duration-300"><label className="text-xs text-gray-500 font-semibold mb-1 block">{isCRF ? 'For Model (Target)' : 'Model'}</label><div className="relative"><select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500 appearance-none"><option value="">Select Model</option>{filterActive(isWD ? masterData.WD_LINE["Standard"] : (masterData.CF_LINE[selectedCategory] || [])).map(model => (<option key={model} value={model}>{model}</option>))}</select><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={16} /></div></div>)}
              <div className="flex gap-3 items-end"><div className="flex-1"><label className="text-xs text-gray-500 font-semibold mb-1 block">Quantity</label><input type="number" value={currentQty} onChange={(e) => setCurrentQty(e.target.value)} placeholder="0" className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-500" /></div><button onClick={handleAddBatchItem} className="bg-blue-600 text-white p-3 rounded-lg font-medium flex items-center gap-2"><Plus size={20} /> Add</button></div>
            </div>
          </Card>

          {currentBatch.length > 0 && (<div className="space-y-2 animate-in fade-in slide-in-from-bottom-4"><h3 className="text-sm font-semibold text-gray-500 ml-1">Entries to {editingId ? 'Update' : 'Submit'}</h3>{currentBatch.map((item) => (<div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm"><div>{isCRF ? (<><div className="font-bold text-gray-800">{item.part}</div><div className="text-xs text-gray-500">{item.machine} | {item.category} - {item.model}</div></>) : (<><div className="font-bold text-gray-800">{item.model}</div>{!isWD && <div className="text-xs text-gray-500">{item.category}</div>}</>)}</div><div className="flex items-center gap-4"><span className="text-lg font-bold text-blue-600">{item.qty}</span><button onClick={() => removeBatchItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button></div></div>))}</div>)}
          
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50">
             <div className="max-w-md mx-auto p-4 flex gap-2">
                 <button onClick={() => setShowReportModal(true)} className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-green-50 border border-green-200 hover:bg-green-100 flex items-center justify-center gap-2">
                     <MessageCircle size={20} className="text-green-600"/> End Shift Report
                 </button>
                 <button onClick={handleSubmitProduction} disabled={!supervisorName || currentBatch.length === 0} className={`flex-[2] py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg text-white disabled:bg-gray-200 disabled:text-gray-400 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                     {(!supervisorName || currentBatch.length === 0) ? <><AlertCircle size={20} /> Complete</> : (editingId ? <><RefreshCw size={20} /> Update</> : <><Save size={20} /> Submit</>)}
                 </button>
             </div>
          </div>
         
          {recentEntries.length > 0 && (
              <div className="mt-8 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2"><History size={16} /> Recent Submissions ({entryDate})</h3>
                  <div className="space-y-3">
                      {recentEntries.map(entry => (
                          <div key={entry.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                  <div><span className="font-bold text-gray-800 block">{entry.supervisor}</span><span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                  <div className="flex gap-2"><button onClick={() => handleEditEntry(entry)} className="p-1.5 bg-white border border-gray-200 rounded text-blue-600 shadow-sm"><Pencil size={14} /></button><button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 bg-white border border-gray-200 rounded text-red-500 shadow-sm"><Trash2 size={14} /></button></div>
                              </div>
                              <div className="space-y-1">
                                  {entry.items.map((item, idx) => (<div key={idx} className="flex justify-between text-xs text-gray-600 border-b border-gray-200 last:border-0 pb-1 last:pb-0"><span>{isCRF ? `${item.part} (${item.model})` : item.model}</span><span className="font-bold">{item.qty}</span></div>))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
        
        {/* END SHIFT REPORT MODAL */}
        {showReportModal && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-green-600 p-4 flex justify-between items-center text-white">
                        <h3 className="font-bold text-lg flex items-center gap-2"><MessageCircle size={20}/> End Shift Report</h3>
                        <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Shift Type</label>
                            <select value={reportParams.shift} onChange={e => setReportParams({...reportParams, shift: e.target.value})} className="w-full p-2 border rounded bg-white">
                                <option>General Shift</option>
                                <option>Shift A</option>
                                <option>Shift B</option>
                                <option>Shift C</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Manpower Count</label>
                            <input type="number" placeholder="e.g. 12" value={reportParams.manpower} onChange={e => setReportParams({...reportParams, manpower: e.target.value})} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Major Losses / Remarks</label>
                            <textarea placeholder="- Machine breakdown (14:00-14:30)..." rows={4} value={reportParams.losses} onChange={e => setReportParams({...reportParams, losses: e.target.value})} className="w-full p-2 border rounded text-sm"></textarea>
                        </div>
                        <button onClick={handleGenerateReport} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700">
                            <Share2 size={18}/> Share on WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    );
  };

  const renderReportScreen = () => {
    const isCRF = reportArea === 'CRF';
    // Logic for dropdown population
    const areaData = masterData[getDataKeyForArea(exportArea)];
    const availableCategories = (exportArea === 'CRF' || exportArea === 'WD final') ? [] : Object.keys(areaData || {});
    const availableModels = (exportArea === 'CRF' || exportArea === 'WD final') 
        ? [] // handled differently or standard
        : (exportCategory ? (areaData[exportCategory] || []) : []);
    const availableMachines = Object.keys(masterData.CRF_MACHINES || {});

    return (
    <div className="p-4 max-w-md mx-auto space-y-6 pb-20">
      
      {/* Navigation Tabs */}
      <div className="flex bg-gray-200 p-1 rounded-lg overflow-x-auto no-scrollbar">
          {['flow', 'daily', 'hourly', 'export'].map(t => (
             <button key={t} onClick={() => setReportType(t)} className={`flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all whitespace-nowrap capitalize ${reportType === t ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}>
                {t === 'flow' ? 'Process Flow' : t === 'daily' ? 'Production' : t === 'hourly' ? 'Hourly' : 'Adv. Export'}
             </button>
          ))}
      </div>
     
      {/* 1. PROCESS FLOW VIEW */}
      {reportType === 'flow' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           <Card className="p-4 bg-white border border-gray-200">
            <div className="flex justify-between items-start mb-2"><h3 className="text-xs font-bold text-gray-400 uppercase">Flow Configuration</h3><button onClick={() => { const rows = PROCESS_FLOW.mainLine.map((area, idx) => { const actual = processFlowData.areaActuals[area]; const bal = processFlowData.totalPlan - actual; const prev = idx > 0 ? PROCESS_FLOW.mainLine[idx-1] : null; const wip = prev ? (processFlowData.areaActuals[prev] - actual) : 0; return { Area: area, Month_Plan: processFlowData.totalPlan, Actual: actual, Balance: bal, WIP_Stock: wip }; }); exportToCSV(rows, `Process_Flow_${reportMonth}`); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold"><Download size={14}/> Export</button></div>
            <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Month</label><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-500 mb-1 block">Model Filter</label><select value={reportModel} onChange={(e) => setReportModel(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm bg-white"><option value="">All Models</option>{(masterData.CF_LINE ? Object.values(masterData.CF_LINE).flat().sort() : []).map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            </div>
          </Card>
          <div className="space-y-0">
             <div className="flex items-center gap-2 mb-2 px-1"><GitMerge size={18} className="text-blue-600"/><h3 className="font-bold text-gray-700">Line Status (Monthly)</h3></div>
             <div className="bg-blue-100 p-3 rounded-t-xl border border-blue-200 text-center"><div className="text-xs font-bold text-blue-600 uppercase">{reportModel ? `Budget (${reportModel})` : 'Total Budget'}</div><div className="text-2xl font-bold text-blue-800">{processFlowData.totalPlan}</div></div>
             <div className="bg-white border-x border-b border-gray-200 rounded-b-xl p-4 space-y-2">{PROCESS_FLOW.mainLine.map((area, index) => { const actual = processFlowData.areaActuals[area]; const balanceToPlan = processFlowData.totalPlan - actual; const prevArea = index > 0 ? PROCESS_FLOW.mainLine[index - 1] : null; const wip = prevArea ? (processFlowData.areaActuals[prevArea] - actual) : 0; return (<div key={area}>{index > 0 && (<div className="flex items-center justify-center py-2 relative"><ArrowDown size={20} className="text-gray-300" />{wip > 0 ? (<span className="absolute left-[60%] text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">WIP: {wip}</span>) : (wip < 0 && <span className="absolute left-[60%] text-[10px] text-red-400">Error</span>)}</div>)}<div className={`p-3 rounded-lg border flex justify-between items-center ${area === 'CF final' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}><div><div className="font-bold text-gray-800 text-sm">{area}</div></div><div className="flex gap-4 text-right"><div><div className="text-[10px] text-gray-400 uppercase">Act</div><div className="font-bold text-gray-900 text-lg">{actual}</div></div><div className="w-px bg-gray-200"></div><div><div className="text-[10px] text-red-400 uppercase">Bal</div><div className="font-bold text-red-600 text-lg">{balanceToPlan}</div></div></div></div></div>); })}</div>
          </div>
        </div>
      )}

      {/* 2. DAILY / MONTHLY PRODUCTION VIEW */}
      {reportType === 'daily' && (
        <div className="space-y-4">
           <div className="flex gap-2 mb-2"><button onClick={() => setProductionTimeframe('daily')} className={`flex-1 py-1.5 text-xs font-bold rounded border flex items-center justify-center gap-1 ${productionTimeframe === 'daily' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}><CalendarDays size={14}/> Daily Report</button><button onClick={() => setProductionTimeframe('monthly')} className={`flex-1 py-1.5 text-xs font-bold rounded border flex items-center justify-center gap-1 ${productionTimeframe === 'monthly' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}><Calendar size={14}/> Monthly Report</button></div>
          <Card className="p-4 space-y-4 bg-white border border-gray-200">
             <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span className="text-xs font-bold text-gray-400 uppercase">Filter & Export</span><button onClick={() => { const data = productionReportData.rows; const filename = `${productionTimeframe}_Production_${productionTimeframe === 'daily' ? reportDate : reportMonth}`; let cleanData; if (isCRF) { cleanData = data.map(r => ({ Machine: r.machine, Part: r.part, Model: r.model, Qty: r.actual })); } else { cleanData = data.map(r => ({ Model: r.model, Plan: r.plan, Actual: r.actual, Achievement_Percent: r.percent + '%' })); } exportToCSV(cleanData, filename); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold"><Download size={14}/> Export Excel</button></div>
            <div className="grid grid-cols-2 gap-3">{productionTimeframe === 'daily' ? (<div><label className="text-xs font-bold text-gray-500 mb-1 block">Date</label><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div>) : (<div><label className="text-xs font-bold text-gray-500 mb-1 block">Month</label><input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div>)}<div><label className="text-xs font-bold text-gray-500 mb-1 block">Area</label><select value={reportArea} onChange={(e) => setReportArea(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm bg-white">{AREAS.map(area => <option key={area} value={area}>{area}</option>)}</select></div></div>
          </Card>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <thead className="bg-gray-50 border-b border-gray-200 w-full block"><tr className="flex w-full">{isCRF ? (<><th className="p-3 text-xs font-bold text-gray-500 uppercase w-1/3 text-left">Part/Machine</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-left">For Model</th><th className="p-3 text-xs font-bold text-gray-500 uppercase w-20 text-right">Qty</th></>) : (<><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-left">Model</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-right">{productionTimeframe === 'daily' ? 'D.Plan' : 'M.Budget'}</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-right">Act</th><th className="p-3 text-xs font-bold text-gray-500 uppercase flex-1 text-right">%</th></>)}</tr></thead>
            <tbody className="divide-y divide-gray-100 block w-full max-h-[400px] overflow-y-auto">{productionReportData.rows.map((row, idx) => (<tr key={idx} className="hover:bg-gray-50 text-sm flex w-full">{isCRF ? (<><td className="p-3 font-medium text-gray-700 w-1/3 text-left"><div className="font-bold">{row.part}</div><div className="text-[10px] text-gray-400">{row.machine}</div></td><td className="p-3 text-gray-600 flex-1 text-left flex items-center">{row.model}</td><td className="p-3 text-right font-bold text-blue-600 w-20">{row.actual}</td></>) : (<><td className="p-3 font-medium text-gray-700 flex-1 text-left">{row.model}</td><td className="p-3 text-right text-gray-400 font-medium flex-1">{row.plan || '-'}</td><td className="p-3 text-right font-bold text-blue-600 flex-1">{row.actual}</td><td className="p-3 text-right flex-1"><span className={`px-2 py-0.5 rounded text-xs font-bold ${row.percent >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{row.percent}%</span></td></>)}</tr>))}</tbody>
             <div className="bg-blue-50 p-3 flex justify-between items-center border-t border-blue-100"><span className="text-blue-800 font-bold text-sm">Total {isCRF ? 'Parts' : 'Units'}</span><span className="text-blue-800 font-bold text-lg">{productionReportData.totalActual}</span></div>
          </div>
        </div>
      )}

      {/* 3. HOURLY REPORT VIEW */}
      {reportType === 'hourly' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
           <Card className="p-4 bg-white border border-gray-200">
             <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
                 <span className="text-xs font-bold text-gray-400 uppercase">Hourly Filters</span>
                 <button onClick={() => exportToCSV(hourlyReportData.rows, `Hourly_${reportArea}_${reportDate}`)} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-bold"><Download size={14}/> Export</button>
             </div>
             <div className="grid grid-cols-2 gap-3">
                 <div><label className="text-xs font-bold text-gray-500 mb-1 block">Date</label><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm" /></div>
                 <div><label className="text-xs font-bold text-gray-500 mb-1 block">Area</label><select value={reportArea} onChange={(e) => setReportArea(e.target.value)} className="w-full p-2 rounded border border-gray-200 text-sm bg-white">{AREAS.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
             </div>
           </Card>

           <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
              <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Hourly Output</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">Total: {hourlyReportData.total}</span>
              </div>
              
              {hourlyReportData.rows.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No production data for this date.</div>
              ) : (
                  <div className="divide-y divide-gray-100">
                      {hourlyReportData.rows.map((row, idx) => (
                          <div key={idx} className="p-3 hover:bg-gray-50 transition-colors">
                              <div className="flex justify-between items-center mb-1">
                                  <div className="text-sm font-bold text-gray-800">{row.time}</div>
                                  <div className="flex gap-4 text-sm">
                                      <div className="text-gray-500"><span className="text-xs uppercase mr-1">Qty:</span><span className="font-bold text-gray-900">{row.qty}</span></div>
                                      <div className="text-blue-600"><span className="text-xs uppercase mr-1">Cum:</span><span className="font-bold">{row.cumulative}</span></div>
                                  </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(row.percent * 2, 100)}%` }}></div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
           </div>
        </div>
      )}

      {/* 4. NEW: ADVANCED EXPORT VIEW */}
      {reportType === 'export' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <Card className="p-4 bg-white border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Filter size={18} /> Advanced Filters</h3>
                  
                  <div className="space-y-3">
                      {/* DATE RANGE */}
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-xs font-bold text-gray-500 mb-1 block">From</label>
                              <input type="date" value={exportRangeStart} onChange={(e) => setExportRangeStart(e.target.value)} className="w-full p-2 border rounded text-sm" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 mb-1 block">To</label>
                              <input type="date" value={exportRangeEnd} onChange={(e) => setExportRangeEnd(e.target.value)} className="w-full p-2 border rounded text-sm" />
                          </div>
                      </div>

                      {/* AREA & MACHINE (CRF) */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Work Area</label>
                            <select value={exportArea} onChange={(e) => { setExportArea(e.target.value); setExportCategory(''); setExportModel(''); setExportMachine(''); }} className="w-full p-2 border rounded text-sm bg-white">
                                {AREAS.map(area => <option key={area} value={area}>{area}</option>)}
                            </select>
                        </div>
                        {exportArea === 'CRF' && (
                            <div className="animate-in fade-in">
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Machine (Optional)</label>
                                <select value={exportMachine} onChange={(e) => setExportMachine(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                                    <option value="">All Machines</option>
                                    {availableMachines.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        )}
                      </div>

                      {/* CATEGORY & MODEL (CF/WD) */}
                      {exportArea !== 'CRF' && exportArea !== 'WD final' && (
                          <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">Category</label>
                                  <select value={exportCategory} onChange={(e) => { setExportCategory(e.target.value); setExportModel(''); }} className="w-full p-2 border rounded text-sm bg-white">
                                      <option value="">All Categories</option>
                                      {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 mb-1 block">Model</label>
                                  <select value={exportModel} onChange={(e) => setExportModel(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                                      <option value="">All Models</option>
                                      {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                              </div>
                          </div>
                      )}

                      <div>
                          <label className="text-xs font-bold text-gray-500 mb-1 block">Supervisor (Optional)</label>
                          <select value={exportSupervisor} onChange={(e) => setExportSupervisor(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                              <option value="">All Supervisors</option>
                              {shiftConfig.supervisors && shiftConfig.supervisors.map((s, idx) => (
                                  <option key={idx} value={s.name}>{s.name}</option>
                              ))}
                          </select>
                      </div>

                      <button 
                          onClick={generateMatrixReport}
                          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 mt-4 hover:bg-blue-700 shadow-md">
                          <FileSpreadsheet size={20} /> Download Report
                      </button>
                      <p className="text-center text-xs text-gray-400 mt-2">
                          Format: Excel Style (Filtered Matrix)
                      </p>
                  </div>
              </Card>
          </div>
      )}
    </div>
    );
  };

  const renderLockScreen = (type) => (
      <div className="p-8 max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="bg-blue-100 p-6 rounded-full"><Lock size={48} className="text-blue-600" /></div>
        <div className="text-center"><h2 className="text-xl font-bold text-gray-800">{type === 'plan' ? 'Plan Locked' : 'Settings Locked'}</h2><p className="text-sm text-gray-500 mt-1">Enter PIN to access</p></div>
        <div className="w-full max-w-xs space-y-4"><input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter PIN" className="w-full text-center text-2xl tracking-widest p-3 border rounded-lg focus:border-blue-500 outline-none" maxLength={4} /><button onClick={() => handleUnlock(type)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Unlock</button><p className="text-center text-xs text-gray-400">Default PIN: 1234</p></div>
      </div>
  );

  const renderPlanScreen = () => {
    if (!isPlanUnlocked) return renderLockScreen('plan');

    return (
      <div className="p-4 max-w-md mx-auto space-y-6 pb-24">
        <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-bold text-gray-700">Set Targets</h2><button onClick={() => setIsPlanUnlocked(false)} className="text-xs text-red-500 font-bold flex items-center gap-1 border border-red-100 px-2 py-1 rounded bg-red-50"><Lock size={12}/> Lock</button></div>
        <div className="flex bg-gray-200 p-1 rounded-lg"><button onClick={() => setPlanMode('daily')} className={`flex-1 py-2 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-all ${planMode === 'daily' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}><CalendarDays size={16} /> Daily</button><button onClick={() => setPlanMode('monthly')} className={`flex-1 py-2 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-all ${planMode === 'monthly' ? 'bg-white shadow text-blue-800' : 'text-gray-600'}`}><Target size={16} /> Monthly</button></div>
        <Card className="p-4 bg-blue-50 border-blue-100"><label className="text-xs font-bold text-blue-600 mb-1 block">{planMode === 'monthly' ? 'Select Month' : 'Select Date'}</label>{planMode === 'monthly' ? <input type="month" value={planMonth} onChange={(e) => setPlanMonth(e.target.value)} className="w-full p-2 rounded border border-blue-200 text-sm" /> : <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="w-full p-2 rounded border border-blue-200 text-sm" />}</Card>
        <div className="space-y-4">
           {['CF_LINE', 'WD_LINE'].map(groupKey => {
               const group = masterData[groupKey];
               return Object.entries(group).map(([cat, models]) => (
                   <Card key={cat} className="overflow-hidden mb-3">
                       <div className="bg-gray-50 p-2 border-b border-gray-100 font-bold text-gray-700 text-xs uppercase">{cat}</div>
                       <div className="divide-y divide-gray-100 p-2">
                           {models.map(model => (
                               <div key={model} className="flex items-center justify-between p-2">
                                   <span className="text-sm font-medium text-gray-700">{model}</span>
                                   <input type="number" placeholder="Plan" value={tempPlanData[model] || ''} onChange={(e) => handlePlanInputChange(model, e.target.value)} className="w-20 p-2 text-right border rounded bg-gray-50 focus:bg-white outline-none focus:border-blue-500" />
                               </div>
                           ))}
                       </div>
                   </Card>
               ))
           })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-50"><div className="max-w-md mx-auto"><button onClick={handleSavePlan} className="w-full py-3.5 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95 transition-all"><Save size={20} /> Save Plan</button></div></div>
      </div>
    );
  };

  const renderSettingsScreen = () => {
    if (!isSettingsUnlocked) return renderLockScreen('settings');

    const getSafeGroupData = (groupKey) => {
        const data = masterData[groupKey];
        if (!data || Array.isArray(data)) return {};
        return data;
    };
    const safeGroupData = getSafeGroupData(settingsGroup);

    return (
     <div className="p-4 max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
          <div className="bg-white p-4 rounded-xl border-l-4 border-blue-600 shadow-sm w-full mr-2"><h2 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={20} className="text-blue-600" /> Plant Configuration</h2></div>
          <button onClick={() => setIsSettingsUnlocked(false)} className="bg-red-50 text-red-500 p-3 rounded-xl border border-red-100"><Lock size={20}/></button>
      </div>
     
      {/* Shift Configuration Section */}
      <Card className="p-4 bg-purple-50 border-purple-100">
          <h3 className="font-bold text-purple-800 text-sm mb-3 flex items-center gap-2"><User size={16}/> Supervisor Management</h3>
          
          <div className="mb-4 space-y-2">
              <input type="text" placeholder="Supervisor Name" value={newSupervisorName} onChange={e => setNewSupervisorName(e.target.value)} className="w-full p-2 text-sm border rounded" />
              <div className="flex gap-2">
                  <input type="tel" placeholder="Mobile Number" value={newSupervisorPhone} onChange={e => setNewSupervisorPhone(e.target.value)} className="flex-1 p-2 text-sm border rounded" />
                  <button onClick={handleAddSupervisor} className="bg-purple-600 text-white px-3 rounded"><Plus size={18}/></button>
              </div>
          </div>

          <div className="divide-y divide-purple-200/50">
              {shiftConfig.supervisors && shiftConfig.supervisors.map((sup, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2">
                      <div>
                          <div className="font-bold text-sm text-gray-800">{sup.name}</div>
                          <div className="text-xs text-gray-500">{sup.phone}</div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => handleWhatsAppReminder(sup.phone, sup.name)} className="bg-green-500 text-white p-1.5 rounded-full" title="Send WhatsApp Reminder"><MessageCircle size={14}/></button>
                          <button onClick={() => handleDeleteSupervisor(sup.name)} className="text-red-400 p-1.5"><Trash2 size={14}/></button>
                      </div>
                  </div>
              ))}
          </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 mb-2">
         <button onClick={() => { setSettingsGroup('CF_LINE'); setTargetCategoryForModel(''); }} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'CF_LINE' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Assembly Models</button>
         <button onClick={() => { setSettingsGroup('WD_LINE'); setTargetCategoryForModel(''); }} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'WD_LINE' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Water Dispenser</button>
      </div>
      <div className="grid grid-cols-1 gap-2">
         <button onClick={() => { setSettingsGroup('CRF_MACHINES'); setTargetCategoryForModel(''); }} className={`p-2 rounded-lg text-xs font-bold border ${settingsGroup === 'CRF_MACHINES' ? 'bg-blue-600 text-white' : 'bg-white'}`}>CRF Machines & Parts</button>
      </div>

      {(settingsGroup === 'CRF_MACHINES' && Array.isArray(masterData.CRF_MACHINES)) && (
          <div className="bg-red-50 p-3 rounded text-red-600 text-xs font-bold border border-red-200">
              ⚠️ Old Data Format Detected. Please refresh to auto-fix.
          </div>
      )}

      {(settingsGroup === 'CF_LINE' || settingsGroup === 'CRF_MACHINES') && (
        <Card className="p-4 bg-orange-50 border-orange-100">
           <label className="text-xs font-bold text-orange-600 mb-2 block uppercase flex items-center gap-1">
               <FolderPlus size={14}/> {settingsGroup === 'CRF_MACHINES' ? 'Add Machine Group' : 'Add Product Category'}
           </label>
           <div className="flex gap-2">
               <input type="text" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} placeholder={settingsGroup === 'CRF_MACHINES' ? "Machine Name" : "Category Name"} className="flex-1 p-2 border rounded text-sm bg-white" />
               <button onClick={handleSettingsAddCategory} className="bg-orange-600 text-white px-4 rounded font-bold text-sm"><Plus size={18} /></button>
           </div>
        </Card>
      )}

      <Card className="p-4">
          <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">
              {settingsGroup === 'CRF_MACHINES' ? 'Add Part to Machine' : 'Add Model/Item'}
          </label>
          <div className="space-y-2">
             {(settingsGroup === 'CF_LINE' || settingsGroup === 'CRF_MACHINES') && (
                 <select value={targetCategoryForModel} onChange={(e) => setTargetCategoryForModel(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                    <option value="">{settingsGroup === 'CRF_MACHINES' ? "Select Machine..." : "Select Category..."}</option>
                    {/* SAFE RENDER */}
                    {Object.keys(safeGroupData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                 </select>
             )}
             <div className="flex gap-2">
                 <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Name..." className="flex-1 p-2 border rounded text-sm" />
                 <button onClick={handleSettingsAddItem} className="bg-green-600 text-white px-4 rounded font-bold text-sm"><Plus size={18} /></button>
             </div>
          </div>
      </Card>

      <Card className="p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Existing Items</h3>
          <div className="divide-y divide-gray-100">
             
             {settingsGroup === 'WD_LINE' && masterData.WD_LINE["Standard"].map(m => (
                 <div key={m} className="flex justify-between py-2 text-sm items-center">
                     <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                     <div className="flex gap-3">
                         <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>{activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                         <button onClick={() => handleSettingsDeleteItem('WD_LINE', m)} className="text-red-400"><Trash2 size={14}/></button>
                     </div>
                 </div>
             ))}
             
             {/* SAFE RENDER FOR HIERARCHY */}
             {(settingsGroup === 'CF_LINE' || settingsGroup === 'CRF_MACHINES') && Object.keys(safeGroupData).map(cat => (
                 <div key={cat} className="mb-4">
                     <div className="bg-gray-100 p-2 text-xs font-bold rounded flex justify-between items-center text-gray-700">
                         {cat}
                         <button onClick={() => handleSettingsDeleteCategory(settingsGroup, cat)} className="text-red-500 hover:bg-red-100 p-1 rounded" title="Delete Group"><Trash2 size={14}/></button>
                     </div>
                     {Array.isArray(safeGroupData[cat]) && safeGroupData[cat].map(m => (
                        <div key={m} className="flex justify-between py-2 pl-2 text-sm border-b border-gray-50 last:border-0 hover:bg-gray-50">
                            <span className={activeModels[m] === false ? 'text-gray-400 line-through' : ''}>{m}</span>
                            <div className="flex gap-3">
                                <button onClick={() => toggleModelStatus(m)} className={activeModels[m] !== false ? 'text-green-600' : 'text-gray-300'}>
                                   {activeModels[m] !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                                <button onClick={() => handleSettingsDeleteItem(settingsGroup, m, cat)} className="text-red-400"><Trash2 size={14}/></button>
                            </div>
                        </div>
                     ))}
                 </div>
             ))}
          </div>
      </Card>
    </div>
    );
  };

  const renderContent = () => {
    switch (view) {
      case 'entry': return renderEntryScreen();
      case 'report': return renderReportScreen();
      case 'plan': return renderPlanScreen();
      case 'settings': return renderSettingsScreen();
      default: return renderEntryScreen();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {renderHeader()}
      <main>{renderContent()}</main>
      {notification && <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 z-[60] animate-in fade-in slide-in-from-bottom-4"><CheckCircle2 size={18} /><span className="font-medium text-sm">{notification}</span></div>}
    </div>
  );
}
