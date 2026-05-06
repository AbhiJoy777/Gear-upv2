import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Laptop, Monitor, Gamepad, Cpu, Server, Plus, UploadCloud, Search, ChevronDown, MapPin, Truck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const CATS = [
  { name: 'Laptops', Icon: Laptop },
  { name: 'Desktops', Icon: Monitor },
  { name: 'GPUs', Icon: Cpu },
  { name: 'Consoles', Icon: Server },
  { name: 'Monitors', Icon: Monitor },
  { name: 'Controllers', Icon: Gamepad }
];

const NVIDIA_MODELS = [
  'RTX 5090', 'RTX 5080', 'RTX 5070', 'RTX 5060', 'RTX 5050',
  'RTX 4090', 'RTX 4080 Super', 'RTX 4080', 'RTX 4070 Ti Super', 'RTX 4070 Ti', 'RTX 4070 Super', 'RTX 4070', 'RTX 4060 Ti', 'RTX 4060', 'RTX 4050',
  'RTX 3090 Ti', 'RTX 3090', 'RTX 3080 Ti', 'RTX 3080', 'RTX 3070 Ti', 'RTX 3070', 'RTX 3060 Ti', 'RTX 3060', 'RTX 3050 Ti', 'RTX 3050'
];

const AMD_MODELS = [
  'RX 9070 XT', 'RX 9060 XT',
  'RX 7900 XTX', 'RX 7900 XT', 'RX 7800 XT', 'RX 7700 XT', 'RX 7600 XT',
  'RX 6950 XT', 'RX 6900 XT', 'RX 6800 XT', 'RX 6700 XT',
  'Radeon RX 6600M', 'Radeon RX 6650M', 'Radeon RX 6700M', 'Radeon RX 6800M', 
  'Radeon RX 7600M', 'Radeon RX 7600M XT', 'Radeon RX 7700S', 'Radeon RX 7800M'
];

const INTEL_ARC_MODELS = [
  'Arc A350M', 'Arc A370M', 'Arc A550M', 'Arc A730M', 'Arc A770M'
];

const VRAM_OPTS = ['4GB', '6GB', '8GB', '10GB', '12GB', '16GB', '24GB'];

const CPU_PLATFORMS = ['Intel', 'AMD'];
const INTEL_CPUS = ['i3', 'i5', 'i7', 'i9'];
const AMD_CPUS = ['Ryzen 3', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9'];
const RAM_OPTS = ['4GB', '8GB', '16GB', '32GB', '64GB', '128GB'];
const GPU_PLATFORMS = ['Nvidia', 'AMD', 'Intel Arc', 'Integrated'];

function getScore(cpuP: string, cpuM: string, ram: string, gpuP: string, gpuM: string, vram: string) {
  let score = 0;
  if (cpuM.includes('9')) score += 50;
  else if (cpuM.includes('7')) score += 40;
  else if (cpuM.includes('5')) score += 30;
  else if (cpuM.includes('3')) score += 20;

  if (ram === '128GB') score += 50;
  else if (ram === '64GB') score += 40;
  else if (ram === '32GB') score += 30;
  else if (ram === '16GB') score += 20;
  else if (ram === '8GB') score += 10;
  else if (ram === '4GB') score += 5;

  if (gpuP !== 'Integrated' && gpuP) {
    if (gpuM.includes('5090')) score += 100;
    else if (gpuM.includes('5080') || gpuM.includes('4090') || gpuM.includes('9070 XT')) score += 90;
    else if (gpuM.includes('5070') || gpuM.includes('4080') || gpuM.includes('3080 Ti') || gpuM.includes('RX 7800') || gpuM.includes('Arc A770M') || gpuM.includes('9060 XT')) score += 80;
    else if (gpuM.includes('5060') || gpuM.includes('4070') || gpuM.includes('3080') || gpuM.includes('RX 7700') || gpuM.includes('Arc A730M')) score += 70;
    else if (gpuM.includes('5050') || gpuM.includes('4060') || gpuM.includes('3070 Ti') || gpuM.includes('3070') || gpuM.includes('RX 7600') || gpuM.includes('RX 6800')) score += 60;
    else if (gpuM.includes('4050') || gpuM.includes('3060') || gpuM.includes('RX 6700') || gpuM.includes('Arc A550M')) score += 40;
    else if (gpuM.includes('3050') || gpuM.includes('RX 6650') || gpuM.includes('RX 6600') || gpuM.includes('Arc A370') || gpuM.includes('Arc A350')) score += 20;

    if (vram === '24GB') score += 50;
    else if (vram === '16GB') score += 40;
    else if (vram === '12GB') score += 30;
    else if (vram === '10GB') score += 25;
    else if (vram === '8GB') score += 20;
    else if (vram === '6GB') score += 15;
    else if (vram === '4GB') score += 10;
  }

  return score;
}

const GpuModelSelect = ({ val, set, platform, disabled }: any) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: any) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  let modelsList: string[] = [];
  if (platform === 'Nvidia') modelsList = NVIDIA_MODELS;
  else if (platform === 'AMD') modelsList = AMD_MODELS;
  else if (platform === 'Intel Arc') modelsList = INTEL_ARC_MODELS;

  const filtered = modelsList.filter(m => m.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`space-y-1.5 relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={ref}>
      <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider">GPU Model</label>
      <div 
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full bg-[#121212] flex items-center justify-between text-white border border-white/10 rounded-[12px] p-3 text-[13px] ${open ? 'border-[#A855F7]' : ''} cursor-pointer transition-colors`}
      >
        <span className={val ? 'text-white' : 'text-white/50'}>{val || 'Select'}</span>
        <ChevronDown size={14} className={`text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-[#121212] border border-white/10 rounded-[12px] z-[50] shadow-2xl flex flex-col overflow-hidden">
          <div className="p-2 border-b border-white/5 relative bg-[#121212] z-10 shrink-0">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              placeholder={`Search ${platform} models...`} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[13px] text-white pl-8 py-1 focus:outline-none"
              autoFocus={false}
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
            {filtered.map(m => (
              <div 
                key={m} 
                onClick={() => { set(m); setOpen(false); setSearch(''); }}
                className="px-3 py-2.5 text-[13px] text-white/80 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                {m}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[12px] text-white/30">No models found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function detectGpuPlatform(model: string): string {
  if (!model || model === 'Integrated') return 'Integrated';
  if (model.startsWith('RTX') || model.startsWith('GTX')) return 'Nvidia';
  if (model.startsWith('RX') || model.startsWith('Radeon')) return 'AMD';
  if (model.includes('Arc')) return 'Intel Arc';
  return 'Nvidia';
}

export default function ListGearModal({ isOpen, onClose, editItem }: any) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [load, setLoad] = useState(false);
  
  const [c, setC] = useState('');
  
  const [cpuPlatform, setCpuPlatform] = useState('');
  const [cpuModel, setCpuModel] = useState('');
  const [ram, setRam] = useState('');
  
  const [gpuPlatform, setGpuPlatform] = useState('');
  const [gpuModel, setGpuModel] = useState('');
  const [vram, setVram] = useState('');
  
  const [imgs, setImgs] = useState<string[]>([]);
  const [otherCpu, setOtherCpu] = useState('');
  const [numControllers, setNumControllers] = useState('');

  const [logisticsType, setLogisticsType] = useState('Self-Pickup');

  const [incMouse, setIncMouse] = useState(false);
  const [incKeyboard, setIncKeyboard] = useState(false);
  const [incHeadset, setIncHeadset] = useState(false);
  const [incMonitor, setIncMonitor] = useState(false);
  
  const [monSize, setMonSize] = useState('');
  const [monRefresh, setMonRefresh] = useState('');
  const [monRes, setMonRes] = useState('');

  const [controllerPlatform, setControllerPlatform] = useState('');
  const [controllerModel, setControllerModel] = useState('');

  const title = useMemo(() => {
    if (!c) return 'Gear Title';
    if (c === 'Laptops' || c === 'Desktops') {
      const gpuDesc = gpuPlatform === 'Integrated' ? 'Integrated Gfx' : gpuModel;
      return `${c.slice(0,-1)} - ${[cpuPlatform + ' ' + cpuModel, ram, gpuDesc].filter(x => x && x.trim() !== 'undefined').join(' / ')}`;
    }
    if (c === 'GPUs') return `GPU - ${gpuModel || otherCpu}`;
    if (c === 'Consoles') return `Console - ${otherCpu}`;
    if (c === 'Monitors') return `Monitor - ${monSize} ${monRes}`;
    if (c === 'Controllers') return `Controller - ${controllerModel || 'Standard'}`;
    return 'Professional Controller';
  }, [c, cpuPlatform, cpuModel, ram, gpuPlatform, gpuModel, otherCpu, monSize, monRes, controllerModel]);

  let totalScore = getScore(cpuPlatform, cpuModel, ram, gpuPlatform, gpuModel, vram);
  
  if (c === 'Desktops') {
    if (incMouse) totalScore += 5;
    if (incKeyboard) totalScore += 5;
    if (incHeadset) totalScore += 5;
    if (incMonitor) {
      if (monRes === '4k') totalScore += 30;
      else if (monRes === '2k') totalScore += 20;
      else if (monRes === '1080p') totalScore += 10;
      
      if (monRefresh === '> 360Hz') totalScore += 30;
      else if (monRefresh === '200Hz-360Hz') totalScore += 20;
      else if (monRefresh === '120Hz-180Hz') totalScore += 10;
    }
  } else if (c === 'Consoles') {
    if (otherCpu === 'PS5 Pro' || otherCpu === 'Nintendo Switch 2') totalScore += 200;
    else if (['PlayStation 5', 'Xbox Series X', 'ASUS ROG Ally'].includes(otherCpu)) totalScore += 120;
    else totalScore += 60;
    
    if (numControllers === '4 Controllers') totalScore += 40;
    else if (numControllers === '3 Controllers') totalScore += 30;
    else if (numControllers === '2 Controllers') totalScore += 20;
    else if (numControllers === '1 Controller') totalScore += 10;
  } else if (c === 'Monitors') {
    if (monSize === '39"-49"' || monSize === '> 49"') totalScore += 60;
    else if (monSize === '28"-38"') totalScore += 40;
    else if (monSize === '24"-27"') totalScore += 20;

    if (monRefresh === '> 360Hz') totalScore += 80;
    else if (monRefresh === '200Hz-360Hz') totalScore += 50;
    else if (monRefresh === '120Hz-180Hz') totalScore += 20;

    if (monRes === '4K' || monRes === '4k') totalScore += 80;
    else if (monRes === '2K' || monRes === '2k') totalScore += 50;
    else if (monRes === '1080p') totalScore += 20;
  } else if (c === 'Controllers') {
    if (controllerModel.includes('Pro') || controllerModel.includes('Elite')) totalScore += 100;
    else totalScore += 40;
  }

  let tier = 'Low';
  let base = 600;
  
  if (c === 'GPUs') {
    if (totalScore >= 120) {
      tier = 'High';
      base = 1500;
    } else if (totalScore >= 70) {
      tier = 'Mid';
      base = 800;
    } else {
      tier = 'Low';
      base = 400;
    }
  } else if (c === 'Monitors') {
    if (totalScore >= 160 || ((monRes === '4K' || monRes === '4k') && monRefresh === '> 360Hz')) {
      tier = 'High';
      base = 2000;
    } else if (totalScore >= 90) {
      tier = 'Mid';
      base = 1000;
    } else {
      tier = 'Low';
      base = 500;
    }
  } else if (c === 'Controllers') {
    if (totalScore >= 100) {
      tier = 'High';
      base = 500;
    } else {
      tier = 'Mid';
      base = 250;
    }
  } else if (totalScore >= 180 || otherCpu.includes('4K')) {
    tier = 'High';
    base = 2500;
  } else if (totalScore >= 90 || otherCpu.includes('1440p')) {
    tier = 'Mid';
    base = 1200;
  }

  const isValid = () => {
    if (step === 1) return !!c;
    if (step === 2) {
      if (c === 'Laptops' || c === 'Desktops') {
        const cpuOk = !!cpuPlatform && !!cpuModel;
        const ramOk = !!ram;
        const gpuOk = !!gpuPlatform && (gpuPlatform === 'Integrated' || (!!gpuModel && !!vram));
        return cpuOk && ramOk && gpuOk;
      }
      if (c === 'GPUs') return !!gpuPlatform && !!gpuModel && !!vram;
      if (c === 'Consoles') return !!otherCpu && !!numControllers;
      if (c === 'Monitors') return !!monSize && !!monRefresh && !!monRes;
      if (c === 'Controllers') return !!controllerPlatform && !!controllerModel;
      return true;
    }
    if (step === 3 && c === 'Desktops') {
      return !incMonitor || (!!monSize && !!monRefresh && !!monRes);
    }
    if (step === 4) return imgs.length > 0;
    return true;
  };

  const nextStep = () => {
    if (step === 2 && c !== 'Desktops') setStep(4);
    else setStep(step + 1);
  };

  const prevStep = () => {
    if (step === 4 && c !== 'Desktops') setStep(2);
    else if (step > 1) setStep(step - 1);
    else close();
  };

  const submit = async () => {
    if (!user || !isValid()) return;
    setLoad(true);
    try {
      let specData: any = {};
      if (['Laptops', 'Desktops'].includes(c)) {
        specData.cpu = cpuPlatform ? cpuPlatform + ' ' + cpuModel : '';
        specData.ram = ram ?? '';
        specData.gpuType = gpuPlatform === 'Integrated' ? 'Integrated' : (gpuModel ?? '');
        specData.vram = vram ?? '';
        if (c === 'Desktops') {
          specData.peripherals = {
            mouse: incMouse ?? false,
            keyboard: incKeyboard ?? false,
            headset: incHeadset ?? false,
            monitor: incMonitor ? { size: monSize ?? '', res: monRes ?? '', refresh: monRefresh ?? '' } : null
          };
        }
      } else if (c === 'GPUs') {
        specData.gpuPlatform = gpuPlatform ?? '';
        specData.gpuModel = gpuModel ?? '';
        specData.vram = vram ?? '';
      } else if (c === 'Consoles') {
        specData.model = otherCpu ?? '';
        specData.controllers = numControllers ?? '';
      } else if (c === 'Monitors') {
        specData.monitorSize = monSize ?? '';
        specData.refreshRate = monRefresh ?? '';
        specData.resolution = monRes ?? '';
      } else if (c === 'Controllers') {
        specData.controllerPlatform = controllerPlatform ?? '';
        specData.controllerModel = controllerModel ?? '';
      } else {
        specData.model = otherCpu ?? '';
      }

      const payload: any = {
        title, category: c, pricePerDay: base,
        tier, imageUrl: imgs[0] || '',
        images: imgs,
        specs: specData,
        score: totalScore,
        isGaming: ['Laptops', 'Desktops'].includes(c) && !!gpuPlatform && gpuPlatform !== 'Integrated',
        logisticsType: logisticsType === 'Self-Pickup' ? 'pickup' : 'delivery',
        logisticsAdjustment: logisticsType === 'Self-Pickup' ? -50 : 50,
        updatedAt: serverTimestamp()
      };
      if (editItem) {
        await updateDoc(doc(db, 'listings', editItem.id), payload);
      } else {
        await addDoc(collection(db, 'listings'), {
          ...payload, status: 'AVAILABLE', ownerId: user.uid,
          location: 'Hyderabad', description: 'Premium Gear',
          createdAt: serverTimestamp()
        });
      }
      showToast(editItem ? 'Listing updated successfully!' : 'Listing published!', 'success');
      onClose(); reset();
    } catch (e) {
      console.error(e);
      showToast('Failed to save listing. Please try again.', 'error');
    } finally {
      setLoad(false);
    }
  };

  const reset = () => { 
    setStep(1); setC(''); 
    setCpuPlatform(''); setCpuModel(''); setRam(''); 
    setGpuPlatform(''); setGpuModel(''); setVram(''); setOtherCpu(''); setNumControllers('');
    setMonSize(''); setMonRefresh(''); setMonRes('');
    setControllerPlatform(''); setControllerModel('');
    setLogisticsType('Self-Pickup');
    setImgs([]); 
  };
  
  const close = () => { onClose(); reset(); };

  useEffect(() => {
    if (!isOpen || !editItem) return;
    const specs = editItem.specs || {};
    setC(editItem.category || '');
    setImgs(editItem.images || (editItem.imageUrl ? [editItem.imageUrl] : []));
    setLogisticsType(editItem.logisticsType === 'delivery' ? 'Owner Delivery' : 'Self-Pickup');
    if (['Laptops', 'Desktops'].includes(editItem.category)) {
      const cpuParts = (specs.cpu || '').split(' ');
      setCpuPlatform(cpuParts[0] || '');
      setCpuModel(cpuParts.slice(1).join(' ') || '');
      setRam(specs.ram || '');
      if (specs.gpuType === 'Integrated') {
        setGpuPlatform('Integrated'); setGpuModel(''); setVram('');
      } else {
        const gpuM = specs.gpuType || '';
        setGpuModel(gpuM);
        setGpuPlatform(detectGpuPlatform(gpuM));
        setVram(specs.vram || '');
      }
      if (editItem.category === 'Desktops' && specs.peripherals) {
        setIncMouse(specs.peripherals.mouse || false);
        setIncKeyboard(specs.peripherals.keyboard || false);
        setIncHeadset(specs.peripherals.headset || false);
        if (specs.peripherals.monitor) {
          setIncMonitor(true);
          setMonSize(specs.peripherals.monitor.size || '');
          setMonRefresh(specs.peripherals.monitor.refresh || '');
          setMonRes(specs.peripherals.monitor.res || '');
        }
      }
    } else if (editItem.category === 'GPUs') {
      setGpuPlatform(specs.gpuPlatform || '');
      setGpuModel(specs.gpuModel || '');
      setVram(specs.vram || '');
    } else if (editItem.category === 'Consoles') {
      setOtherCpu(specs.model || '');
      setNumControllers(specs.controllers || '');
    } else if (editItem.category === 'Monitors') {
      setMonSize(specs.monitorSize || '');
      setMonRefresh(specs.refreshRate || '');
      setMonRes(specs.resolution || '');
    } else if (editItem.category === 'Controllers') {
      setControllerPlatform(specs.controllerPlatform || '');
      setControllerModel(specs.controllerModel || '');
    }
    setStep(1);
  }, [isOpen, editItem]);

  useEffect(() => {
    if (gpuPlatform === 'Integrated') {
      setGpuModel('');
      setVram('');
    }
  }, [gpuPlatform]);

  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const Select = ({ label, val, set, opts, disabled }: any) => (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{label}</label>
      <select value={val} onChange={e => set(e.target.value)} disabled={disabled} style={{ backgroundColor: '#121212', color: 'white' }} className="w-full bg-[#121212] text-white border border-white/10 rounded-[12px] p-3 text-[13px] focus:border-[#A855F7] outline-none cursor-pointer">
        <option value="" style={{backgroundColor:'#121212', color:'white'}}>Select</option>
        {opts.map((o: string) => <option key={o} value={o} style={{backgroundColor:'#121212', color:'white'}}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overscroll-none">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#121212] border border-white/5 rounded-[24px] md:rounded-[40px] w-full max-w-[520px] max-h-[95vh] shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="px-5 md:px-8 py-5 md:py-6 flex justify-between items-center shrink-0 relative rounded-t-[24px] md:rounded-t-[40px] overflow-hidden">
            <h2 className="text-[18px] font-bold text-white tracking-tight">{editItem ? 'Edit Listing' : 'List Your Gear'}</h2>
            <button onClick={close} className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-all">
              <X size={20} />
            </button>
            <div className="absolute bottom-0 left-0 h-[2px] bg-[#A855F7] transition-all duration-300 z-10" style={{ width: `${(step / (c === 'Desktops' ? 6 : 5)) * 100}%` }} />
          </div>

          {/* Body */}
          <div className="px-5 md:px-8 py-6 md:py-8 flex-1 md:min-h-[460px] flex flex-col justify-start relative z-[70]">
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center space-y-1 mb-4">
                   <h3 className="text-white font-bold text-[18px]">Select Category</h3>
                   <p className="text-white/50 text-[13px]">What type of gear are you listing?</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {CATS.map((cat) => (
                    <button key={cat.name} onClick={() => setC(cat.name)} className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border border-transparent transition-all cursor-pointer ${c === cat.name ? 'bg-[#A855F7]/10 border-[#A855F7] text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:border-white/20'}`}>
                      <cat.Icon size={28} className={c === cat.name ? 'text-[#A855F7]' : ''} />
                      <span className="text-[13px] font-medium">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 relative">
                <div className="text-center space-y-1 mb-6">
                   <h3 className="text-white font-bold text-[18px]">Select Specifications</h3>
                   <p className="text-white/50 text-[13px]">We use this to auto-tier and value your gear.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4 pb-2">
                  {(c === 'Laptops' || c === 'Desktops') ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Select label="CPU Platform" val={cpuPlatform} set={setCpuPlatform} opts={CPU_PLATFORMS} />
                        <Select label="CPU Model" val={cpuModel} set={setCpuModel} opts={cpuPlatform === 'Intel' ? INTEL_CPUS : cpuPlatform === 'AMD' ? AMD_CPUS : []} disabled={!cpuPlatform} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <Select label="RAM Capacity" val={ram} set={setRam} opts={RAM_OPTS} />
                         <Select label="GPU Platform" val={gpuPlatform} set={setGpuPlatform} opts={GPU_PLATFORMS} />
                      </div>

                      <div className="grid grid-cols-2 gap-4 relative z-[100]">
                        <GpuModelSelect 
                           val={gpuModel} 
                           set={setGpuModel}
                           platform={gpuPlatform} 
                           disabled={!gpuPlatform || gpuPlatform === 'Integrated'} 
                        />
                        <Select 
                           label="VRAM" 
                           val={vram} 
                           set={setVram} 
                           opts={VRAM_OPTS} 
                           disabled={!gpuPlatform || gpuPlatform === 'Integrated'} 
                        />
                      </div>
                    </div>
                  ) : c === 'GPUs' ? (
                     <div className="space-y-4">
                        <Select label="GPU Platform" val={gpuPlatform} set={setGpuPlatform} opts={['Nvidia', 'AMD', 'Intel Arc']} />
                        <div className="grid grid-cols-2 gap-4 relative z-[50]">
                          <GpuModelSelect 
                             val={gpuModel} 
                             set={setGpuModel}
                             platform={gpuPlatform}
                             disabled={!gpuPlatform} 
                          />
                          <Select 
                             label="VRAM" 
                             val={vram} 
                             set={setVram} 
                             opts={VRAM_OPTS} 
                             disabled={!gpuPlatform} 
                          />
                        </div>
                     </div>
                  ) : c === 'Consoles' ? (
                    <div className="space-y-4">
                      <Select label="Model" val={otherCpu} set={setOtherCpu} opts={['PS5 Pro', 'PlayStation 5', 'Xbox Series X', 'Xbox Series S', 'Nintendo Switch 2', 'Nintendo Switch OLED', 'ASUS ROG Ally']} />
                      <Select label="Controllers" val={numControllers} set={setNumControllers} opts={['None', '1 Controller', '2 Controllers', '3 Controllers', '4 Controllers']} />
                    </div>
                  ) : c === 'Monitors' ? (
                    <div className="space-y-4">
                      <Select label="Monitor Size" val={monSize} set={setMonSize} opts={['< 24"', '24"-27"', '28"-38"', '39"-49"', '> 49"']} />
                      <div className="grid grid-cols-2 gap-4">
                        <Select label="Refresh Rate" val={monRefresh} set={setMonRefresh} opts={['< 120Hz', '120Hz-180Hz', '200Hz-360Hz', '> 360Hz']} />
                        <Select label="Resolution" val={monRes} set={setMonRes} opts={['1080p', '2K', '4K']} />
                      </div>
                    </div>
                  ) : c === 'Controllers' ? (
                    <div className="space-y-4">
                      <Select label="Controller Platform" val={controllerPlatform} set={setControllerPlatform} opts={['PlayStation', 'Xbox', 'Other Brands']} />
                      <Select label="Controller Model" val={controllerModel} set={setControllerModel} opts={
                        controllerPlatform === 'PlayStation' ? ['DualSense (PS5)', 'DualSense Edge Pro'] :
                        controllerPlatform === 'Xbox' ? ['Xbox Wireless Controller', 'Xbox Elite Series 2 Pro'] :
                        controllerPlatform === 'Other Brands' ? ['Pro Controller', 'Standard Controller'] :
                        []
                      } disabled={!controllerPlatform} />
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-white/50 text-[13px]">No advanced specs required for {c}.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && c === 'Desktops' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 relative">
                <div className="text-center space-y-1 mb-6">
                   <h3 className="text-white font-bold text-[18px]">Bundle Peripherals</h3>
                   <p className="text-white/50 text-[13px]">Adding peripherals increases your gear's daily value.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4 pb-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-[13px] text-white/80 select-none cursor-pointer border border-white/10 p-3 rounded-[12px] bg-[#121212]">
                         <input type="checkbox" checked={incMouse} onChange={(e) => setIncMouse(e.target.checked)} className="rounded bg-[#121212] border-white/10 text-[#A855F7] focus:ring-[#A855F7] focus:ring-offset-0 border" /> Include Mouse
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-white/80 select-none cursor-pointer border border-white/10 p-3 rounded-[12px] bg-[#121212]">
                         <input type="checkbox" checked={incKeyboard} onChange={(e) => setIncKeyboard(e.target.checked)} className="rounded bg-[#121212] border-white/10 text-[#A855F7] focus:ring-[#A855F7] focus:ring-offset-0 border" /> Include Keyboard
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-white/80 select-none cursor-pointer border border-white/10 p-3 rounded-[12px] bg-[#121212]">
                         <input type="checkbox" checked={incHeadset} onChange={(e) => setIncHeadset(e.target.checked)} className="rounded bg-[#121212] border-white/10 text-[#A855F7] focus:ring-[#A855F7] focus:ring-offset-0 border" /> Include Headset
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-white/80 select-none cursor-pointer border border-white/10 p-3 rounded-[12px] bg-[#121212]">
                         <input type="checkbox" checked={incMonitor} onChange={(e) => setIncMonitor(e.target.checked)} className="rounded bg-[#121212] border-white/10 text-[#A855F7] focus:ring-[#A855F7] focus:ring-offset-0 border" /> Include Monitor
                      </label>
                    </div>
                    {incMonitor && (
                      <div className="bg-[#A855F7]/5 border border-[#A855F7]/20 rounded-[16px] p-4 mt-3 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Select label="Monitor Size" val={monSize} set={setMonSize} opts={['< 24"', '24"-27"', '28"-38"', '39"-49"', '> 49"']} />
                          <Select label="Resolution" val={monRes} set={setMonRes} opts={['1080p', '2k', '4k']} />
                        </div>
                        <Select label="Refresh Rate" val={monRefresh} set={setMonRefresh} opts={['< 120Hz', '120Hz-180Hz', '200Hz-360Hz', '> 360Hz']} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#A855F7]/10 flex items-center justify-center mb-2">
                   <UploadCloud className="text-[#A855F7]" size={28} />
                </div>
                <div className="text-center space-y-1">
                   <h3 className="text-white font-bold text-[18px]">Upload Gear Photos</h3>
                   <p className="text-white/50 text-[13px]">Add up to 3 high-quality images of your gear.</p>
                </div>
                <div className="grid grid-cols-3 gap-4 w-full mt-6">
                  {[0, 1, 2].map((i) => (
                    <button key={i} type="button" onClick={() => {
                        const n = [...imgs];
                        n[i] = `https://picsum.photos/seed/${Math.random()}/500/500`;
                        setImgs(n);
                      }} className="aspect-square bg-black/20 border border-dashed border-white/10 hover:border-[#A855F7]/50 rounded-[16px] flex items-center justify-center transition-all cursor-pointer group relative overflow-hidden">
                      {imgs[i] ? (
                        <img src={imgs[i]} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Plus className="text-white/30 group-hover:text-[#A855F7] transition-colors" size={24} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-1 mb-6">
                   <h3 className="text-white font-bold text-[18px]">Logistics & Transport</h3>
                   <p className="text-white/50 text-[13px]">How will the gear reach the borrower?</p>
                </div>
                
                <div className="space-y-4">
                  <button onClick={() => setLogisticsType('Self-Pickup')} className={`w-full flex items-center p-4 rounded-[16px] border transition-all cursor-pointer ${logisticsType === 'Self-Pickup' ? 'bg-[#A855F7]/10 border-[#A855F7]' : 'bg-[#121212] border-white/10 hover:border-white/20'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 transition-colors ${logisticsType === 'Self-Pickup' ? 'bg-[#A855F7]/20 text-[#A855F7]' : 'bg-white/5 text-white/50'}`}>
                       <MapPin size={24} />
                    </div>
                    <div className="flex flex-col text-left flex-1">
                      <span className={`text-[15px] font-bold ${logisticsType === 'Self-Pickup' ? 'text-[#A855F7]' : 'text-white'}`}>Self-Pickup</span>
                      <span className="text-[13px] text-white/50">Borrower travels to your hub</span>
                    </div>
                    <span className="text-[15px] font-bold text-white">-₹50</span>
                  </button>

                  <button onClick={() => setLogisticsType('Owner Delivery')} className={`w-full flex items-center p-4 rounded-[16px] border transition-all cursor-pointer ${logisticsType === 'Owner Delivery' ? 'bg-[#A855F7]/10 border-[#A855F7]' : 'bg-[#121212] border-white/10 hover:border-white/20'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 transition-colors ${logisticsType === 'Owner Delivery' ? 'bg-[#A855F7]/20 text-[#A855F7]' : 'bg-white/5 text-white/50'}`}>
                       <Truck size={24} />
                    </div>
                    <div className="flex flex-col text-left flex-1">
                      <span className={`text-[15px] font-bold ${logisticsType === 'Owner Delivery' ? 'text-[#A855F7]' : 'text-white'}`}>Owner Delivery</span>
                      <span className="text-[13px] text-white/50">You drop off the gear</span>
                    </div>
                    <span className="text-[15px] font-bold text-white">+₹50</span>
                  </button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-1 mb-8">
                   <h3 className="text-white font-bold text-[22px]">Valuation Ready</h3>
                   <p className={`text-[13px] font-bold tracking-wider uppercase ${tier === 'High' ? 'text-[#2DD4BF]' : tier === 'Mid' ? 'text-[#A855F7]' : 'text-white/70'}`}>
                     {tier} TIER ASSET
                   </p>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                   <div className="bg-[#A855F7]/10 border border-[#A855F7]/30 rounded-[24px] p-6 text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#A855F7] to-transparent"></div>
                      <p className="text-[12px] font-bold text-[#A855F7] uppercase tracking-wider mb-2">Base Daily Rate</p>
                      <h4 className="text-[36px] font-black text-white tracking-tighter leading-none mb-4">₹{base}</h4>
                      <div className="flex justify-between items-center text-[13px] border-t border-[#A855F7]/20 pt-4 mb-2">
                         <span className="text-white/70 font-medium">{logisticsType === 'Self-Pickup' ? 'Self-Pickup Adjustment' : 'Owner Delivery Adjustment'}</span>
                         <span className={logisticsType === 'Self-Pickup' ? 'text-[#2DD4BF] font-medium' : 'text-[#A855F7] font-medium'}>
                            {logisticsType === 'Self-Pickup' ? '-₹50' : '+₹50'}
                         </span>
                      </div>
                      <div className="flex justify-between items-center text-[13px] mb-4">
                         <span className="text-white/70 font-medium">Platform Fee (5%)</span>
                         <span className="text-white/70">-₹{base * 0.05}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px] pt-4 border-t border-[#A855F7]/20">
                         <span className="text-[#2DD4BF] font-bold">You Earn (Per Day)</span>
                         <span className="text-[#2DD4BF] font-black">₹{base * 0.95}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-[#121212] border border-white/10 rounded-[20px] p-5 text-center">
                        <p className="text-[11px] text-[#A855F7] font-bold tracking-wider uppercase mb-1">3-Day (25% Off)</p>
                        <p className="text-[20px] text-white font-bold tracking-tight">₹{Math.round(base * 3 * 0.75)}</p>
                     </div>
                     <div className="bg-[#121212] border border-white/10 rounded-[20px] p-5 text-center">
                        <p className="text-[11px] text-[#2DD4BF] font-bold tracking-wider uppercase mb-1">30-Day (50% Off)</p>
                        <p className="text-[20px] text-white font-bold tracking-tight">₹{Math.round(base * 30 * 0.5)}</p>
                     </div>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 md:px-8 py-4 md:py-5 border-t border-white/5 bg-[#121212] flex justify-between shrink-0 rounded-b-[24px] md:rounded-b-[40px] relative z-[50]">
            <button onClick={prevStep} className="px-6 py-3 text-white/50 hover:text-white font-bold text-[13px] active:scale-95 transition-all cursor-pointer">
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < 6 ? (
              <button onClick={nextStep} disabled={!isValid()} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-[13px] rounded-[24px] disabled:opacity-50 transition-all active:scale-95 cursor-pointer">
                {step === 5 ? 'View Valuation' : 'Next Step'}
              </button>
            ) : (
              <button onClick={submit} disabled={!isValid() || load} className="px-8 py-3 bg-[#A855F7] text-white font-bold text-[13px] rounded-[24px] shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 cursor-pointer">
                {load ? (editItem ? 'Saving...' : 'Publishing...') : (editItem ? 'Save Changes' : 'Publish Listing')}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}


