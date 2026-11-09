import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveSingleDonor } from '../services/donorService';

export default function ExcelManager({ donors = [] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const normalizeDate = (raw) => {
    if (!raw) return '';
    const clean = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    
    const parts = clean.split(/[./-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return clean;
  };

  const parsePastedData = (text) => {
    if (!text) return [];
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const knownHospitals = [
      'İzmir Şehir Hastanesi',
      'İzmir Atatürk EAH',
      'İzmir Medical Point Hastanesi',
      'Ege Üniversitesi Hastanesi',
      'Dokuz Eylül Üniversitesi Hastanesi'
    ];

    const knownStaff = ['Batuhan', 'Yiğit', 'Behlül', 'Yunus', 'Özkan', 'Burak'];
    const parsedDonors = [];

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      if (
        index === 0 &&
        (lowerLine.includes('bağışçı') || lowerLine.includes('ad soyad') || lowerLine.includes('hastane'))
      ) {
        return;
      }

      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) cols = line.split(';');
      if (cols.length === 1 && line.includes(',')) cols = line.split(',');

      cols = cols.map((c) => c.trim());

      let name = '';
      let hospital = 'İzmir Şehir Hastanesi';
      let phone = '';
      let date = '';
      let assignedTo = 'Atanmadı';

      if (cols.length === 1) {
        name = cols[0];
      } else {
        name = cols[0];

        for (let i = 1; i < cols.length; i++) {
          const val = cols[i];
          if (!val) continue;

          const digits = val.replace(/\D/g, '');
          if ((digits.startsWith('05') || digits.startsWith('5')) && digits.length >= 10 && !phone) {
            phone = val;
            continue;
          }

          const matchedHospital = knownHospitals.find((h) => 
            val.toLowerCase().includes(h.toLowerCase().slice(0, 8))
          );
          if (matchedHospital || val.toLowerCase().includes('hastane') || val.toLowerCase().includes('eah')) {
            hospital = matchedHospital || val;
            continue;
          }

          if (/\d{1,4}[./-]\d{1,2}[./-]\d{2,4}/.test(val) && !date) {
            date = normalizeDate(val);
            continue;
          }

          const matchedStaff = knownStaff.find((s) => 
            val.toLowerCase().includes(s.toLowerCase())
          );
          if (matchedStaff && assignedTo === 'Atanmadı') {
            assignedTo = matchedStaff;
            continue;
          }
        }
      }

      if (name) {
        parsedDonors.push({
          id: (Date.now() + index).toString(),
          name,
          hospital,
          phone,
          assignedTo,
          idmStatus: 'Bekliyor',
          isOpen: false,
          healthCheck: {
            date: date || '',
            done: false
          },
          auditLogs: [
            {
              date: new Date().toISOString(),
              user: 'Excel Aktarımı',
              action: 'Metin yapıştırma yoluyla sisteme eklendi.'
            }
          ]
        });
      }
    });

    return parsedDonors;
  };

  const handleImport = async () => {
    if (!pasteText.trim()) {
      alert('Lütfen Excel’den kopyaladığınız satırları yapıştırın.');
      return;
    }

    const items = parsePastedData(pasteText);
    if (items.length === 0) {
      alert('Geçerli bir bağışçı satırı algılanamadı.');
      return;
    }

    setIsProcessing(true);
    try {
      for (const item of items) {
        await saveSingleDonor(item);
      }
      alert(`${items.length} adet bağışçı kaydı başarıyla aktarıldı!`);
      setPasteText('');
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Kayıt eklenirken bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportExcel = () => {
    const list = donors || [];
    if (list.length === 0) {
      alert('Dışa aktarılacak kayıt bulunmuyor.');
      return;
    }

    const exportData = list.map((d) => ({
      'Bağışçı Adı Soyadı': d.name,
      'Hastane': d.hospital || '',
      'Telefon': d.phone || '',
      'Sorumlu Koordinatör': d.assignedTo || '',
      'Sağlık Kontrolü Tarihi': d.healthCheck?.date || '',
      'Kontrol Durumu': d.healthCheck?.done ? 'Tamamlandı' : 'Bekliyor',
      'IDM Durumu': d.idmStatus || 'Bekliyor'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TURKOK_Bagiscilar');

    const fileName = `TURKOK_Bagisci_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const previewCount = pasteText.trim() ? parsePastedData(pasteText).length : 0;

  return (
    <>
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-base">
            📋
          </span>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Excel / Pano Veri Entegrasyonu</h3>
            <p className="text-[11px] text-slate-400">Excel’den kopyaladığınız metni doğrudan yapıştırarak aktarın</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            📋 Excel’den Metin Yapıştır
          </button>
          <button
            onClick={handleExportExcel}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1.5"
          >
            📤 Excel Olarak İndir
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-xl w-full overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>📋</span> Excel’den Metin Yapıştırarak Ekle
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Excel tablonuzdaki satırları kopyalayıp doğrudan aşağıdaki alana yapıştırın.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 space-y-1">
                <p className="font-semibold">💡 Nasıl Kullanılır?</p>
                <p className="text-indigo-700">
                  Excel'de satırları kopyalayın (Ctrl + C) ve aşağıdaki alana yapıştırın (Ctrl + V). Ad, telefon, hastane ve tarihleri sistem otomatik tanır.
                </p>
              </div>

              <textarea
                rows={8}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Örnek:&#10;Ahmet Yılmaz	İzmir Şehir Hastanesi	05321234567	15.11.2026	Batuhan"
                className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 focus:bg-white focus:outline-indigo-500 text-xs font-mono resize-none"
              />

              {previewCount > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-500">Algılanan Kayıt Sayısı:</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {previewCount} Bağışçı
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPasteText('');
                  setIsModalOpen(false);
                }}
                className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                İptal
              </button>
              <button
                disabled={previewCount === 0 || isProcessing}
                onClick={handleImport}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold px-4 py-2 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {isProcessing ? 'Aktarılıyor...' : `${previewCount > 0 ? previewCount + ' Bağışçıyı ' : ''}Sisteme Aktar`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}