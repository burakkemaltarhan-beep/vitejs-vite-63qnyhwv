import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { 
  subscribeToDonors, 
  saveSingleDonor, 
  saveMonthStateToFirebase, 
  deleteDonorFromCloud 
} from './services/donorService';
import Login from './components/Login';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import ExcelManager from './components/ExcelManager';
import FilterBar from './components/FilterBar';
import DonorForm from './components/DonorForm';
import DonorList from './components/DonorList';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [donors, setDonors] = useState<any[]>([]);
  const [monthState, setMonthState] = useState<any>({});

  // Filtreleme State'leri
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // 1. Oturum Dinleyici
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
        const prefix = authUser.email?.split('@')[0] || '';
        let name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        if (prefix === 'ozkan') name = 'Özkan';
        if (prefix === 'yigit') name = 'Yiğit';
        if (prefix === 'behlul') name = 'Behlül';
        if (prefix === 'batuhan') name = 'Batuhan';
        setCurrentUser(name);
      } else {
        setUser(null);
        setCurrentUser('');
      }
      setLoadingAuth(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Canlı Firestore Dinleyici
  useEffect(() => {
    if (!user) return;

    const unsubscribeDonors = subscribeToDonors(
      (donorsList, monthStatesData) => {
        setDonors(donorsList);
        setMonthState(monthStatesData);
      },
      (error) => {
        console.error("Firestore bağlantı hatası:", error);
      }
    );

    return () => unsubscribeDonors();
  }, [user]);

  // Filtrelenmiş Liste
  const filteredDonors = useMemo(() => {
    return donors.filter((d) => {
      const matchSearch = searchTerm === '' || 
        d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.phone?.includes(searchTerm);

      const matchHospital = selectedHospital === '' || d.hospital === selectedHospital;
      const matchStaff = selectedStaff === '' || d.assignedTo === selectedStaff;
      const matchStatus = selectedStatus === '' || (d.idmStatus || 'Bekliyor') === selectedStatus;

      return matchSearch && matchHospital && matchStaff && matchStatus;
    });
  }, [donors, searchTerm, selectedHospital, selectedStaff, selectedStatus]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedHospital('');
    setSelectedStaff('');
    setSelectedStatus('');
  };

  // Akordeon Aç / Kapat
  const handleToggleMonth = (key: string) => {
    const updated = { 
      ...monthState, 
      [key]: monthState[key] !== undefined ? !monthState[key] : false 
    };
    setMonthState(updated);
    saveMonthStateToFirebase(updated);
  };

  const handleToggleDonor = (id: string) => {
    const target = donors.find((d) => d.id === id);
    if (target) {
      target.isOpen = !target.isOpen;
      saveSingleDonor(target);
      setDonors([...donors]);
    }
  };

  // Yeni Bağışçı Ekleme
  const handleAddDonor = async (newDonor: any) => {
    try {
      await saveSingleDonor(newDonor);
    } catch (err) {
      alert("Bağışçı kaydedilirken hata oluştu.");
    }
  };

  // Tekil Alan Güncelleme & Audit Log Yazma (Micro-Save)
  const handleUpdateDonorField = async (id: string, field: string, value: any) => {
    const target = donors.find((d) => d.id === id);
    if (target) {
      target[field] = value;
      
      // Otomatik Audit Log kaydı
      if (!target.auditLogs) target.auditLogs = [];
      target.auditLogs.unshift({
        date: new Date().toISOString(),
        user: currentUser || 'Sistem',
        action: `${field} alanı güncellendi.`
      });

      // Log listesini son 20 işlem ile sınırla
      if (target.auditLogs.length > 20) {
        target.auditLogs = target.auditLogs.slice(0, 20);
      }

      await saveSingleDonor(target);
    }
  };

  // Bağışçı Silme
  const handleDeleteDonor = (id: string) => {
    if (window.confirm("Bu bağışçı kaydını silmek istediğinize emin misiniz?")) {
      deleteDonorFromCloud(id);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-xs font-semibold tracking-wider uppercase animate-pulse">
          Sistem Başlatılıyor...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased pb-16">
      {!user && <Login />}

      <Header currentUser={currentUser} />

      <main className="max-w-6xl mx-auto px-4 space-y-4">
        {/* Operasyonel Özet Sayaçları */}
        <StatsBar donors={donors} />

        {/* Excel Araçları */}
        <ExcelManager donors={donors} />

        {/* Filtreleme Çubuğu */}
        <FilterBar 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedHospital={selectedHospital}
          setSelectedHospital={setSelectedHospital}
          selectedStaff={selectedStaff}
          setSelectedStaff={setSelectedStaff}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          onResetFilters={handleResetFilters}
          totalCount={donors.length}
          filteredCount={filteredDonors.length}
        />

        {/* Yeni Bağışçı Ekleme Formu */}
        <DonorForm onAddDonor={handleAddDonor} />

        {/* Bağışçı Listesi */}
        <DonorList 
          donors={filteredDonors}
          monthState={monthState}
          onToggleMonth={handleToggleMonth}
          onToggleDonor={handleToggleDonor}
          onDeleteDonor={handleDeleteDonor}
          onUpdateDonorField={handleUpdateDonorField}
        />
      </main>
    </div>
  );
}