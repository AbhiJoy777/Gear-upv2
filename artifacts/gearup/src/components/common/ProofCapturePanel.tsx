import React, { useMemo, useState } from 'react';
import { Camera, Loader2, Video } from 'lucide-react';
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export type ProofItem = {
  type: 'image' | 'video' | 'simulated-video';
  url: string;
  uploadedBy: string;
  uploadedAt?: any;
  simulated?: boolean;
};

export type ProofMediaField = 'handoverProofMedia' | 'returnProofMedia' | 'proofMedia';

type PendingProof = {
  id: string;
  file: File;
  type: 'image' | 'video';
  previewUrl: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 20;

export const getProofMedia = (rental: any, field: ProofMediaField = 'proofMedia') => {
  const primary = Array.isArray(rental?.[field]) ? rental[field] : [];
  if (primary.length > 0) return primary;
  if (field === 'handoverProofMedia' && Array.isArray(rental?.proofMedia)) return rental.proofMedia;
  return [];
};

export function ProofMediaStrip({ media, max = 6 }: { media: ProofItem[]; max?: number }) {
  if (!media.length) return null;

  return (
    <div className="flex gap-2 overflow-x-auto">
      {media.slice(0, max).map((item, idx) => {
        const simulated = item.simulated || item.url === 'simulated-proof' || item.url?.startsWith('simulated-proof://');
        if (simulated) {
          return (
            <div key={`${item.url}-${idx}`} className="w-14 h-14 rounded-[10px] bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 shrink-0 flex items-center justify-center text-[9px] text-[#2DD4BF] font-bold text-center px-1">
              Simulated
            </div>
          );
        }
        return (
          <a
            key={`${item.url}-${idx}`}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="w-14 h-14 rounded-[10px] bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center text-[10px] text-white/40"
          >
            {item.type === 'image' ? <img src={item.url} alt="Proof" className="w-full h-full object-cover" /> : <Video size={18} className="text-white/40" />}
          </a>
        );
      })}
    </div>
  );
}

const compressImage = async (file: File) => {
  if (!file.type.startsWith('image/')) return file;
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = imageUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(imageUrl);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file;
};

const getVideoDuration = async (file: File) => {
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = videoUrl;
  const duration = await new Promise<number>((resolve, reject) => {
    video.onloadedmetadata = () => resolve(video.duration || 0);
    video.onerror = reject;
  });
  URL.revokeObjectURL(videoUrl);
  return duration;
};

export default function ProofCapturePanel({
  rental,
  label = 'Proof Media',
  helper = 'Capture at least one clear gear photo before continuing.',
  field = 'proofMedia',
  actionLabel = 'Record Proof of Life',
  onUploaded,
}: {
  rental: any;
  label?: string;
  helper?: string;
  field?: ProofMediaField;
  actionLabel?: string;
  onUploaded?: (items: ProofItem[]) => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [pending, setPending] = useState<PendingProof[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const existingMedia = useMemo(() => getProofMedia(rental, field), [rental, field]);

  const prepareFiles = async (files: FileList | null) => {
    if (!files) return [];
    const next: PendingProof[] = [];
    for (const file of Array.from(files)) {
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
      if (!type) {
        showToast('Unsupported proof file type.', 'error');
        continue;
      }
      if (type === 'image' && file.size > MAX_IMAGE_BYTES) {
        showToast('Image proof must be under 8 MB.', 'error');
        continue;
      }
      if (type === 'video' && file.size > MAX_VIDEO_BYTES) {
        showToast('Video proof must be under 30 MB.', 'error');
        continue;
      }
      if (type === 'video') {
        try {
          const duration = await getVideoDuration(file);
          if (duration > MAX_VIDEO_SECONDS) {
            showToast('Video proof must be 20 seconds or shorter.', 'error');
            continue;
          }
        } catch (err) {
          console.error('Could not read proof video duration:', err);
          showToast('This browser could not read the video proof.', 'error');
          continue;
        }
      }
      next.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        type,
        previewUrl: URL.createObjectURL(file),
      });
    }
    return next.slice(0, 1);
  };

  const saveSimulatedProof = async () => {
    if (!user || !rental?.id) return;
    setUploading(true);
    setProgress(0);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      setProgress(50);
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      setProgress(100);
      const simulatedProof: ProofItem = {
        type: 'simulated-video',
        url: 'simulated-proof',
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
        simulated: true,
      };
      await updateDoc(doc(db, 'rentals', rental.id), {
        [field]: arrayUnion(simulatedProof),
        updatedAt: serverTimestamp(),
      });
      onUploaded?.([simulatedProof]);
      showToast('Simulated proof saved.', 'success');
    } catch (err) {
      console.error('Simulated proof failed:', err);
      showToast('Could not save simulated proof. Please try again.', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const uploadProof = async (items: PendingProof[]) => {
    if (!user || !rental?.id || items.length === 0) return;
    setUploading(true);
    setProgress(0);
    setPending(items);
    try {
      const uploaded: ProofItem[] = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const uploadFile = item.type === 'image' ? await compressImage(item.file) : item.file;
        const ext = item.type === 'image' ? 'jpg' : (item.file.name.split('.').pop() || 'webm');
        const proofRef = ref(storage, `rental-proofs/${rental.id}/${Date.now()}-${index}.${ext}`);
        const task = uploadBytesResumable(proofRef, uploadFile, { contentType: uploadFile.type });

        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snapshot) => {
            const itemProgress = snapshot.bytesTransferred / snapshot.totalBytes;
            setProgress(Math.round(((index + itemProgress) / items.length) * 100));
          }, reject, () => resolve());
        });

        const url = await getDownloadURL(task.snapshot.ref);
        uploaded.push({
          type: item.type,
          url,
          uploadedBy: user.uid,
          uploadedAt: serverTimestamp(),
        });
      }

      await updateDoc(doc(db, 'rentals', rental.id), {
        [field]: arrayUnion(...uploaded),
        updatedAt: serverTimestamp(),
      });
      setPending([]);
      onUploaded?.(uploaded);
      showToast('Proof media uploaded.', 'success');
    } catch (err: any) {
      console.error('Proof upload failed:', err);
      const message = String(err?.message || '').toLowerCase();
      const storageNotReady = err?.code === 'storage/bucket-not-found' || err?.code === 'storage/unknown' || message.includes('storage has not been set up');
      if (storageNotReady) {
        showToast('Media upload requires Firebase Storage to be enabled. Saving simulated proof for dev mode.', 'warning');
        await saveSimulatedProof();
      } else {
        showToast(err?.code === 'storage/unauthorized' ? 'Permission denied while uploading proof.' : 'Proof upload failed. Please try again.', 'error');
      }
    } finally {
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPending([]);
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0A0A0A] p-4 space-y-4">
      <div>
        <p className="text-[11px] text-white/40 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-[12px] text-white/45 mt-1 leading-relaxed">{helper}</p>
      </div>

      {existingMedia.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existingMedia.slice(0, 6).map((item: ProofItem, idx: number) => (
            item.simulated || item.url === 'simulated-proof' || item.url?.startsWith('simulated-proof://') ? (
              <div key={`${item.url}-${idx}`} className="aspect-square rounded-[12px] overflow-hidden bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 flex items-center justify-center text-[10px] text-[#2DD4BF] font-bold text-center px-2">
                Simulated
              </div>
            ) : (
              <a key={`${item.url}-${idx}`} href={item.url} target="_blank" rel="noreferrer" className="aspect-square rounded-[12px] overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                {item.type === 'image' ? <img src={item.url} alt="Proof" className="w-full h-full object-cover" /> : <Video size={20} className="text-white/50" />}
              </a>
            )
          ))}
        </div>
      )}

      <button
        onClick={saveSimulatedProof}
        disabled={uploading}
        className="w-full py-3 bg-[#A855F7] disabled:opacity-40 text-white font-bold rounded-[14px] text-[12px] flex items-center justify-center gap-2 transition-all"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {uploading ? `Recording proof... ${progress}%` : actionLabel}
      </button>
    </div>
  );
}
