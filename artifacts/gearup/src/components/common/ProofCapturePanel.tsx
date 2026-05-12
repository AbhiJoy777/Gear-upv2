import React, { useMemo, useState } from 'react';
import { Camera, Loader2, Trash2, UploadCloud, Video } from 'lucide-react';
import { arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

type ProofItem = {
  type: 'image' | 'video';
  url: string;
  uploadedBy: string;
  uploadedAt?: any;
};

type PendingProof = {
  id: string;
  file: File;
  type: 'image' | 'video';
  previewUrl: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 20;

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
  onUploaded,
}: {
  rental: any;
  label?: string;
  helper?: string;
  onUploaded?: (items: ProofItem[]) => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [pending, setPending] = useState<PendingProof[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const existingMedia = useMemo(() => Array.isArray(rental?.proofMedia) ? rental.proofMedia : [], [rental?.proofMedia]);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
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
    setPending((items) => [...items, ...next].slice(0, 4));
  };

  const removePending = (id: string) => {
    setPending((items) => {
      const target = items.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return items.filter((item) => item.id !== id);
    });
  };

  const uploadPending = async () => {
    if (!user || !rental?.id || pending.length === 0) return;
    setUploading(true);
    setProgress(0);
    try {
      const uploaded: ProofItem[] = [];
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index];
        const uploadFile = item.type === 'image' ? await compressImage(item.file) : item.file;
        const ext = item.type === 'image' ? 'jpg' : (item.file.name.split('.').pop() || 'webm');
        const proofRef = ref(storage, `rental-proofs/${rental.id}/${Date.now()}-${index}.${ext}`);
        const task = uploadBytesResumable(proofRef, uploadFile, { contentType: uploadFile.type });

        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snapshot) => {
            const itemProgress = snapshot.bytesTransferred / snapshot.totalBytes;
            setProgress(Math.round(((index + itemProgress) / pending.length) * 100));
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
        proofMedia: arrayUnion(...uploaded),
        updatedAt: serverTimestamp(),
      });
      pending.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setPending([]);
      onUploaded?.(uploaded);
      showToast('Proof media uploaded.', 'success');
    } catch (err: any) {
      console.error('Proof upload failed:', err);
      showToast(err?.code === 'storage/unauthorized' ? 'Permission denied while uploading proof.' : 'Proof upload failed. Please try again.', 'error');
    } finally {
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

      <div className="grid grid-cols-2 gap-2">
        <label className="cursor-pointer bg-[#121212] border border-white/10 hover:border-[#A855F7]/40 rounded-[14px] py-3 text-[12px] text-white font-bold flex items-center justify-center gap-2 transition-all">
          <Camera size={15} /> Camera
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
        </label>
        <label className="cursor-pointer bg-[#121212] border border-white/10 hover:border-[#A855F7]/40 rounded-[14px] py-3 text-[12px] text-white font-bold flex items-center justify-center gap-2 transition-all">
          <Video size={15} /> Video
          <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void addFiles(e.target.files)} />
        </label>
      </div>

      {(existingMedia.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {existingMedia.slice(0, 6).map((item: ProofItem, idx: number) => (
            <a key={`${item.url}-${idx}`} href={item.url} target="_blank" rel="noreferrer" className="aspect-square rounded-[12px] overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              {item.type === 'image' ? <img src={item.url} alt="Proof" className="w-full h-full object-cover" /> : <Video size={20} className="text-white/50" />}
            </a>
          ))}
          {pending.map((item) => (
            <div key={item.id} className="aspect-square rounded-[12px] overflow-hidden bg-white/5 border border-[#A855F7]/30 relative">
              {item.type === 'image' ? <img src={item.previewUrl} alt="Pending proof" className="w-full h-full object-cover" /> : <video src={item.previewUrl} className="w-full h-full object-cover" muted />}
              <button onClick={() => removePending(item.id)} className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-white">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={uploadPending}
        disabled={uploading || pending.length === 0}
        className="w-full py-3 bg-[#A855F7] disabled:opacity-40 text-white font-bold rounded-[14px] text-[12px] flex items-center justify-center gap-2 transition-all"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
        {uploading ? `Uploading ${progress}%` : pending.length > 0 ? 'Upload Proof' : 'Add Proof First'}
      </button>
    </div>
  );
}
