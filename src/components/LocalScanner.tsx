
import React, { useState, useRef } from 'react';
import { Paperclip, Loader2, X, Scan, BrainCircuit, Maximize2, Star, Camera, RefreshCw } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface ExtractedData {
  rawText: string;
  lines: string[];
}

export default function LocalScanner({ onScanComplete, orientation = 'vertical' }: { onScanComplete: (data: any) => void, orientation?: 'vertical' | 'horizontal' }) {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [carData, setCarData] = useState<any>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      alert("Camera access denied or unavailable. Please check permissions or use the upload (paperclip) icon.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureCamera = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg');
      setImage(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runOcr = async () => {
    if (!image) return;
    setIsScanning(true);
    setData(null);
    setEditMode(false);
    setOcrError(null);
    
    // Add a small delay for UI to update
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      console.log("OCR: Starting worker...");
      const worker = await createWorker('eng', 1, {
        logger: m => console.log('Tesseract:', m)
      });
      console.log("OCR: Recognizing image...");
      const ret = await worker.recognize(image);
      await worker.terminate();
      console.log("OCR: Finished. Text length:", ret.data.text.length);

      if (!ret.data.text.trim()) {
        throw new Error("No text found in this image. Please try a clearer photo.");
      }

      const cleanedLines = ret.data.text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 3)
        // Strict Noise filter: Ignore lines with symbols or fragments
        .filter(line => {
          const words = line.split(/\s+/).filter(w => w.length > 0);
          const singleCharWords = words.filter(w => w.length === 1).length;
          // If more than half the words are single chars, it's noise
          if (words.length > 2 && (singleCharWords / words.length) > 0.45) return false;

          const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
          const digitCount = (line.match(/[0-9]/g) || []).length;
          const symbolCount = (line.match(/[^a-zA-Z0-9\s]/g) || []).length;
          
          return (letterCount + digitCount) > symbolCount && 
                 !line.startsWith('—') && 
                 !line.startsWith('-') &&
                 !line.includes('——'); 
        })
        .filter(line => !line.toLowerCase().includes('oem'))
        .filter(line => !line.toLowerCase().includes('i ps')); 

      const text = ret.data.text; 
      
      // Price Regex: Find all mentions of Prices (R XXX XXX)
      const priceMatches = Array.from(text.matchAll(/R\s?(\d{1,3}[\s,.]?\d{3})/gi));
      let mainPrice = 'TBD';
      
      if (priceMatches.length > 0) {
        // Filter out prices that are preceded by "Save" or "Was"
        const validPrices = priceMatches.filter(m => {
          const index = m.index || 0;
          const precedingText = text.substring(Math.max(0, index - 10), index).toLowerCase();
          return !precedingText.includes('save') && !precedingText.includes('was');
        });
        
        // Pick the first valid price, or if all are "save/was", pick the highest one found
        const chosenMatch = validPrices.length > 0 ? validPrices[0] : 
                           priceMatches.sort((a, b) => b[1].length - a[1].length)[0];
        
        mainPrice = chosenMatch[1].replace(/[^0-9]/g, '');
      }

      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      const mileageMatch = text.match(/([\d\s\.,]+)\s?km/i);
      const transmissionMatch = text.match(/(Manual|Automatic|Auto|MT|AT|DSG|CVT)/i);
      const fuelMatch = text.match(/(Petrol|Diesel|Hybrid|Electric|EV|PHEV)/i);

      // Try to find make/model more intelligently
      const commonBrands = ['audi', 'q2', 'q3', 'q5', 'a1', 'a3', 'renault', 'kiger', 'suzuki', 'swift', 'toyota', 'vw', 'volkswagen', 'ford', 'bmw', 'mercedes', 'hyundai', 'kia', 'nissan', 'isuzu', 'haval', 'cherry', 'mazda', 'tiguan', 'golf', 'polo'];
      
      const makeModelCandidates = cleanedLines.filter(l => l.length > 3 && !l.match(/^\d+$/));
      const brandLine = makeModelCandidates.find(l => 
        commonBrands.some(brand => l.toLowerCase().includes(brand))
      );

      const extractedMakeModel = brandLine || makeModelCandidates[0] || 'Unknown Vehicle';

      // Find Location: Look for Dealership names or cities
      const locationKeywords = [
        'cape', 'west', 'motors', 'motus', 'dealership', 'cfa', 'city', 'volkswagen', 'suzuki', 'toyota', 'audi', 'renault',
        'reeds', 'opel', 'bellville', 'sandton', 'pretoria', 'joburg', 'durban', 'boland', 'bidvest', 'mccarthy', 'barloworld'
      ];
      const foundLocation = cleanedLines.find(l => 
        l !== extractedMakeModel && 
        locationKeywords.some(kw => l.toLowerCase().includes(kw)) &&
        !l.toLowerCase().includes('transmission') &&
        !l.toLowerCase().includes('fuel') &&
        !l.toLowerCase().includes('intens')
      );

      // Find Trim: Prioritize lines with car-specific specs
      const trimKeywords = ['turbo', 'intens', 'zen', 'life', 'premium', 'edition', 'package', 'dsg', 'auto', 'tastic', 'tfsi', 'sport', 'line', 'urban', 'gl+', 'glx', 'rs', 'pro', 'tourer'];
      
      const trimCandidates = cleanedLines.filter(l => 
        l !== extractedMakeModel && 
        l !== foundLocation &&
        !l.includes('=') &&
        !l.includes('R ') &&
        !l.includes('km') &&
        !l.match(/\d{4}/) &&
        !l.startsWith('—')
      );

      // Try to find by keyword first, then fallback to length
      const foundTrim = trimCandidates.find(l => trimKeywords.some(kw => l.toLowerCase().includes(kw))) || 
                        trimCandidates.find(l => l.length > 3 && l.length < 20);

      const parsedCarData = {
          makeModel: extractedMakeModel.replace(/[=:\\\-]/g, '').trim(), 
          trimEdition: foundTrim ? foundTrim.replace(/[|~]/g, '').trim() : 'Standard',
          location: foundLocation ? foundLocation.replace(/[Q|@|_|:]/g, '').trim() : 'Showroom Floor',
          year: yearMatch ? yearMatch[0] : new Date().getFullYear().toString(),
          mileage: mileageMatch ? mileageMatch[1].replace(/\./g, ' ').replace(/\s+/g, '').trim() + ' km' : '0 km',
          transmission: transmissionMatch ? (transmissionMatch[0].match(/Auto|DSG|CVT/i) ? 'Automatic' : 'Manual') : 'Manual/Auto',
          fuelType: fuelMatch ? fuelMatch[0] : 'Petrol/Diesel',
          price: mainPrice !== 'TBD' ? `R ${mainPrice.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}` : 'Contact for Price',
          extraInfo: 'Scanner refined result'
      };

      setData({ rawText: cleanedLines.join('\n'), lines: cleanedLines });
      setCarData(parsedCarData);
    } catch (err: any) {
      console.error(err);
      setOcrError(err.message || 'Error parsing card. Please try again or upload a clearer photo.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="bg-white p-3 sm:p-6 rounded-[24px] sm:rounded-[30px] border border-vw-border shadow-sm space-y-4 pb-12 w-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-vw-blue uppercase italic flex items-center gap-2">
           <Scan size={16} className="text-vw-accent" /> Scanner
        </h3>
        <div className="flex items-center gap-2">
            {!cameraActive ? (
                <button onClick={startCamera} className="p-2 bg-vw-bg rounded-full hover:bg-vw-blue/10 flex items-center gap-2 px-3">
                    <Camera size={18} className="text-vw-blue" />
                    <span className="text-[10px] font-black uppercase text-vw-blue hidden sm:inline">Camera</span>
                </button>
            ) : (
                <button onClick={stopCamera} className="p-2 bg-red-100 rounded-full hover:bg-red-200 text-red-600">
                    <X size={18} />
                </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-vw-bg rounded-full hover:bg-vw-blue/10">
                <Paperclip size={20} className="text-vw-blue" />
            </button>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
      </div>

      {cameraActive && (
        <div className={`relative rounded-2xl overflow-hidden bg-black flex items-center justify-center border-4 border-vw-blue/20 transition-all duration-500 ${orientation === 'horizontal' ? 'aspect-video' : 'aspect-square md:aspect-video'}`}>
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
                <button 
                  onClick={captureCamera}
                  className="bg-vw-accent text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl border-4 border-white active:scale-95 transition-transform"
                >
                    <div className="w-8 h-8 rounded-full bg-white/20" />
                </button>
            </div>
            <div className="absolute top-4 left-4 right-4 text-center">
                <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black uppercase text-white tracking-widest inline-block">Align Card Clearly</div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {image && !data && !isScanning && (
        <div className="space-y-4 text-center">
             <img src={image} className="max-h-64 w-full object-contain mx-auto rounded-lg" alt="Preview"/>
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setImage(null)} className="w-full bg-white text-vw-blue border border-vw-blue font-bold p-3 rounded-lg text-xs uppercase">Retake</button>
               <button onClick={runOcr} className="w-full bg-vw-blue text-white p-3 rounded-lg text-xs font-bold uppercase">Extract Text</button>
             </div>
        </div>
      )}

      {isScanning && <div className="text-center font-bold text-vw-blue animate-pulse text-xs py-4">Processing Card...</div>}
      
      {ocrError && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center space-y-3">
            <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest">{ocrError}</p>
            <button onClick={() => {setImage(null); setOcrError(null);}} className="text-[9px] bg-red-600 text-white px-4 py-2 rounded-lg font-black uppercase">Try Again</button>
        </div>
      )}

      {data && !editMode && (
        <div className="bg-vw-bg p-4 rounded-xl max-h-48 overflow-y-auto text-xs">
           <h4 className="font-bold mb-2">Raw Text Found:</h4>
           {data.lines.map((line, i) => <p key={i} className="mb-0.5">{line}</p>)}
           <button onClick={() => setEditMode(true)} className="mt-2 w-full bg-vw-blue text-white p-2 rounded text-xs font-bold">Review & Edit</button>
        </div>
      )}
      
      {editMode && carData && (
          <div className="space-y-4 pb-6 w-full">
              <div className="bg-vw-accent/5 p-4 rounded-xl border border-vw-accent/10 mb-2">
                 <p className="text-[10px] font-bold text-vw-blue uppercase tracking-widest text-center">Step 3: Review & Finalize Card</p>
              </div>
              <div className="relative group cursor-zoom-in" onClick={() => setShowFullImage(true)}>
                <img src={image!} className="max-h-72 w-full object-contain mx-auto rounded-xl shadow-lg border border-vw-border" alt="Original Scan" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all rounded-xl opacity-0 group-hover:opacity-100">
                    <Maximize2 className="text-white" />
                </div>
                <div className="absolute top-2 right-2 bg-vw-blue/80 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full backdrop-blur-sm">Tap to Enlarge</div>
              </div>

              {showFullImage && (
                <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col p-4" onClick={() => setShowFullImage(false)}>
                    <div className="flex justify-end p-2">
                        <button className="bg-white/10 text-white p-2 rounded-full hover:bg-white/20"><X size={24} /></button>
                    </div>
                    <div className="flex-1 w-full h-full flex items-center justify-center overflow-auto">
                        <img src={image!} className="max-w-none w-auto h-auto min-w-full" alt="Full size scan" />
                    </div>
                    <div className="text-center text-white/50 text-xs py-4 font-bold uppercase tracking-widest">Click anywhere to close</div>
                </div>
              )}

              <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-black text-vw-blue tracking-widest">Vehicle Details</label>
                    <span className="text-[9px] text-vw-muted italic">Click fields to correct text</span>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <input value={carData.makeModel} onChange={e => setCarData({...carData, makeModel: e.target.value})} className="w-full p-4 pr-10 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="Make/Model" />
                      <button onClick={() => setCarData({...carData, makeModel: ''})} className="absolute right-3 top-1/2 -translate-y-1/2 text-vw-muted hover:text-red-500"><X size={14} /></button>
                    </div>
                    <div className="relative">
                      <input value={carData.trimEdition} onChange={e => setCarData({...carData, trimEdition: e.target.value})} className="w-full p-4 pr-10 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="Trim/Edition" />
                      <button onClick={() => setCarData({...carData, trimEdition: ''})} className="absolute right-3 top-1/2 -translate-y-1/2 text-vw-muted hover:text-red-500"><X size={14} /></button>
                    </div>
                    <div className="relative">
                      <input value={carData.location || ''} onChange={e => setCarData({...carData, location: e.target.value})} className="w-full p-4 pr-10 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="City / Dealership" />
                      <button onClick={() => setCarData({...carData, location: ''})} className="absolute right-3 top-1/2 -translate-y-1/2 text-vw-muted hover:text-red-500"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input value={carData.year} onChange={e => setCarData({...carData, year: e.target.value})} className="p-4 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="Year" />
                        <input value={carData.mileage} onChange={e => setCarData({...carData, mileage: e.target.value})} className="p-4 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="Mileage" />
                        <input value={carData.transmission} onChange={e => setCarData({...carData, transmission: e.target.value})} className="p-4 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="Transmission" />
                        <input value={carData.price} onChange={e => setCarData({...carData, price: e.target.value})} className="p-4 bg-vw-bg border border-vw-border rounded-xl text-xs font-bold focus:ring-2 focus:ring-vw-accent outline-none" placeholder="Price" />
                    </div>
                  </div>
              </div>
              
              <div className="sticky bottom-0 bg-white pt-4">
                <button onClick={() => {
                    console.log("Confirm button clicked, carData:", carData);
                    onScanComplete(carData);
                    setImage(null);
                    setData(null);
                    setEditMode(false);
                    setCarData(null);
                }} className="w-full bg-vw-accent text-white p-6 rounded-[24px] text-base font-black uppercase shadow-xl hover:bg-vw-blue hover:scale-[1.02] active:scale-[0.98] transition-all mb-4 italic flex items-center justify-center gap-2">
                    ADD TO MY WISHLIST <Star size={18} />
                </button>
              </div>
          </div>
      )}

      {/* Instructional Text */}
      {!image && !data && !cameraActive && (
          <div className="text-[10px] bg-vw-bg p-3 rounded-lg text-vw-muted space-y-1">
              <p><strong>How to Scan:</strong></p>
              <p>1. Open <strong>Camera</strong> or click <strong>Paperclip</strong> to upload.</p>
              <p>2. Capture or select the vehicle spec card.</p>
              <p>3. Click "Extract Text" and review details.</p>
          </div>
      )}
    </div>
  );
}
